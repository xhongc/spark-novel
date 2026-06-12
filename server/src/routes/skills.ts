import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../plugins/auth.js";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace", ".pi", "skills");

// 解析 SKILL.md frontmatter 中的 description
async function parseSkillDescription(skillMdPath: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(skillMdPath, "utf-8");
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return undefined;
    const fm = match[1];

    // 引号格式: description: "..."
    const quoted = fm.match(/description:\s*"([^"]*)"/);
    if (quoted) return quoted[1].trim();

    // 多行格式: description: |  (以下一个顶层 key 或 frontmatter 结尾)
    const block = fm.match(/description:\s*\|\s*\n([\s\S]*?)(?=\n\w+:|\s*$)/);
    if (block) {
      return block[1]
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join(" ");
    }

    return undefined;
  } catch {
    return undefined;
  }
}

// 确保根目录存在
await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

function safePath(relativePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, relativePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("非法路径");
  }
  return resolved;
}

interface SkillItem {
  id: string;
  name: string;
  type: "folder" | "file";
  parentId: string | null;
  description?: string;
  updatedAt: string;
}

function getParentId(relativePath: string): string | null {
  const parentId = path.dirname(relativePath);
  return parentId === "." ? null : parentId;
}

function getMatchScore(value: string, query: string): number {
  if (!query) return 0;

  const normalizedValue = value.toLowerCase();
  if (normalizedValue === query) return 0;
  if (normalizedValue.startsWith(query)) return 1;

  const index = normalizedValue.indexOf(query);
  if (index >= 0) return 10 + index;

  return Number.MAX_SAFE_INTEGER;
}

async function collectTopLevelSkillFolders(): Promise<SkillItem[]> {
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  const items: SkillItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || !entry.isDirectory()) continue;

    const absPath = path.join(WORKSPACE_ROOT, entry.name);
    const stat = await fs.stat(absPath);

    items.push({
      id: entry.name,
      name: entry.name,
      type: "folder",
      parentId: null,
      description: await parseSkillDescription(path.join(absPath, "SKILL.md")),
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return items;
}

export async function skillRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  // 统计技能数量（递归）
  fastify.get("/skills/stats", async () => {
    async function countDir(dir: string): Promise<{ files: number; folders: number }> {
      let files = 0;
      let folders = 0;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          if (entry.isDirectory()) {
            folders++;
            const sub = await countDir(path.join(dir, entry.name));
            files += sub.files;
            folders += sub.folders;
          } else {
            files++;
          }
        }
      } catch {
        // 目录不存在
      }
      return { files, folders };
    }
    const stats = await countDir(WORKSPACE_ROOT);
    return { success: true, data: stats };
  });

  fastify.get("/skills/search", async (req, reply) => {
    const { q = "", limit = 6 } = z.object({
      q: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(20).optional(),
    }).parse(req.query);

    try {
      const query = q.trim().toLowerCase();
      const items = await collectTopLevelSkillFolders();
      const matches = items
        .filter((item) => (
          item.type === "folder"
          && (
            !query
            || item.name.toLowerCase().includes(query)
          )
        ))
        .sort((a, b) => {
          const scoreDiff = getMatchScore(a.name, query) - getMatchScore(b.name, query);
          if (scoreDiff !== 0) return scoreDiff;

          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;

          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
        .slice(0, limit);

      return { success: true, data: matches };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "搜索技能失败" },
      });
    }
  });

  // 列出目录内容
  fastify.get("/skills", async (req, reply) => {
    const { path: dirPath = "" } = req.query as { path?: string };
    const absDir = safePath(dirPath);

    try {
      await fs.mkdir(absDir, { recursive: true });
      const entries = await fs.readdir(absDir, { withFileTypes: true });
      const items: SkillItem[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const entryPath = path.join(dirPath, entry.name);
        const stat = await fs.stat(path.join(absDir, entry.name));
        const item: SkillItem = {
          id: entryPath,
          name: entry.name,
          type: entry.isDirectory() ? "folder" : "file",
          parentId: dirPath || null,
          updatedAt: stat.mtime.toISOString(),
        };
        if (entry.isDirectory()) {
          item.description = await parseSkillDescription(
            path.join(absDir, entry.name, "SKILL.md")
          );
        }
        items.push(item);
      }

      // 文件夹排前面，文件按修改时间倒序
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return { success: true, data: items };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "读取目录失败" },
      });
    }
  });

  // 创建文件夹
  fastify.post("/skills/folder", async (req, reply) => {
    const { name, parentId = "" } = z.object({
      name: z.string().min(1).max(100),
      parentId: z.string().optional(),
    }).parse(req.body);

    const relativePath = path.join(parentId || "", name);
    const absPath = safePath(relativePath);

    try {
      await fs.mkdir(absPath, { recursive: true });
      const stat = await fs.stat(absPath);
      return {
        success: true,
        data: {
          id: relativePath,
          name,
          type: "folder" as const,
          parentId: parentId || null,
          updatedAt: stat.mtime.toISOString(),
        },
      };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "创建文件夹失败" },
      });
    }
  });

  // 创建 md 文件
  fastify.post("/skills/file", async (req, reply) => {
    const { name, parentId = "", content = "" } = z.object({
      name: z.string().min(1).max(100),
      parentId: z.string().optional(),
      content: z.string().optional(),
    }).parse(req.body);

    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const relativePath = path.join(parentId || "", fileName);
    const absPath = safePath(relativePath);

    try {
      // 确保父目录存在
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
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "创建文件失败" },
      });
    }
  });

  // 读取文件内容
  fastify.get("/skills/file", async (req, reply) => {
    const { path: filePath } = req.query as { path: string };
    if (!filePath) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_PATH", message: "缺少 path 参数" },
      });
    }

    const absPath = safePath(filePath);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      return { success: true, data: { content } };
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "文件不存在" },
      });
    }
  });

  // 保存文件内容
  fastify.put("/skills/file", async (req, reply) => {
    const { path: filePath, content } = z.object({
      path: z.string(),
      content: z.string(),
    }).parse(req.body);

    const absPath = safePath(filePath);
    try {
      await fs.writeFile(absPath, content, "utf-8");
      const stat = await fs.stat(absPath);
      return {
        success: true,
        data: { updatedAt: stat.mtime.toISOString() },
      };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "保存失败" },
      });
    }
  });

  // 重命名
  fastify.put("/skills/rename", async (req, reply) => {
    const { path: oldPath, newName } = z.object({
      path: z.string(),
      newName: z.string().min(1).max(100),
    }).parse(req.body);

    const absOld = safePath(oldPath);
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    const absNew = safePath(newPath);

    try {
      await fs.rename(absOld, absNew);
      return {
        success: true,
        data: { id: newPath, name: newName },
      };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "重命名失败" },
      });
    }
  });

  // 删除
  fastify.delete("/skills", async (req, reply) => {
    const { path: targetPath } = req.body as { path: string };
    if (!targetPath) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_PATH", message: "缺少 path 参数" },
      });
    }

    const absPath = safePath(targetPath);
    try {
      await fs.rm(absPath, { recursive: true });
      return { success: true, data: null };
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: "FS_ERROR", message: "删除失败" },
      });
    }
  });
}
