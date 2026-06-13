import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { piAgent } from "../lib/pi-agent.js";
import { initSSE, sendSSE, closeSSE } from "../lib/sse.js";
import { authGuard } from "../plugins/auth.js";
import {
  ensureStoryDirectories,
  parseChapterMarkdown,
  readOptionalFile,
  readStoryMeta,
  safeStoryPath,
  sanitizeFileName,
  scanStorySections,
  serializeChapterFile,
  storyExists,
  writeStoryMeta,
} from "../lib/story-workspace.js";

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

  fastify.post("/generate/setting", async (req, reply) => {
    const { storyId } = generateSettingSchema.parse(req.body);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在或缺少想法文件" },
      });
    }

    await ensureStoryDirectories(storyId);

    const meta = await readStoryMeta(storyId);
    const premise = await readOptionalFile(storyId, "想法.md");
    if (!premise) {
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

      await fs.writeFile(safeStoryPath(storyId, path.join("设定", "总设定.md")), fullText, "utf-8");
      await fs.writeFile(safeStoryPath(storyId, "设定.md"), fullText, "utf-8");

      meta.stage = "outline";
      meta.updatedAt = new Date().toISOString();
      await writeStoryMeta(storyId, meta);

      sendSSE(reply, "done", { type: "complete", data: fullText });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });

  fastify.post("/generate/outline", async (req, reply) => {
    const { storyId } = generateOutlineSchema.parse(req.body);
    if (!await storyExists(storyId)) {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "请先生成并确认故事设定" },
      });
    }

    const meta = await readStoryMeta(storyId);
    const settingContent = await readOptionalFile(storyId, path.join("设定", "总设定.md"))
      || await readOptionalFile(storyId, "设定.md");
    if (!settingContent) {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "请先生成并确认故事设定" },
      });
    }

    const targetWords = meta.targetWordCount || 5000;
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

      await fs.writeFile(safeStoryPath(storyId, path.join("大纲", "总纲.md")), fullText, "utf-8");
      await fs.writeFile(safeStoryPath(storyId, "大纲.md"), fullText, "utf-8");
      sendSSE(reply, "done", { type: "complete", data: fullText });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });

  fastify.post("/generate/outline/confirm", async (req, reply) => {
    const { storyId, text } = z.object({
      storyId: z.string(),
      text: z.string().min(1),
    }).parse(req.body);

    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    await ensureStoryDirectories(storyId);
    const meta = await readStoryMeta(storyId);
    await fs.writeFile(safeStoryPath(storyId, path.join("大纲", "总纲.md")), text, "utf-8");
    await fs.writeFile(safeStoryPath(storyId, "大纲.md"), text, "utf-8");

    const sections = parseOutlineSections(text);
    if (sections.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "大纲内容为空，无法拆分章节" },
      });
    }

    const chapterDir = safeStoryPath(storyId, path.join("大纲", "章节"));
    await fs.rm(chapterDir, { recursive: true, force: true });
    await fs.mkdir(chapterDir, { recursive: true });

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const num = String(i + 1).padStart(2, "0");
      const title = sanitizeFileName(section.title) || `第${i + 1}章`;
      const fileName = `${num}-${title}.md`;
      const content = serializeChapterFile({
        index: i + 1,
        title,
        summary: section.summary,
        targetWordCount: section.targetWordCount,
      });
      await fs.writeFile(path.join(chapterDir, fileName), content, "utf-8");
    }

    await fs.mkdir(safeStoryPath(storyId, "正文"), { recursive: true });
    meta.stage = "writing";
    meta.updatedAt = new Date().toISOString();
    await writeStoryMeta(storyId, meta);

    return { success: true, data: { sectionCount: sections.length } };
  });

  fastify.post("/generate/section", async (req, reply) => {
    const { storyId, sectionId } = generateSectionSchema.parse(req.body);
    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const meta = await readStoryMeta(storyId);
    const sectionOutline = await readOptionalFile(storyId, path.join("大纲", "章节", sectionId));
    if (!sectionOutline) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "大纲章节不存在" },
      });
    }

    const outlineData = parseChapterMarkdown(sectionOutline, sectionId);
    const settingContent = await readOptionalFile(storyId, path.join("设定", "总设定.md"))
      || await readOptionalFile(storyId, "设定.md");

    const sections = await scanStorySections(storyId);
    const currentSection = sections.find((section) => section.id === sectionId);
    const contextSummary = sections
      .filter((section) => section.sortOrder < (currentSection?.sortOrder || 0))
      .map((section) => `【${section.title}】${section.summary || section.content?.slice(0, 200) || ""}`)
      .join("\n");

    const prompt = `你是一位优秀的短篇小说作家。请根据以下信息创作正文。

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

      await fs.mkdir(safeStoryPath(storyId, "正文"), { recursive: true });
      await fs.writeFile(safeStoryPath(storyId, path.join("正文", sectionId)), fullText, "utf-8");

      let totalWords = 0;
      const draftDir = safeStoryPath(storyId, "正文");
      try {
        const files = await fs.readdir(draftDir);
        for (const file of files) {
          if (!file.endsWith(".md")) continue;
          const content = await fs.readFile(path.join(draftDir, file), "utf-8");
          totalWords += content.length;
        }
      } catch {
        // Ignore missing draft directory.
      }

      meta.currentWordCount = totalWords;
      meta.updatedAt = new Date().toISOString();
      await writeStoryMeta(storyId, meta);

      sendSSE(reply, "done", { type: "complete", sectionId, wordCount: fullText.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      sendSSE(reply, "error", { type: "error", message });
    } finally {
      closeSSE(reply);
    }
  });
}
