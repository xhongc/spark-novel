import path from "node:path";
import fs from "node:fs";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// 项目级配置目录：server/.pi/agent/
const PROJECT_AGENT_DIR = path.resolve(process.cwd(), ".pi", "agent");

// 确保目录存在
fs.mkdirSync(PROJECT_AGENT_DIR, { recursive: true });

// 优先读环境变量，其次读项目级 auth.json
const authStorage = AuthStorage.create(PROJECT_AGENT_DIR);
if (process.env.ANTHROPIC_API_KEY) {
  authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY);
}
if (process.env.OPENAI_API_KEY) {
  authStorage.setRuntimeApiKey("openai", process.env.OPENAI_API_KEY);
}

const modelRegistry = ModelRegistry.create(authStorage, path.join(PROJECT_AGENT_DIR, "models.json"));

export class PiAgentService {
  /**
   * 非流式调用 — 用于生成设定/大纲，返回完整文本
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const { session } = await createAgentSession({
      agentDir: PROJECT_AGENT_DIR,
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
    });

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
    const { session } = await createAgentSession({
      agentDir: PROJECT_AGENT_DIR,
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
    });

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
