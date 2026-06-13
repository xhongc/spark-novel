import path from "node:path";
import fs from "node:fs/promises";

export const STORY_WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace", "novel");

await fs.mkdir(STORY_WORKSPACE_ROOT, { recursive: true });

export interface StoryMeta {
  stage: "setting" | "outline" | "writing" | "completed";
  genre: string | null;
  targetWordCount: number | null;
  currentWordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryWorkspaceItem {
  id: string;
  name: string;
  type: "folder" | "file";
  parentId: string | null;
  updatedAt: string;
}

export interface StorySectionData {
  id: string;
  sortOrder: number;
  title: string;
  summary: string;
  targetWordCount: number;
  status: string;
  content: string | null;
  wordCount: number;
}

const chapterHeadingRegex = /^\s*#\s*(.+)\s*$/;
const summaryHeadingRegex = /^\s*##\s*摘要\s*$/;
const targetHeadingRegex = /^\s*##\s*目标字数\s*$/;

export function safeStoryDir(storyId: string): string {
  const resolved = path.resolve(STORY_WORKSPACE_ROOT, storyId);
  if (!resolved.startsWith(STORY_WORKSPACE_ROOT)) {
    throw new Error("非法路径");
  }
  return resolved;
}

export function safeStoryPath(storyId: string, relativePath = ""): string {
  const storyDir = safeStoryDir(storyId);
  const resolved = path.resolve(storyDir, relativePath);
  if (!resolved.startsWith(storyDir)) {
    throw new Error("非法路径");
  }
  return resolved;
}

export async function storyExists(storyId: string): Promise<boolean> {
  try {
    await fs.access(safeStoryDir(storyId));
    return true;
  } catch {
    return false;
  }
}

export async function ensureStoryDirectories(storyId: string): Promise<void> {
  await Promise.all([
    fs.mkdir(safeStoryDir(storyId), { recursive: true }),
    fs.mkdir(safeStoryPath(storyId, "设定"), { recursive: true }),
    fs.mkdir(safeStoryPath(storyId, path.join("大纲", "章节")), { recursive: true }),
    fs.mkdir(safeStoryPath(storyId, "正文"), { recursive: true }),
  ]);
}

export async function readStoryMeta(storyId: string): Promise<StoryMeta> {
  const storyDir = safeStoryDir(storyId);
  const metaJsonPath = path.join(storyDir, "meta.json");
  const legacyMetaPath = path.join(storyDir, "meta.md");

  try {
    const content = await fs.readFile(metaJsonPath, "utf-8");
    return JSON.parse(content) as StoryMeta;
  } catch {
    const content = await fs.readFile(legacyMetaPath, "utf-8");
    return JSON.parse(content) as StoryMeta;
  }
}

export async function writeStoryMeta(storyId: string, meta: StoryMeta): Promise<void> {
  const storyDir = safeStoryDir(storyId);
  await fs.writeFile(path.join(storyDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}

export async function readOptionalFile(storyId: string, relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(safeStoryPath(storyId, relativePath), "utf-8");
  } catch {
    return null;
  }
}

export function getParentId(relativePath: string): string | null {
  const parentId = path.dirname(relativePath);
  return parentId === "." ? null : parentId;
}

export async function listStoryWorkspace(storyId: string, relativePath = ""): Promise<StoryWorkspaceItem[]> {
  const dir = safeStoryPath(storyId, relativePath);
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items: StoryWorkspaceItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(relativePath, entry.name);
    const stat = await fs.stat(path.join(dir, entry.name));
    items.push({
      id: entryPath,
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file",
      parentId: relativePath || null,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return items;
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

async function collectStoryFiles(
  storyId: string,
  scopePath = "",
  relativeDir = "",
): Promise<StoryWorkspaceItem[]> {
  const currentDir = relativeDir ? path.join(scopePath, relativeDir) : scopePath;
  const dir = safeStoryPath(storyId, currentDir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items: StoryWorkspaceItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const childRelativeDir = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const itemId = path.join(scopePath, childRelativeDir);
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      items.push(...await collectStoryFiles(storyId, scopePath, childRelativeDir));
      continue;
    }

    const stat = await fs.stat(absPath);
    items.push({
      id: itemId,
      name: entry.name,
      type: "file",
      parentId: getParentId(itemId),
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return items;
}

export async function searchStoryWorkspace(
  storyId: string,
  query: string,
  limit: number,
  scopePath = "",
): Promise<StoryWorkspaceItem[]> {
  const items = await collectStoryFiles(storyId, scopePath);
  const normalizedQuery = query.trim().toLowerCase();

  return items
    .filter((item) => (
      !normalizedQuery
      || item.name.toLowerCase().includes(normalizedQuery)
      || item.id.toLowerCase().includes(normalizedQuery)
    ))
    .sort((a, b) => {
      const scoreDiff = getMatchScore(a.name, normalizedQuery) - getMatchScore(b.name, normalizedQuery);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit);
}

export function parseChapterFileName(filename: string): { sortOrder: number; title: string } | null {
  const match = filename.match(/^(\d+)-(.+)\.md$/);
  if (!match) return null;
  return { sortOrder: parseInt(match[1], 10), title: match[2] };
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function serializeChapterFile(input: {
  index: number;
  title: string;
  summary: string;
  targetWordCount: number;
}): string {
  return [
    `# 第${input.index}章 ${input.title}`,
    "",
    "## 摘要",
    input.summary.trim() || "待补充",
    "",
    "## 目标字数",
    String(input.targetWordCount || 1500),
    "",
  ].join("\n");
}

export function parseChapterMarkdown(content: string, fallbackTitle: string): {
  title: string;
  summary: string;
  targetWordCount: number;
} {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const title = lines[0]?.match(chapterHeadingRegex)?.[1]?.trim() || fallbackTitle;

  let currentBlock: "summary" | "target" | null = null;
  const summaryLines: string[] = [];
  const targetLines: string[] = [];

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (summaryHeadingRegex.test(line)) {
      currentBlock = "summary";
      continue;
    }
    if (targetHeadingRegex.test(line)) {
      currentBlock = "target";
      continue;
    }

    if (currentBlock === "summary") {
      summaryLines.push(rawLine);
    } else if (currentBlock === "target") {
      targetLines.push(rawLine);
    }
  }

  const summary = summaryLines.join("\n").trim();
  const targetWordCount = parseInt(targetLines.join(" ").match(/\d+/)?.[0] || "1500", 10);

  return {
    title,
    summary,
    targetWordCount: Number.isFinite(targetWordCount) ? targetWordCount : 1500,
  };
}

export async function scanStorySections(storyId: string): Promise<StorySectionData[]> {
  const newOutlineDir = safeStoryPath(storyId, path.join("大纲", "章节"));
  const legacyOutlineDir = safeStoryPath(storyId, "小节大纲");

  let entries: string[] = [];
  let useLegacyJson = false;

  try {
    entries = (await fs.readdir(newOutlineDir)).filter((entry) => entry.endsWith(".md"));
  } catch {
    // Ignore.
  }

  if (entries.length === 0) {
    try {
      entries = await fs.readdir(legacyOutlineDir);
      useLegacyJson = true;
    } catch {
      return [];
    }
  }

  const results: StorySectionData[] = [];

  for (const entry of entries) {
    const parsed = parseChapterFileName(entry);
    if (!parsed) continue;

    try {
      const outlinePath = useLegacyJson
        ? path.join(legacyOutlineDir, entry)
        : path.join(newOutlineDir, entry);
      const raw = await fs.readFile(outlinePath, "utf-8");

      const chapterData = useLegacyJson
        ? (() => {
          const legacy = JSON.parse(raw) as { title?: string; summary?: string; targetWordCount?: number; status?: string };
          return {
            title: legacy.title || parsed.title,
            summary: legacy.summary || "",
            targetWordCount: legacy.targetWordCount || 1500,
            status: legacy.status || "review",
          };
        })()
        : (() => {
          const next = parseChapterMarkdown(raw, parsed.title);
          return {
            ...next,
            status: "review",
          };
        })();

      let content: string | null = null;
      let wordCount = 0;
      try {
        content = await fs.readFile(safeStoryPath(storyId, path.join("正文", entry)), "utf-8");
        wordCount = content.length;
      } catch {
        content = null;
      }

      results.push({
        id: entry,
        sortOrder: parsed.sortOrder,
        title: chapterData.title,
        summary: chapterData.summary,
        targetWordCount: chapterData.targetWordCount,
        status: chapterData.status,
        content,
        wordCount,
      });
    } catch {
      // Skip invalid section files.
    }
  }

  results.sort((a, b) => a.sortOrder - b.sortOrder);
  return results;
}
