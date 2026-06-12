import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const WORKSPACE_CWD = path.resolve(process.cwd(), "workspace");
// 项目级配置目录：server/workspace/.pi/agent/
const PROJECT_AGENT_DIR = path.resolve(WORKSPACE_CWD, ".pi", "agent");
const CHAT_SESSION_DIR = path.resolve(PROJECT_AGENT_DIR, "chat-sessions");
const CHAT_INSTRUCTIONS = `你是一名中文小说写作助手。你的职责是帮助用户进行小说创作、润色、改写、扩写、缩写、人物塑造、情节推进和文本分析。

要求：
- 默认使用简体中文回复。
- 结合上下文，给出直接可用的写作建议或改写结果。
- 如果用户是在要求修改文本，优先给出改写后的具体内容，而不是空泛说明。
- 不要编造你没有看到的设定；如果上下文不足，明确指出缺失信息并在现有信息上尽量帮用户推进。
- 如果提供了“已调用技能”或“已引用素材”，优先基于这些内容完成任务。
- 回复保持清晰、自然、聚焦写作任务，避免冗长寒暄。`;

// 确保目录存在
fs.mkdirSync(PROJECT_AGENT_DIR, { recursive: true });
fs.mkdirSync(WORKSPACE_CWD, { recursive: true });
fs.mkdirSync(CHAT_SESSION_DIR, { recursive: true });

// 优先读环境变量，其次读项目级 auth.json
const authStorage = AuthStorage.create(PROJECT_AGENT_DIR);
if (process.env.ANTHROPIC_API_KEY) {
  authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY);
}
if (process.env.OPENAI_API_KEY) {
  authStorage.setRuntimeApiKey("openai", process.env.OPENAI_API_KEY);
}

const modelRegistry = ModelRegistry.create(authStorage, path.join(PROJECT_AGENT_DIR, "models.json"));

function getChatSessionFile(userId: string): string {
  const hash = createHash("sha256").update(userId).digest("hex");
  return path.join(CHAT_SESSION_DIR, `chat-${hash}.jsonl`);
}

async function createDefaultSession(sessionManager: SessionManager) {
  return createAgentSession({
    cwd: WORKSPACE_CWD,
    agentDir: PROJECT_AGENT_DIR,
    sessionManager,
    authStorage,
    modelRegistry,
  });
}

export class PiAgentService {
  /**
   * 非流式调用 — 用于生成设定/大纲，返回完整文本
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const { session } = await createDefaultSession(SessionManager.inMemory(WORKSPACE_CWD));

    let result = "";
    const unsubscribe = session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        result += event.assistantMessageEvent.delta;
      }
    });

    try {
      await session.prompt(prompt);
    } finally {
      unsubscribe();
      session.dispose();
    }

    return result;
  }

  /**
   * 流式调用 — 用于生成正文，返回 AsyncGenerator
   */
  async *stream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    const { session } = await createDefaultSession(SessionManager.inMemory(WORKSPACE_CWD));

    yield* this.streamSessionPrompt(session, prompt);
  }

  async *streamChat(userId: string, prompt: string): AsyncGenerator<string> {
    const sessionFile = getChatSessionFile(userId);
    const { session } = await createDefaultSession(
      SessionManager.open(sessionFile, CHAT_SESSION_DIR, WORKSPACE_CWD),
    );

    if (session.sessionManager.getEntries().length === 0) {
      session.sessionManager.appendCustomMessageEntry("spark-chat-instructions", CHAT_INSTRUCTIONS, false);
    }

    yield* this.streamSessionPrompt(session, prompt);
  }

  resetChatSession(userId: string): void {
    const sessionFile = getChatSessionFile(userId);
    if (fs.existsSync(sessionFile)) {
      fs.rmSync(sessionFile);
    }
  }

  private async *streamSessionPrompt(session: Awaited<ReturnType<typeof createDefaultSession>>["session"], prompt: string): AsyncGenerator<string> {

    const chunks: string[] = [];
    let waitResolve: (() => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const unsubscribe = session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        chunks.push(event.assistantMessageEvent.delta);
        waitResolve?.();
      }
      if (event.type === "agent_end") {
        done = true;
        waitResolve?.();
      }
    });

    const promptPromise = session.prompt(prompt).catch((e) => {
      error = e instanceof Error ? e : new Error(String(e));
      done = true;
      waitResolve?.();
    });

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length === 0 && !done) {
          await new Promise<void>((r) => {
            waitResolve = r;
          });
        }
        while (chunks.length > 0) {
          yield chunks.shift()!;
        }
      }

      await promptPromise;
      if (error) throw error;
    } finally {
      unsubscribe();
      session.dispose();
    }
  }
}

export const piAgent = new PiAgentService();
