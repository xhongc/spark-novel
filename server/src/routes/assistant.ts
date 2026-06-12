import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { piAgent } from "../lib/pi-agent.js";
import { authGuard } from "../plugins/auth.js";
import { closeSSE, initSSE, sendSSE } from "../lib/sse.js";

const referencedDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
});

const assistantChatSchema = z.object({
  content: z.string().min(1),
  currentPath: z.string().optional(),
  currentStoryTitle: z.string().optional(),
  currentSectionTitle: z.string().optional(),
  currentSectionContent: z.string().optional(),
  selectedText: z.string().optional(),
  referencedMaterials: z.array(referencedDocumentSchema).optional(),
  referencedSkills: z.array(referencedDocumentSchema).optional(),
});

function formatReferencedDocuments(
  label: string,
  documents?: Array<z.infer<typeof referencedDocumentSchema>>,
): string | null {
  if (!documents?.length) return null;

  return `${label}：\n${documents.map((document) => (
    `- ${document.name}\n${document.content.slice(0, 2500)}`
  )).join("\n\n")}`;
}

function buildPrompt(input: z.infer<typeof assistantChatSchema>): string {
  const contextBlocks = [
    input.currentPath ? `当前页面：${input.currentPath}` : null,
    input.currentStoryTitle ? `当前故事：${input.currentStoryTitle}` : null,
    input.currentSectionTitle ? `当前章节：${input.currentSectionTitle}` : null,
    input.selectedText ? `用户选中的文本：\n${input.selectedText}` : null,
    input.currentSectionContent
      ? `当前章节正文：\n${input.currentSectionContent.slice(0, 4000)}`
      : null,
    formatReferencedDocuments("已引用素材", input.referencedMaterials),
    formatReferencedDocuments("已调用技能", input.referencedSkills),
  ].filter(Boolean);

  if (contextBlocks.length === 0) {
    return "";
  }

  return `当前上下文：
${contextBlocks.join("\n\n")}

请在回复下一条用户消息时参考以上上下文。`;
}

export async function assistantRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  fastify.get("/assistant/chat/session", async (req, reply) => {
    const messages = await piAgent.getChatHistory(req.user.userId);
    return reply.send({
      success: true,
      data: { messages },
    });
  });

  fastify.delete("/assistant/chat/session", async (req, reply) => {
    piAgent.resetChatSession(req.user.userId);
    return reply.send({
      success: true,
      data: null,
    });
  });

  fastify.post("/assistant/chat", async (req, reply) => {
    const payload = assistantChatSchema.parse(req.body);
    const prompt = buildPrompt(payload);

    req.log.info({ payload }, "[assistant] chat payload");
    if (prompt) {
      req.log.info(`\n[assistant] context begin\n${prompt}\n[assistant] context end`);
    }

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    try {
      for await (const chunk of piAgent.streamChat(req.user.userId, payload.content, prompt || null)) {
        sendSSE(reply, "chunk", { type: "content", text: chunk });
      }

      sendSSE(reply, "done", { type: "complete" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI 回复失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });
}
