import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../plugins/auth.js";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace", "novel");

await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

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

function parseOutlineFile(filename: string): { sortOrder: number; title: string } | null {
  const match = filename.match(/^(\d+)-(.+)\.md$/);
  if (!match) return null;
  return { sortOrder: parseInt(match[1], 10), title: match[2] };
}

interface OutlineEntry {
  id: string;
  sortOrder: number;
  title: string;
  summary: string;
  targetWordCount: number;
  status: string;
  content?: string | null;
  wordCount?: number;
}

function normalizeSectionStatus(status: string | undefined): string {
  return !status || status === "locked" ? "review" : status;
}

async function scanOutlines(dir: string): Promise<OutlineEntry[]> {
  const outlineDir = path.join(dir, "小节大纲");
  try {
    const entries = await fs.readdir(outlineDir);
    const results: OutlineEntry[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const parsed = parseOutlineFile(entry);
      if (!parsed) continue;

      try {
        const content = await fs.readFile(path.join(outlineDir, entry), "utf-8");
        const data = JSON.parse(content);
        results.push({
          id: entry,
          sortOrder: parsed.sortOrder,
          title: data.title || parsed.title,
          summary: data.summary || "",
          targetWordCount: data.targetWordCount || 1500,
          status: normalizeSectionStatus(data.status),
        });
      } catch {
        // 跳过解析失败的文件
      }
    }

    results.sort((a, b) => a.sortOrder - b.sortOrder);
    return results;
  } catch {
    return [];
  }
}

const createStorySchema = z.object({
  title: z.string().min(1).max(100),
  premise: z.string().min(1).max(2000),
  genre: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
});

const updateStorySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  stage: z.enum(["setting", "outline", "writing", "completed"]).optional(),
  setting: z.string().optional(),
  currentWordCount: z.number().int().optional(),
});

export async function storyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  // 故事列表
  fastify.get("/stories", async () => {
    const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
    const stories = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const dir = path.join(WORKSPACE_ROOT, entry.name);
        const meta = await readMeta(dir);
        const settingPath = path.join(dir, "设定.md");
        let setting: string | null = null;
        try {
          setting = await fs.readFile(settingPath, "utf-8");
        } catch { /* 无设定文件 */ }

        const sections = await scanOutlines(dir);
        stories.push({
          id: entry.name,
          title: entry.name,
          premise: "",
          stage: meta.stage || "setting",
          genre: meta.genre || null,
          targetWordCount: meta.targetWordCount || null,
          currentWordCount: meta.currentWordCount || 0,
          setting,
          sectionCount: sections.length,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
        });
      } catch { /* 跳过无效目录 */ }
    }

    stories.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());
    return { success: true, data: { items: stories, total: stories.length } };
  });

  // 故事详情
  fastify.get("/stories/:title", async (req, reply) => {
    const title = decodeURIComponent((req.params as { title: string }).title);
    const dir = safePath(title);

    try {
      await fs.access(dir);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const meta = await readMeta(dir);
    const settingPath = path.join(dir, "设定.md");
    let setting: string | null = null;
    try {
      setting = await fs.readFile(settingPath, "utf-8");
    } catch { /* 无设定文件 */ }

    const ideaPath = path.join(dir, "想法.md");
    let premise = "";
    try {
      premise = await fs.readFile(ideaPath, "utf-8");
    } catch { /* 无想法文件 */ }

    const sections = await scanOutlines(dir);

    // 读取大纲全文
    const outlinePath = path.join(dir, "大纲.md");
    let outline: string | null = null;
    try {
      outline = await fs.readFile(outlinePath, "utf-8");
    } catch { /* 无大纲文件 */ }

    // 读取正文内容
    const contentDir = path.join(dir, "正文");
    for (const section of sections) {
      try {
        const content = await fs.readFile(path.join(contentDir, section.id), "utf-8");
        section.content = content;
        section.wordCount = content.length;
      } catch {
        section.content = null;
        section.wordCount = 0;
      }
    }

    return {
      success: true,
      data: {
        id: title,
        title,
        premise,
        stage: meta.stage || "setting",
        genre: meta.genre || null,
        targetWordCount: meta.targetWordCount || null,
        currentWordCount: meta.currentWordCount || 0,
        setting,
        outline,
        sectionCount: sections.length,
        sections,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      },
    };
  });

  // 创建故事
  fastify.post("/stories", async (req, reply) => {
    const data = createStorySchema.parse(req.body);
    const dir = safePath(data.title);

    try {
      await fs.access(dir);
      return reply.status(409).send({
        success: false,
        error: { code: "CONFLICT", message: "同名故事已存在" },
      });
    } catch { /* 目录不存在，可以创建 */ }

    await fs.mkdir(dir, { recursive: true });

    const now = new Date().toISOString();
    await writeMeta(dir, {
      stage: "setting",
      genre: data.genre || null,
      targetWordCount: data.targetWordCount || 5000,
      currentWordCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await fs.writeFile(path.join(dir, "想法.md"), data.premise, "utf-8");

    return {
      success: true,
      data: {
        id: data.title,
        title: data.title,
        premise: data.premise,
        stage: "setting",
        genre: data.genre || null,
        targetWordCount: data.targetWordCount || 5000,
        currentWordCount: 0,
        setting: null,
        sectionCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // 更新故事
  fastify.put("/stories/:title", async (req, reply) => {
    const title = decodeURIComponent((req.params as { title: string }).title);
    const data = updateStorySchema.parse(req.body);
    const dir = safePath(title);

    try {
      await fs.access(dir);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    // 处理标题重命名（重命名目录）
    let currentTitle = title;
    let currentDir = dir;
    if (data.title && data.title !== title) {
      const newDir = safePath(data.title);
      try {
        await fs.access(newDir);
        return reply.status(409).send({
          success: false,
          error: { code: "CONFLICT", message: "同名故事已存在" },
        });
      } catch { /* 新目录不存在，可以重命名 */ }

      await fs.rename(dir, newDir);
      currentTitle = data.title;
      currentDir = newDir;
    }

    const meta = await readMeta(currentDir);
    const now = new Date().toISOString();

    if (data.stage) meta.stage = data.stage;
    if (data.currentWordCount !== undefined) meta.currentWordCount = data.currentWordCount;
    meta.updatedAt = now;
    await writeMeta(currentDir, meta);

    if (data.setting !== undefined) {
      await fs.writeFile(path.join(currentDir, "设定.md"), data.setting, "utf-8");
    }

    return {
      success: true,
      data: {
        id: currentTitle,
        title: currentTitle,
        stage: meta.stage,
        setting: data.setting || null,
        currentWordCount: meta.currentWordCount,
        updatedAt: now,
      },
    };
  });

  // 删除故事
  fastify.delete("/stories/:title", async (req, reply) => {
    const title = decodeURIComponent((req.params as { title: string }).title);
    const dir = safePath(title);

    try {
      await fs.access(dir);
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    await fs.rm(dir, { recursive: true });
    return { success: true, data: null };
  });
}
