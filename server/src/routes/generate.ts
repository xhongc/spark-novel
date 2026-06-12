import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { piAgent } from "../lib/pi-agent.js";
import { initSSE, sendSSE, closeSSE } from "../lib/sse.js";
import { authGuard } from "../plugins/auth.js";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace", "novel");

function safePath(relativePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, relativePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("非法路径");
  }
  return resolved;
}

async function readMeta(dir: string): Promise<Record<string, unknown>> {
  const content = await fs.readFile(path.join(dir, "meta.md"), "utf-8");
  return JSON.parse(content);
}

async function writeMeta(dir: string, data: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(dir, "meta.md"), JSON.stringify(data, null, 2), "utf-8");
}

interface ParsedOutlineSection {
  title: string;
  summary: string;
  targetWordCount: number;
}

const chapterHeadingRegex = /^(#{2,6})\s*(?:第\s*([0-9零一二三四五六七八九十百千两]+)\s*(章|节|幕|回|篇|卷)|(?:chapter|chap\.?)\s*(\d+)|(\d+)[.、])\s*[:：\-、.]?\s*(.*)$/i;
const wordCountLineRegex = /^\s*>?\s*(?:预估|预计|目标)?\s*(?:总)?字数\s*[:：]?\s*(?:约\s*)?(\d+)\s*(?:字|words?)?\s*$/i;
const inlineWordCountRegex = /(\d+)\s*(?:字|words?)/i;

function sanitizeSectionTitle(title: string, fallbackIndex: number): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || `第${fallbackIndex}章`;
}

function isChapterHeading(line: string): boolean {
  return chapterHeadingRegex.test(line.trim());
}

function parseOutlineSections(text: string): ParsedOutlineSection[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headingIndexes: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isChapterHeading(lines[i])) {
      headingIndexes.push(i);
    }
  }

  if (headingIndexes.length === 0) {
    const summary = text.trim();
    if (!summary) return [];
    return [{
      title: "第1章",
      summary,
      targetWordCount: 1500,
    }];
  }

  const sections: ParsedOutlineSection[] = [];

  for (let i = 0; i < headingIndexes.length; i++) {
    const start = headingIndexes[i];
    const end = headingIndexes[i + 1] ?? lines.length;
    const [headingLine, ...bodyLines] = lines.slice(start, end);
    const headingMatch = headingLine.trim().match(chapterHeadingRegex);
    const rawTitle = headingMatch?.[6]?.trim() || `第${i + 1}章`;

    let targetWordCount = 1500;
    const summaryLines: string[] = [];

    for (const line of bodyLines) {
      const trimmed = line.trim();
      const wordCountLineMatch = trimmed.match(wordCountLineRegex);
      if (wordCountLineMatch) {
        targetWordCount = parseInt(wordCountLineMatch[1], 10);
        continue;
      }

      if (/字数|word count|words?/i.test(trimmed)) {
        const inlineWordCountMatch = trimmed.match(inlineWordCountRegex);
        if (inlineWordCountMatch) {
          targetWordCount = parseInt(inlineWordCountMatch[1], 10);
          continue;
        }
      }

      summaryLines.push(line);
    }

    const summary = summaryLines.join("\n").trim();
    sections.push({
      title: sanitizeSectionTitle(rawTitle, i + 1),
      summary,
      targetWordCount,
    });
  }

  return sections;
}

const generateSettingSchema = z.object({
  storyId: z.string(),
});

const generateOutlineSchema = z.object({
  storyId: z.string(),
});

const generateSectionSchema = z.object({
  storyId: z.string(),
  sectionId: z.string(),
});

export async function generateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  // 生成设定（SSE 流式）
  fastify.post("/generate/setting", async (req, reply) => {
    const { storyId } = generateSettingSchema.parse(req.body);
    const dir = safePath(storyId);

    let meta: Record<string, unknown>;
    let premise: string;
    try {
      meta = await readMeta(dir);
      premise = await fs.readFile(path.join(dir, "想法.md"), "utf-8");
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在或缺少想法文件" },
      });
    }

    const genre = meta.genre || "";

    const prompt = `你是一位专业的小说策划师。请根据以下故事创意生成详细的故事设定。

故事创意：${premise}
${genre ? `类型：${genre}` : ""}

请以 Markdown 格式输出，使用分层结构，包含以下部分：
- ## 主要人物（每个角色用 ### 小标题，包含角色名、身份、描述、动机）
- ## 主要场景（每个场景用 ### 小标题，包含场景名、描述、氛围）
- ## 时代背景
- ## 整体基调
- ## 主题（列表形式）
- ## 核心冲突

请直接输出 Markdown 内容。`;

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    let fullText = "";
    try {
      for await (const chunk of piAgent.stream(prompt)) {
        fullText += chunk;
        sendSSE(reply, "chunk", { type: "content", text: chunk });
      }

      // 写入设定文件（直接保存 Markdown 原文）
      await fs.writeFile(path.join(dir, "设定.md"), fullText, "utf-8");

      // 更新 meta
      meta.stage = "outline";
      meta.updatedAt = new Date().toISOString();
      await writeMeta(dir, meta);

      sendSSE(reply, "done", { type: "complete", data: fullText });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });

  // 生成大纲（SSE 流式，Markdown 格式）
  fastify.post("/generate/outline", async (req, reply) => {
    const { storyId } = generateOutlineSchema.parse(req.body);
    const dir = safePath(storyId);

    let meta: Record<string, unknown>;
    let settingContent: string;
    try {
      meta = await readMeta(dir);
      settingContent = await fs.readFile(path.join(dir, "设定.md"), "utf-8");
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "请先生成并确认故事设定" },
      });
    }

    const targetWords = (meta.targetWordCount as number) || 5000;
    const sectionCount = Math.max(3, Math.round(targetWords / 1500));

    const prompt = `你是一位专业的小说策划师。请根据以下故事设定生成分章大纲。

故事设定：
${settingContent}

目标总字数：${targetWords} 字
章节数量：约 ${sectionCount} 章

请以 Markdown 格式输出，每章使用以下结构：

### 第1章：章节标题
章节摘要内容...

> 预估字数：1500 字

### 第2章：章节标题
...

请直接输出 Markdown 内容。`;

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start" });

    let fullText = "";
    try {
      for await (const chunk of piAgent.stream(prompt)) {
        fullText += chunk;
        sendSSE(reply, "chunk", { type: "content", text: chunk });
      }

      // 保存大纲文件（Markdown 原文）
      await fs.writeFile(path.join(dir, "大纲.md"), fullText, "utf-8");

      sendSSE(reply, "done", { type: "complete", data: fullText });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });

  // 确认大纲：解析 Markdown → 创建小节大纲文件 → 进入写作阶段
  fastify.post("/generate/outline/confirm", async (req, reply) => {
    const { storyId, text } = z.object({
      storyId: z.string(),
      text: z.string().min(1),
    }).parse(req.body);

    const dir = safePath(storyId);

    let meta: Record<string, unknown>;
    try {
      meta = await readMeta(dir);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    // 保存确认后的大纲
    await fs.writeFile(path.join(dir, "大纲.md"), text, "utf-8");

    const sections = parseOutlineSections(text);

    if (sections.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "大纲内容为空，无法拆分章节" },
      });
    }

    // 清空并重建小节大纲目录
    const outlineDir = path.join(dir, "小节大纲");
    await fs.rm(outlineDir, { recursive: true, force: true });
    await fs.mkdir(outlineDir, { recursive: true });

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const num = String(i + 1).padStart(2, "0");
      const fileName = `${num}-${sec.title}.md`;
      const fileData = {
        title: sec.title,
        summary: sec.summary,
        targetWordCount: sec.targetWordCount,
        status: "review",
      };
      await fs.writeFile(path.join(outlineDir, fileName), JSON.stringify(fileData, null, 2), "utf-8");
    }

    // 创建正文目录
    await fs.mkdir(path.join(dir, "正文"), { recursive: true });

    // 更新 meta
    meta.stage = "writing";
    meta.updatedAt = new Date().toISOString();
    await writeMeta(dir, meta);

    return { success: true, data: { sectionCount: sections.length } };
  });

  // 生成章节正文（SSE 流式）
  fastify.post("/generate/section", async (req, reply) => {
    const { storyId, sectionId } = generateSectionSchema.parse(req.body);
    const dir = safePath(storyId);

    let meta: Record<string, unknown>;
    try {
      meta = await readMeta(dir);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    // 读取大纲文件
    const outlinePath = path.join(dir, "小节大纲", sectionId);
    let outlineData: { title: string; summary: string; targetWordCount: number; status: string };
    try {
      outlineData = JSON.parse(await fs.readFile(outlinePath, "utf-8"));
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "大纲章节不存在" },
      });
    }

    // 读取设定
    let settingContent: string | null = null;
    try {
      settingContent = await fs.readFile(path.join(dir, "设定.md"), "utf-8");
    } catch { /* 无设定 */ }

    // 读取前序正文作为上下文
    const outlineDir = path.join(dir, "小节大纲");
    const contentDir = path.join(dir, "正文");
    const match = sectionId.match(/^(\d+)-/);
    const currentNum = match ? parseInt(match[1], 10) : 0;

    const contextSummaryParts: string[] = [];
    try {
      const outlineFiles = await fs.readdir(outlineDir);
      for (const file of outlineFiles.sort()) {
        const fileMatch = file.match(/^(\d+)-/);
        if (!fileMatch) continue;
        const fileNum = parseInt(fileMatch[1], 10);
        if (fileNum >= currentNum) break;

        try {
          const oData = JSON.parse(await fs.readFile(path.join(outlineDir, file), "utf-8"));
          let contentPreview = "";
          try {
            const content = await fs.readFile(path.join(contentDir, file), "utf-8");
            contentPreview = content.slice(0, 200);
          } catch { /* 无正文 */ }
          contextSummaryParts.push(`【${oData.title}】${oData.summary || contentPreview || ""}`);
        } catch { /* 跳过 */ }
      }
    } catch { /* 无大纲目录 */ }

    const contextSummary = contextSummaryParts.join("\n");

    const prompt = `你是一位优秀的短篇小说作家。请根据以下信息创作第 ${currentNum} 章的正文。

${settingContent ? `故事设定：\n${settingContent}` : ""}

本章标题：${outlineData.title}
本章摘要：${outlineData.summary || "无"}
${outlineData.targetWordCount ? `目标字数：约 ${outlineData.targetWordCount} 字` : ""}
${contextSummary ? `\n前文内容摘要：\n${contextSummary}` : ""}

请直接输出正文内容，不要包含标题、章节号或任何元信息。`;

    initSSE(reply);
    sendSSE(reply, "progress", { type: "start", sectionId });

    let fullText = "";
    try {
      for await (const chunk of piAgent.stream(prompt)) {
        fullText += chunk;
        sendSSE(reply, "chunk", { type: "content", text: chunk });
      }

      // 写入正文文件
      await fs.writeFile(path.join(contentDir, sectionId), fullText, "utf-8");

      // 更新大纲状态
      outlineData.status = "review";
      await fs.writeFile(outlinePath, JSON.stringify(outlineData, null, 2), "utf-8");

      // 计算总字数并更新 meta
      let totalWords = 0;
      try {
        const contentFiles = await fs.readdir(contentDir);
        for (const file of contentFiles) {
          if (!file.endsWith(".md")) continue;
          const content = await fs.readFile(path.join(contentDir, file), "utf-8");
          totalWords += content.length;
        }
      } catch { /* 无正文目录 */ }

      meta.currentWordCount = totalWords;
      meta.updatedAt = new Date().toISOString();
      await writeMeta(dir, meta);

      sendSSE(reply, "done", { type: "complete", sectionId, wordCount: fullText.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });
}
