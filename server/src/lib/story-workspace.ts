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

export interface ParsedOutlineSection {
  index: number;
  title: string;
  summary: string;
  targetWordCount: number;
}

const chapterHeadingRegex = /^\s*#\s*(.+)\s*$/;
const summaryHeadingRegex = /^\s*##\s*摘要\s*$/;
const targetHeadingRegex = /^\s*##\s*目标字数\s*$/;
const outlineLevelThreeHeadingRegex = /^###\s+(.+?)\s*$/;
const outlineBlockHeadingRegex = /^\*\*([^*]+)\*\*[:：]\s*(.*)$/;
const summaryBlockLabels = new Set([
  "内容",
  "情节要点",
  "剧情梗概",
  "章节内容",
  "核心情节",
]);

const chineseDigitMap: Record<string, number> = {
  "零": 0,
  "〇": 0,
  "一": 1,
  "二": 2,
  "两": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "七": 7,
  "八": 8,
  "九": 9,
};

const chineseUnitMap: Record<string, number> = {
  "十": 10,
  "百": 100,
  "千": 1000,
  "万": 10000,
};

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

export function buildChapterFileName(index: number, title: string): string {
  const safeTitle = sanitizeFileName(title).replace(/\.md$/i, "").trim() || `第${index}节`;
  return `${String(index).padStart(2, "0")}-${safeTitle}.md`;
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

function normalizeOutlineSummary(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/^\s*-\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSectionIndex(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return parseInt(normalized, 10);
  }

  let total = 0;
  let currentNumber = 0;

  for (const char of normalized) {
    if (char in chineseDigitMap) {
      currentNumber = chineseDigitMap[char];
      continue;
    }

    if (char in chineseUnitMap) {
      const unit = chineseUnitMap[char];
      total += (currentNumber || 1) * unit;
      currentNumber = 0;
      continue;
    }

    return null;
  }

  return total + currentNumber || null;
}

function parseOutlineSectionHeading(rawLine: string): ParsedOutlineSection | null {
  const headingContent = rawLine.match(outlineLevelThreeHeadingRegex)?.[1]?.trim();
  if (!headingContent) {
    return null;
  }

  const normalizedHeading = headingContent.replace(/^#+\s*/, "").trim();
  const patterns = [
    /^第\s*([零〇一二三四五六七八九十百千万两\d]+)\s*章(?:\s*[:：]\s*|\s+)(.+?)(?:（约\s*(\d+)\s*字）)?$/,
    /^#+\s*(\d+)\.?\s+(.+?)(?:（约\s*(\d+)\s*字）)?$/,
    /^(\d+)[.、]?\s+(.+?)(?:（约\s*(\d+)\s*字）)?$/,
  ];

  for (const pattern of patterns) {
    const match = normalizedHeading.match(pattern);
    if (!match) {
      continue;
    }

    const index = parseSectionIndex(match[1]);
    if (!index) {
      return null;
    }

    return {
      index,
      title: match[2].trim(),
      summary: "",
      targetWordCount: parseInt(match[3] || "1500", 10),
    };
  }

  return null;
}

export function parseOutlineSections(content: string): ParsedOutlineSection[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections: ParsedOutlineSection[] = [];

  let current: ParsedOutlineSection | null = null;
  let captureSummary = false;
  let summaryLines: string[] = [];

  const flushCurrent = () => {
    if (!current) return;

    const summary = normalizeOutlineSummary(summaryLines);
    sections.push({
      ...current,
      summary: summary || "待补充",
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = parseOutlineSectionHeading(rawLine);

    if (heading) {
      flushCurrent();
      current = heading;
      captureSummary = false;
      summaryLines = [];
      continue;
    }

    if (!current) continue;

    const blockHeading = line.match(outlineBlockHeadingRegex);
    if (blockHeading) {
      const label = blockHeading[1].trim();
      const inlineContent = blockHeading[2].trim();
      captureSummary = summaryBlockLabels.has(label);
      if (captureSummary && inlineContent) {
        summaryLines.push(inlineContent);
      }
      continue;
    }

    if (/^---\s*$/.test(line)) {
      if (captureSummary) {
        captureSummary = false;
      }
      continue;
    }

    if (captureSummary) {
      summaryLines.push(rawLine);
    }
  }

  flushCurrent();

  return sections.filter((section) => Number.isFinite(section.index) && section.index > 0 && section.title);
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
