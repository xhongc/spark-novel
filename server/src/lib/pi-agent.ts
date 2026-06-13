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

export function refreshPiAgentModelRegistry(): void {
  modelRegistry.refresh();
}

export interface PiChatHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type PiAgentStreamEvent =
  | {
    type: "tool_execution_start";
    toolName: string;
    args: unknown;
  }
  | {
    type: "tool_execution_end";
    toolName: string;
    isError: boolean;
  };

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

function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeHistoryContent(role: "user" | "assistant", content: string): string {
  if (role !== "user") {
    return content;
  }

  const match = content.match(
    /(?:^当前上下文：[\s\S]*?\n\n)?用户本轮请求：\n([\s\S]*?)\n\n请结合已有会话历史与本轮上下文继续回复。\s*$/,
  );

  return match?.[1]?.trim() || content;
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
  async *stream(
    prompt: string,
    systemPrompt?: string,
    onEvent?: (event: PiAgentStreamEvent) => void,
  ): AsyncGenerator<string> {
    const { session } = await createDefaultSession(SessionManager.inMemory(WORKSPACE_CWD));

    yield* this.streamSessionPrompt(session, prompt, onEvent);
  }

  async *streamChat(
    userId: string,
    content: string,
    turnContext?: string | null,
    onEvent?: (event: PiAgentStreamEvent) => void,
  ): AsyncGenerator<string> {
    const sessionFile = getChatSessionFile(userId);
    const { session } = await createDefaultSession(
      SessionManager.open(sessionFile, CHAT_SESSION_DIR, WORKSPACE_CWD),
    );

    if (turnContext) {
      await session.sendCustomMessage({
        customType: "spark-turn-context",
        content: turnContext,
        display: false,
      }, {
        deliverAs: "nextTurn",
      });
    }

    yield* this.streamSessionPrompt(session, content, onEvent);
  }

  async getChatHistory(userId: string): Promise<PiChatHistoryMessage[]> {
    const sessionFile = getChatSessionFile(userId);
    const { session } = await createDefaultSession(
      SessionManager.open(sessionFile, CHAT_SESSION_DIR, WORKSPACE_CWD),
    );

    try {
      const messages = session.sessionManager.buildSessionContext().messages;

      return messages.flatMap((message, index) => {
        if (message.role !== "user" && message.role !== "assistant") {
          return [];
        }

        const content = normalizeHistoryContent(message.role, getMessageText(message.content));
        if (!content) {
          return [];
        }

        return [{
          id: `session-${index}`,
          role: message.role,
          content,
          createdAt: new Date(message.timestamp).toISOString(),
        }];
      });
    } finally {
      session.dispose();
    }
  }

  resetChatSession(userId: string): void {
    const sessionFile = getChatSessionFile(userId);
    if (fs.existsSync(sessionFile)) {
      fs.rmSync(sessionFile);
    }
  }

  private async *streamSessionPrompt(
    session: Awaited<ReturnType<typeof createDefaultSession>>["session"],
    prompt: string,
    onEvent?: (event: PiAgentStreamEvent) => void,
  ): AsyncGenerator<string> {

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
      if (event.type === "tool_execution_start") {
        onEvent?.({
          type: "tool_execution_start",
          toolName: event.toolName,
          args: event.args,
        });
      }
      if (event.type === "tool_execution_end") {
        onEvent?.({
          type: "tool_execution_end",
          toolName: event.toolName,
          isError: event.isError,
        });
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
