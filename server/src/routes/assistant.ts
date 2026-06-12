import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { piAgent } from "../lib/pi-agent.js";
import { authGuard } from "../plugins/auth.js";
import { closeSSE, initSSE, sendSSE } from "../lib/sse.js";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const referencedDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
});

const assistantChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
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

  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${message.content}`)
    .join("\n\n");

  return `你是一名中文小说写作助手。你的职责是帮助用户进行小说创作、润色、改写、扩写、缩写、人物塑造、情节推进和文本分析。

要求：
- 默认使用简体中文回复。
- 结合上下文，给出直接可用的写作建议或改写结果。
- 如果用户是在要求修改文本，优先给出改写后的具体内容，而不是空泛说明。
- 不要编造你没有看到的设定；如果上下文不足，明确指出缺失信息并在现有信息上尽量帮用户推进。
- 如果提供了“已调用技能”或“已引用素材”，优先基于这些内容完成任务。
- 回复保持清晰、自然、聚焦写作任务，避免冗长寒暄。

${contextBlocks.length > 0 ? `当前上下文：\n${contextBlocks.join("\n\n")}\n\n` : ""}以下是本轮对话历史：

${transcript}

请继续回复最后一条用户消息。`;
}

export async function assistantRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  fastify.post("/assistant/chat", async (req, reply) => {
    const payload = assistantChatSchema.parse(req.body);
    const prompt = buildPrompt(payload);

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    try {
      for await (const chunk of piAgent.stream(prompt)) {
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
