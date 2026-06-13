import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../plugins/auth.js";
import {
  ensureStoryDirectories,
  listStoryWorkspace,
  parseChapterMarkdown,
  readOptionalFile,
  readStoryMeta,
  safeStoryPath,
  sanitizeFileName,
  scanStorySections,
  searchStoryWorkspace,
  serializeChapterFile,
  storyExists,
  writeStoryMeta,
} from "../lib/story-workspace.js";
import { closeSSE, initSSE, sendSSE } from "../lib/sse.js";
import { piAgent } from "../lib/pi-agent.js";

const listQuerySchema = z.object({
  path: z.string().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  scope: z.string().optional(),
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
});

const createFileSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
  content: z.string().optional(),
});

const getFileQuerySchema = z.object({
  path: z.string().min(1),
});

const updateFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const renameSchema = z.object({
  path: z.string().min(1),
  newName: z.string().min(1).max(100),
});

const deleteSchema = z.object({
  path: z.string().min(1),
});

const generateOutlineSchema = z.object({
  instructions: z.string().optional(),
});

const initDraftSchema = z.object({
  instructions: z.string().optional(),
});

const referencedDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
});

const storyAgentChatSchema = z.object({
  content: z.string().min(1),
  currentPath: z.string().optional(),
  currentFile: z.object({
    id: z.string(),
    name: z.string(),
    content: z.string(),
  }).optional(),
  selectedText: z.string().optional(),
  referencedFiles: z.array(referencedDocumentSchema).optional(),
});

function getParentId(relativePath: string): string | null {
  const parentId = path.dirname(relativePath);
  return parentId === "." ? null : parentId;
}

function ensureMarkdownFileName(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

function formatReferencedDocuments(
  label: string,
  documents?: Array<z.infer<typeof referencedDocumentSchema>>,
): string | null {
  if (!documents?.length) return null;

  return `${label}：\n${documents.map((document) => (
    `- ${document.name}\n${document.content.slice(0, 2500)}`
  )).join("\n\n")}`;
}

function buildStoryWorkspacePrompt(
  storyId: string,
  input: z.infer<typeof storyAgentChatSchema>,
): string {
  const contextBlocks = [
    `当前故事：${storyId}`,
    input.currentPath ? `当前目录：${input.currentPath}` : null,
    input.currentFile ? `当前文件：${input.currentFile.name}\n${input.currentFile.content.slice(0, 5000)}` : null,
    input.selectedText ? `用户选中的文本：\n${input.selectedText}` : null,
    formatReferencedDocuments("已引用故事文件", input.referencedFiles),
  ].filter(Boolean);

  return [
    "你是一个小说工作区助手。你的任务是围绕当前故事目录回答问题、梳理结构、提出修改建议。",
    "如果用户要求直接改文件，你可以结合上下文给出明确建议；当前接口第一版默认只返回文字答复，不直接写文件。",
    `故事工作区根目录：workspace/novel/${storyId}`,
    "",
    "当前上下文：",
    ...contextBlocks,
  ].join("\n\n");
}

function getToolStatusText(toolName: string, isEnd = false, isError = false): string | null {
  if (isEnd) {
    return isError ? "工具执行失败，正在继续处理..." : "工具执行完成，正在整理结果...";
  }

  switch (toolName) {
    case "read":
      return "正在读取故事文件...";
    case "ls":
      return "正在查看故事目录...";
    case "find":
      return "正在查找相关文件...";
    case "grep":
      return "正在搜索故事内容...";
    case "edit":
    case "write":
      return "正在准备修改建议...";
    case "bash":
      return "正在执行命令...";
    default:
      return `正在执行 ${toolName}...`;
  }
}

async function generateOutlineMarkdown(storyId: string, instructions?: string): Promise<string> {
  const settingFiles = await searchStoryWorkspace(storyId, "", 50, "设定");
  const settingDocs = await Promise.all(settingFiles.map(async (file) => {
    const content = await readOptionalFile(storyId, file.id);
    return content ? `# ${file.id}\n\n${content}` : null;
  }));
  const premise = await readOptionalFile(storyId, "想法.md");
  const meta = await readStoryMeta(storyId);

  const prompt = [
    "你是一位专业的小说策划师。请基于以下故事材料整理一份总纲，并拆成章节大纲。",
    premise ? `故事想法：\n${premise}` : null,
    `目标总字数：${meta.targetWordCount || 5000} 字`,
    settingDocs.filter(Boolean).length > 0
      ? `故事设定文件：\n${settingDocs.filter(Boolean).join("\n\n")}`
      : "当前还没有完整设定文件，请根据已有信息补齐合理大纲。",
    instructions ? `额外要求：\n${instructions}` : null,
    "",
    "请严格输出 Markdown：",
    "第一部分用 `# 总纲` 作为标题，内容为整体叙事结构。",
    "第二部分开始每章都使用如下结构：",
    "## 第1章 章节标题",
    "章节摘要正文",
    "",
    "> 目标字数：1500",
  ].filter(Boolean).join("\n\n");

  return piAgent.complete(prompt);
}

function splitOutlineMarkdown(markdown: string): Array<{ title: string; summary: string; targetWordCount: number }> {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const matches = [...normalized.matchAll(/^##\s*第\s*(\d+)\s*章\s*(.+)$/gm)];
  if (matches.length === 0) {
    return [];
  }

  const sections: Array<{ title: string; summary: string; targetWordCount: number }> = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const end = matches[i + 1]?.index ?? normalized.length;
    const block = normalized.slice(start, end).trim();
    const title = match[2].trim();
    const body = block.split("\n").slice(1).join("\n").trim();
    const targetWordCount = parseInt(body.match(/目标字数[：:]\s*(\d+)/)?.[1] || "1500", 10);
    const summary = body.replace(/^>\s*目标字数[^\n]*$/gm, "").trim();

    sections.push({
      title,
      summary,
      targetWordCount: Number.isFinite(targetWordCount) ? targetWordCount : 1500,
    });
  }

  return sections;
}

async function persistOutlineWorkspace(
  storyId: string,
  markdown: string,
): Promise<{ sectionCount: number }> {
  await ensureStoryDirectories(storyId);
  await fs.writeFile(safeStoryPath(storyId, path.join("大纲", "总纲.md")), markdown, "utf-8");

  const sections = splitOutlineMarkdown(markdown);
  const chapterDir = safeStoryPath(storyId, path.join("大纲", "章节"));
  await fs.rm(chapterDir, { recursive: true, force: true });
  await fs.mkdir(chapterDir, { recursive: true });

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const num = String(i + 1).padStart(2, "0");
    const cleanTitle = sanitizeFileName(section.title) || `第${i + 1}章`;
    const fileName = `${num}-${cleanTitle}.md`;
    const content = serializeChapterFile({
      index: i + 1,
      title: cleanTitle,
      summary: section.summary,
      targetWordCount: section.targetWordCount,
    });
    await fs.writeFile(path.join(chapterDir, fileName), content, "utf-8");
  }

  const meta = await readStoryMeta(storyId);
  meta.stage = sections.length > 0 ? "writing" : "outline";
  meta.updatedAt = new Date().toISOString();
  await writeStoryMeta(storyId, meta);

  return { sectionCount: sections.length };
}

export async function storyWorkspaceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  fastify.get("/stories/:title/workspace", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { path: relativePath = "" } = listQuerySchema.parse(req.query);
    const items = await listStoryWorkspace(storyId, relativePath);
    return { success: true, data: items };
  });

  fastify.get("/stories/:title/workspace/search", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { q = "", limit = 8, scope = "" } = searchQuerySchema.parse(req.query);
    try {
      const items = await searchStoryWorkspace(storyId, q, limit, scope);
      return { success: true, data: items };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "搜索故事文件失败" },
      });
    }
  });

  fastify.post("/stories/:title/workspace/folder", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { name, parentId = "" } = createFolderSchema.parse(req.body);
    const relativePath = path.join(parentId || "", sanitizeFileName(name));
    const absPath = safeStoryPath(storyId, relativePath);
    await fs.mkdir(absPath, { recursive: true });
    const stat = await fs.stat(absPath);

    return {
      success: true,
      data: {
        id: relativePath,
        name: path.basename(relativePath),
        type: "folder" as const,
        parentId: parentId || null,
        updatedAt: stat.mtime.toISOString(),
      },
    };
  });

  fastify.post("/stories/:title/workspace/file", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { name, parentId = "", content = "" } = createFileSchema.parse(req.body);
    const fileName = ensureMarkdownFileName(sanitizeFileName(name));
    const relativePath = path.join(parentId || "", fileName);
    const absPath = safeStoryPath(storyId, relativePath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, "utf-8");
    const stat = await fs.stat(absPath);

    return {
      success: true,
      data: {
        id: relativePath,
        name: fileName,
        type: "file" as const,
        parentId: parentId || null,
        updatedAt: stat.mtime.toISOString(),
      },
    };
  });

  fastify.get("/stories/:title/workspace/file", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { path: relativePath } = getFileQuerySchema.parse(req.query);
    try {
      const content = await fs.readFile(safeStoryPath(storyId, relativePath), "utf-8");
      return { success: true, data: { content } };
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "文件不存在" },
      });
    }
  });

  fastify.put("/stories/:title/workspace/file", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { path: relativePath, content } = updateFileSchema.parse(req.body);
    const absPath = safeStoryPath(storyId, relativePath);
    await fs.writeFile(absPath, content, "utf-8");
    const stat = await fs.stat(absPath);

    return {
      success: true,
      data: { updatedAt: stat.mtime.toISOString() },
    };
  });

  fastify.put("/stories/:title/workspace/rename", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { path: oldPath, newName } = renameSchema.parse(req.body);
    const parentDir = getParentId(oldPath);
    const fileName = oldPath.endsWith(".md")
      ? ensureMarkdownFileName(sanitizeFileName(newName))
      : sanitizeFileName(newName);
    const nextPath = parentDir ? path.join(parentDir, fileName) : fileName;

    await fs.rename(
      safeStoryPath(storyId, oldPath),
      safeStoryPath(storyId, nextPath),
    );

    return {
      success: true,
      data: {
        id: nextPath,
        name: fileName,
      },
    };
  });

  fastify.delete("/stories/:title/workspace", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { path: relativePath } = deleteSchema.parse(req.body);
    await fs.rm(safeStoryPath(storyId, relativePath), { recursive: true });
    return { success: true, data: null };
  });

  fastify.post("/stories/:title/actions/generate-outline", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const { instructions } = generateOutlineSchema.parse(req.body);

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    try {
      const markdown = await generateOutlineMarkdown(storyId, instructions);
      sendSSE(reply, "chunk", { type: "content", text: markdown });
      const result = await persistOutlineWorkspace(storyId, markdown);
      sendSSE(reply, "done", { type: "complete", data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成大纲失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });

  fastify.post("/stories/:title/actions/init-draft", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    initDraftSchema.parse(req.body);
    const sections = await scanStorySections(storyId);
    await fs.mkdir(safeStoryPath(storyId, "正文"), { recursive: true });

    let createdCount = 0;
    for (const section of sections) {
      const draftPath = safeStoryPath(storyId, path.join("正文", section.id));
      try {
        await fs.access(draftPath);
      } catch {
        const sectionOutline = await readOptionalFile(storyId, path.join("大纲", "章节", section.id));
        const chapter = parseChapterMarkdown(sectionOutline || "", section.title);
        const placeholder = [
          `# ${chapter.title}`,
          "",
          "## 写作提示",
          chapter.summary || "待补充",
          "",
          "## 正文",
          "",
        ].join("\n");
        await fs.writeFile(draftPath, placeholder, "utf-8");
        createdCount++;
      }
    }

    const meta = await readStoryMeta(storyId);
    meta.stage = sections.length > 0 ? "writing" : meta.stage;
    meta.updatedAt = new Date().toISOString();
    await writeStoryMeta(storyId, meta);

    return {
      success: true,
      data: {
        sectionCount: sections.length,
        createdCount,
      },
    };
  });

  fastify.post("/stories/:title/agent/chat", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const payload = storyAgentChatSchema.parse(req.body);
    const prompt = buildStoryWorkspacePrompt(storyId, payload);

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    try {
      for await (const chunk of piAgent.streamChat(
        `${req.user.userId}:story:${storyId}`,
        payload.content,
        prompt,
        (event) => {
          const text = event.type === "tool_execution_end"
            ? getToolStatusText(event.toolName, true, event.isError)
            : getToolStatusText(event.toolName);
          if (!text) return;
          sendSSE(reply, "progress", { type: "status", text });
        },
      )) {
        sendSSE(reply, "chunk", { type: "content", text: chunk });
      }

      sendSSE(reply, "done", { type: "complete" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 回复失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });
}
