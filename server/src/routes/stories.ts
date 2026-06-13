import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../plugins/auth.js";
import {
  STORY_WORKSPACE_ROOT,
  ensureStoryDirectories,
  readOptionalFile,
  readStoryMeta,
  safeStoryDir,
  scanStorySections,
  storyExists,
  writeStoryMeta,
} from "../lib/story-workspace.js";

const createStorySchema = z.object({
  title: z.string().min(1).max(100),
  premise: z.string().min(1).max(50000),
  genre: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
});

const updateStorySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  stage: z.enum(["setting", "outline", "writing", "completed"]).optional(),
  setting: z.string().optional(),
  currentWordCount: z.number().int().optional(),
});

async function getSettingSummary(storyId: string): Promise<string | null> {
  const settingIndex = await readOptionalFile(storyId, path.join("设定", "总设定.md"));
  if (settingIndex) return settingIndex;
  return readOptionalFile(storyId, "设定.md");
}

async function getOutlineSummary(storyId: string): Promise<string | null> {
  const outlineIndex = await readOptionalFile(storyId, path.join("大纲", "总纲.md"));
  if (outlineIndex) return outlineIndex;
  return readOptionalFile(storyId, "大纲.md");
}

async function getPremise(storyId: string): Promise<string> {
  return (await readOptionalFile(storyId, "想法.md")) || "";
}

export async function storyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  fastify.get("/stories", async () => {
    const entries = await fs.readdir(STORY_WORKSPACE_ROOT, { withFileTypes: true });
    const stories = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      try {
        const storyId = entry.name;
        const meta = await readStoryMeta(storyId);
        const setting = await getSettingSummary(storyId);
        const sections = await scanStorySections(storyId);

        stories.push({
          id: storyId,
          title: storyId,
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
      } catch {
        // Skip invalid story directory.
      }
    }

    stories.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());
    return { success: true, data: { items: stories, total: stories.length } };
  });

  fastify.get("/stories/:title", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);

    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    const meta = await readStoryMeta(storyId);
    const setting = await getSettingSummary(storyId);
    const outline = await getOutlineSummary(storyId);
    const premise = await getPremise(storyId);
    const sections = await scanStorySections(storyId);

    return {
      success: true,
      data: {
        id: storyId,
        title: storyId,
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

  fastify.post("/stories", async (req, reply) => {
    const data = createStorySchema.parse(req.body);
    const storyDir = safeStoryDir(data.title);

    try {
      await fs.access(storyDir);
      return reply.status(409).send({
        success: false,
        error: { code: "CONFLICT", message: "同名故事已存在" },
      });
    } catch {
      // Directory does not exist.
    }

    await ensureStoryDirectories(data.title);

    const now = new Date().toISOString();
    await writeStoryMeta(data.title, {
      stage: "setting",
      genre: data.genre || null,
      targetWordCount: data.targetWordCount || 5000,
      currentWordCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await fs.writeFile(path.join(storyDir, "想法.md"), data.premise, "utf-8");
    await fs.writeFile(path.join(storyDir, "设定", "总设定.md"), "", "utf-8");
    await fs.writeFile(path.join(storyDir, "大纲", "总纲.md"), "", "utf-8");

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

  fastify.put("/stories/:title", async (req, reply) => {
    const title = decodeURIComponent((req.params as { title: string }).title);
    const data = updateStorySchema.parse(req.body);
    const storyDir = safeStoryDir(title);

    if (!await storyExists(title)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    let currentTitle = title;
    let currentDir = storyDir;

    if (data.title && data.title !== title) {
      const nextDir = safeStoryDir(data.title);
      try {
        await fs.access(nextDir);
        return reply.status(409).send({
          success: false,
          error: { code: "CONFLICT", message: "同名故事已存在" },
        });
      } catch {
        // Destination directory does not exist.
      }

      await fs.rename(storyDir, nextDir);
      currentTitle = data.title;
      currentDir = nextDir;
    }

    await ensureStoryDirectories(currentTitle);

    const meta = await readStoryMeta(currentTitle);
    const now = new Date().toISOString();
    if (data.stage) meta.stage = data.stage;
    if (data.currentWordCount !== undefined) meta.currentWordCount = data.currentWordCount;
    meta.updatedAt = now;
    await writeStoryMeta(currentTitle, meta);

    if (data.setting !== undefined) {
      await fs.writeFile(path.join(currentDir, "设定", "总设定.md"), data.setting, "utf-8");
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

  fastify.delete("/stories/:title", async (req, reply) => {
    const storyId = decodeURIComponent((req.params as { title: string }).title);
    const storyDir = safeStoryDir(storyId);

    if (!await storyExists(storyId)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "故事不存在" },
      });
    }

    await fs.rm(storyDir, { recursive: true });
    return { success: true, data: null };
  });
}
