import { Injectable, Logger } from '@nestjs/common';
import { ToolsService } from '../tools/tools.service';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';
import { StructuredTool } from '@langchain/core/tools';
import { ManusAgent } from './manus-agent';
import { ToolExecutor } from '../tools/types';
import { Observable } from 'rxjs';

const callTool = async (
  tool: StructuredTool,
  args: Record<string, unknown>,
): Promise<[ok: boolean, err: string, result: string]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await tool.invoke(args);
    return [
      true,
      '',
      typeof result === 'string' ? result : JSON.stringify(result),
    ];
  } catch (err) {
    return [false, err instanceof Error ? err.message : String(err), ''];
  }
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  // Cache agent instances by chatId for multi-turn conversations
  private readonly agentCache = new Map<string, ManusAgent>();

  constructor(
    private readonly toolsService: ToolsService,
    private readonly llmService: LlmService,
    private readonly ragService: RagService,
  ) {}

  private createManusAgent(ragContext = ''): ManusAgent {
    const allTools = this.toolsService.getAllTools();
    const combinedExecutor: ToolExecutor = {
      execute: async (
        toolName: string,
        args: Record<string, unknown>,
      ): Promise<string> => {
        const tool = allTools.find((item) => item.name === toolName);
        if (tool) {
          const [ok, err, result] = await callTool(tool, args);
          return ok ? result : `Executing tool error: ${err}`;
        }
        return `Tool ${toolName} not found`;
      },
    };
    return new ManusAgent(
      allTools,
      combinedExecutor,
      this.llmService.getChatModel(),
      ragContext,
    );
  }

  private getOrCreateAgent(chatId: string, ragContext = ''): ManusAgent {
    const cached = this.agentCache.get(chatId);
    if (cached) {
      return cached;
    }
    const agent = this.createManusAgent(ragContext);
    this.agentCache.set(chatId, agent);
    return agent;
  }

  async runManusAgent(message: string, chatId: string): Promise<string> {
    const ragContext = await this.ragService.retrieveAsContext(message);
    const agent = this.getOrCreateAgent(chatId, ragContext);
    return agent.run(message);
  }

  runManusAgentStream(message: string, chatId: string): Observable<string> {
    return new Observable((subscriber) => {
      this.ragService
        .retrieveAsContext(message)
        .then((ragContext) => {
          const agent = this.getOrCreateAgent(chatId, ragContext);
          agent.runStream(message).subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        })
        .catch((err) => {
          this.logger.error('Run manus agent stream error:', err);
        });
    });
  }
}
