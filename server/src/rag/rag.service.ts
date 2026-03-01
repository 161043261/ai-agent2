import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { QueryRewriter } from './query-rewriter';
import { ContextualQueryAugmenter } from './contextual-query-augmenter';
import { KeywordEnricher } from './keyword-enricher';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../config';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { DocumentLoader } from './document-loader';
import { DocumentRetriever } from './document-retriever';
import { BaseMessage } from '@langchain/core/messages';
import { Document } from '@langchain/core/documents';
import { join } from 'node:path';

const DOCS_PATH = join(process.cwd(), './docs');

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private readonly embeddings: Embeddings;
  private readonly chatModel: BaseChatModel;
  private readonly documentLoader: DocumentLoader;
  private readonly queryRewriter: QueryRewriter;
  private readonly contextualAugmenter: ContextualQueryAugmenter;
  private readonly keywordEnricher: KeywordEnricher;
  private vectorStore: MemoryVectorStore | null = null;
  private documentRetriever: DocumentRetriever | null = null;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<LlmProvider>(
      'LLM_PROVIDER',
      'ollama',
    );
    // this.embeddings, this.chatModel
    if (provider === 'ollama') {
      const baseUrl = this.configService.get<string>(
        'OLLAMA_BASE_URL',
        'http://localhost:11434',
      );
      const embeddingModel = this.configService.get<string>(
        'OLLAMA_EMBEDDING_MODEL',
        'nomic-embed-text',
      );
      const chatModelName = this.configService.get<string>(
        'OLLAMA_CHAT_MODEL',
        'qwen2.5',
      );
      this.embeddings = new OllamaEmbeddings({
        baseUrl,
        model: embeddingModel,
      });
      this.chatModel = new ChatOllama({ baseUrl, model: chatModelName });
      this.logger.log(
        `Ollama initialized: embedding=${embeddingModel}, chat=${chatModelName}`,
      );
    } else {
      const apiKey = this.configService.get<string>('DASHSCOPE_API_KEY');
      const embeddingModel = this.configService.get<string>(
        'DASHSCOPE_EMBEDDING_MODEL',
        'text-embedding-v4',
      );
      const chatModelName = this.configService.get<string>(
        'DASHSCOPE_CHAT_MODEL',
        'qwen-plus',
      );
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey || 'mock-key',
        modelName: embeddingModel,
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      });
      this.chatModel = new ChatOpenAI({
        openAIApiKey: apiKey || 'mock-key',
        modelName: chatModelName,
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      });
      this.logger.log(
        `Dashscope initialized: embedding=${embeddingModel}, chat=${chatModelName}`,
      );
    }
    // this.documentLoader
    this.documentLoader = new DocumentLoader({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    this.queryRewriter = new QueryRewriter(this.chatModel);
    this.contextualAugmenter = new ContextualQueryAugmenter(this.chatModel);
    this.keywordEnricher = new KeywordEnricher(this.chatModel);
  }

  async onModuleInit() {
    this.logger.log('Documents path:', DOCS_PATH);
    await this.initRag();
  }

  private async initRag() {
    try {
      const docs = await this.documentLoader.loadAndSplit(DOCS_PATH);
      if (docs.length === 0) {
        this.logger.warn('No documents for RAG');
        return false;
      }
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        this.embeddings,
      );
      this.documentRetriever = new DocumentRetriever(
        this.vectorStore,
        this.queryRewriter,
        this.contextualAugmenter,
      );
      this.logger.log(`RAG initialized with ${docs.length} chunks`);
    } catch (err) {
      this.logger.error('Initialize RAG error:', err);
    }
  }

  async retrieve(
    query: string,
    chatHistory?: BaseMessage[],
  ): Promise<Document[]> {
    return this.documentRetriever?.retrieve(query, chatHistory) ?? [];
  }

  async retrieveAsContext(query: string, chatHistory?: BaseMessage[]) {
    return this.documentRetriever?.retrieveAsContext(query, chatHistory) ?? '';
  }

  async addDocuments(docs: Document[]): Promise<void> {
    docs = await this.keywordEnricher.enrichDocuments(docs);
    await this.vectorStore!.addDocuments(docs);
    this.logger.log(`Added ${docs.length} documents to vector store`);
  }
}
