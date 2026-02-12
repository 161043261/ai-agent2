/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import Sqlite3, { Database } from 'better-sqlite3';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Matrix } from 'ml-matrix';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'node:fs';
import { mkdirSync, readFileSync } from 'fs';

interface StoredDocument {
  id: string;
  content: string;
  metadata: string;
  embedding: string;
}

@Injectable()
export class VectorStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VectorStoreService.name);
  private db: Database | null = null;
  private readonly dbPath: string;
  private readonly embeddings: Embeddings;
  private readonly sqlSnippets: string[] = [];

  constructor(private readonly configService: ConfigService) {
    this.logger.debug('Current working directory:', process.cwd());
    const sql1 = readFileSync(join(process.cwd(), './sql/1.sql'), 'utf-8');
    const sql2 = readFileSync(join(process.cwd(), './sql/2.sql'), 'utf-8');
    this.sqlSnippets.push(sql1, sql2);
    this.logger.warn(
      "'vector-store.service' is DEPRECATED, use 'rag.service' instead",
    );

    const provider = this.configService.get<string>('LLM_PROVIDER', 'ollama');
    this.dbPath = this.configService.get<string>(
      'VECTOR_DB_PATH',
      join(process.cwd(), './data/vectors.db'),
    );

    if (provider === 'ollama') {
      const baseUrl = this.configService.get<string>(
        'OLLAMA_BASE_URL',
        'http://localhost:11434',
      );
      const embeddingModel = this.configService.get<string>(
        'OLLAMA_EMBEDDING_MODEL',
        'nomic-embed-text',
      );
      this.embeddings = new OllamaEmbeddings({
        baseUrl,
        model: embeddingModel,
      });
      this.logger.log(
        `Ollama embedding initialized: ${embeddingModel} at ${baseUrl}`,
      );
    } else {
      const apiKey = this.configService.get<string>('DASHSCOPE_API_KEY');
      const embeddingModel = this.configService.get<string>(
        'DASHSCOPE_EMBEDDING_MODEL',
        'text-embedding-v4',
      );
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        modelName: embeddingModel,
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      });
      this.logger.log(`DashScope embedding initialized: ${embeddingModel}`);
    }
  }

  async onModuleInit() {
    await this.initDatabase();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async initDatabase() {
    try {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.db = new Sqlite3(this.dbPath);
      this.db.exec(this.sqlSnippets[0]);

      // Create index
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at);',
      );

      await this.loadDocumentsFromDirectory(
        join(process.cwd(), './resources/docs/base'),
      );

      const { count } = this.db
        .prepare('SELECT COUNT(*) as count FROM documents;')
        .get() as { count: number };
      this.logger.log(`Vector database initialized with ${count} documents`);
    } catch (err) {
      this.logger.log('Failed to initialize database:', err);
      this.db = new Sqlite3(':memory:');
      this.db.exec(this.sqlSnippets[1]);
      this.logger.warn('Fallback to memory database');
    }
  }

  async loadDocumentsFromDirectory(docsPath: string): Promise<number> {
    if (!existsSync(docsPath)) {
      this.logger.warn('Documents directory not found:', docsPath);
      return 0;
    }
    const docs: Document[] = [];
    const files = readdirSync(docsPath);
    // this.logger.debug(`Load documents ${files.join(",")} from directory ${docsPath}`)
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        const filepath = join(docsPath, file);
        try {
          const content = readFileSync(filepath, 'utf-8');
          docs.push(
            new Document({
              pageContent: content,
              metadata: {
                source: filepath,
                file_name: file,
              },
            }),
          );
        } catch (err) {
          this.logger.warn(`Failed to load ${file}:`, err);
        }
      }
    }
    if (docs.length === 0) {
      return 0;
    }
    // Split documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    // Transform: add file name to content for better search
    const transformedDocs = splitDocs.map((doc) => {
      const filename = String(doc.metadata.file_name ?? 'unknown');
      return new Document({
        pageContent: `${filename}\n${doc.pageContent}`,
        metadata: doc.metadata,
      });
    });

    await this.addDocuments(transformedDocs);
    this.logger.log(
      `Loaded ${transformedDocs.length} chucks from ${docs.length} documents`,
    );
    return transformedDocs.length;
  }

  async addDocuments(documents: Document[]) {
    if (!this.db || documents.length === 0) {
      return;
    }
    const texts = documents.map((doc) => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    const stmt = this.db.prepare(
      'INSERT INTO documents (content, metadata, embedding) VALUES (?, ?, ?)',
    );
    const insertMany = this.db.transaction(
      (docs: Document[], embeddings: number[][]) => {
        for (let i = 0; i < docs.length; i++) {
          stmt.run(
            docs[i].pageContent,
            JSON.stringify(docs[i].metadata),
            JSON.stringify(embeddings[i]),
          );
        }
      },
    );
    insertMany(documents, embeddings);
    this.logger.log(`Added ${documents.length} documents to vector store`);
  }

  // 批量计算查询向量与所有文档向量的余弦相似度
  private batchCosineSimilarity(
    queryEmbedding: number[],
    docEmbeddings: number[][],
  ): number[] {
    // queryVec: 1 x D, docMatrix: N x D
    const queryVec = new Matrix([queryEmbedding]);
    const docMatrix = new Matrix(docEmbeddings);

    // dot products: (1 x D) * (D x N) = 1 x N
    const dots = queryVec.mmul(docMatrix.transpose());

    // norms: per-row L2 norm
    const queryNorm = queryVec.norm('frobenius');
    const docNorms: number[] = [];
    for (let i = 0; i < docMatrix.rows; i++) {
      docNorms.push(new Matrix([docMatrix.getRow(i)]).norm('frobenius'));
    }

    const scores: number[] = [];
    for (let i = 0; i < docEmbeddings.length; i++) {
      const denom = queryNorm * docNorms[i];
      scores.push(denom === 0 ? 0 : dots.get(0, i) / denom);
    }
    return scores;
  }

  // 相似度搜索
  async similaritySearch(
    query: string,
    maxResults = 5,
    minScore = 0.75,
  ): Promise<Document[]> {
    if (!this.db) {
      return [];
    }
    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const rows = this.db
        .prepare('SELECT * FROM documents')
        .all() as StoredDocument[];
      if (rows.length === 0) {
        return [];
      }

      const docEmbeddings = rows.map(
        (row) => JSON.parse(row.embedding) as number[],
      );
      const scores = this.batchCosineSimilarity(queryEmbedding, docEmbeddings);

      const results: { doc: Document; score: number }[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (scores[i] > minScore) {
          results.push({
            doc: new Document({
              pageContent: rows[i].content,
              metadata: JSON.parse(rows[i].metadata ?? '{}'),
            }),
            score: scores[i],
          });
        }
      }
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, maxResults).map((item) => item.doc);
      this.logger.debug(`Found ${topResults.length} documents`);
      return topResults;
    } catch (err) {
      this.logger.error('Similarity search failed:', err);
      return [];
    }
  }

  async similaritySearchWithScore(
    query: string,
    maxResults = 5,
  ): Promise<[doc: Document, score: number][]> {
    if (!this.db) {
      return [];
    }
    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const rows = this.db
        .prepare('SELECT * FROM documents')
        .all() as StoredDocument[];
      if (rows.length === 0) {
        return [];
      }

      const docEmbeddings = rows.map(
        (row) => JSON.parse(row.embedding) as number[],
      );
      const scores = this.batchCosineSimilarity(queryEmbedding, docEmbeddings);

      const results: [doc: Document, score: number][] = [];
      for (let i = 0; i < rows.length; i++) {
        results.push([
          new Document({
            pageContent: rows[i].content,
            metadata: JSON.parse(rows[i].metadata ?? '{}'),
          }),
          scores[i],
        ]);
      }
      results.sort((a, b) => b[1] - a[1]);
      return results.slice(0, maxResults);
    } catch (err) {
      this.logger.error('Similarity search with score failed:', err);
      return [];
    }
  }

  async clear(): Promise<void> {
    if (!this.db) {
      return;
    }
    this.db.exec('DELETE FROM documents');
    this.logger.log('Vector store cleared');
  }

  getDocumentCount(): number {
    if (!this.db) {
      return 0;
    }
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM documents')
      .get() as { count: number };
    return result.count;
  }
}
