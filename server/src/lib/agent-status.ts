import path from "node:path";
import type { PiAgentStreamEvent } from "./pi-agent.js";

const MAX_STATUS_DETAIL_LENGTH = 44;

function truncateMiddle(value: string, maxLength = MAX_STATUS_DETAIL_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 1) / 2);
  const tailLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, headLength)}…${value.slice(value.length - tailLength)}`;
}

function normalizePathDisplay(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
  return truncateMiddle(normalized);
}

function formatPathLike(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return normalizePathDisplay(value);
}

function formatCommand(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const singleLine = value.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return null;
  }

  return truncateMiddle(singleLine);
}

function getPathArg(args: Record<string, unknown>): string | null {
  return formatPathLike(args.file_path ?? args.path);
}

function getSearchScope(args: Record<string, unknown>): string | null {
  const pattern = typeof args.pattern === "string" && args.pattern.trim()
    ? truncateMiddle(args.pattern.trim(), 24)
    : null;
  const scope = formatPathLike(args.path);

  if (pattern && scope) {
    return `${pattern} · ${scope}`;
  }

  return pattern ?? scope;
}

function getToolDetail(toolName: string, args: unknown): string | null {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return null;
  }

  const record = args as Record<string, unknown>;

  switch (toolName) {
    case "read":
    case "write":
    case "edit":
    case "ls":
      return getPathArg(record);
    case "find":
    case "grep":
      return getSearchScope(record);
    case "bash":
      return formatCommand(record.command);
    default:
      return null;
  }
}

function buildStartText(toolName: string, detail: string | null, readLabel: string): string {
  switch (toolName) {
    case "read":
      return detail ? `${readLabel}：${detail}` : readLabel;
    case "ls":
      return detail ? `正在查看目录：${detail}` : "正在查看目录...";
    case "find":
      return detail ? `正在查找文件：${detail}` : "正在查找文件...";
    case "grep":
      return detail ? `正在搜索内容：${detail}` : "正在搜索内容...";
    case "edit":
      return detail ? `正在修改文件：${detail}` : "正在修改文件...";
    case "write":
      return detail ? `正在写入文件：${detail}` : "正在写入文件...";
    case "bash":
      return detail ? `正在执行命令：${detail}` : "正在执行命令...";
    default:
      return `正在执行 ${toolName}...`;
  }
}

export function getToolStatusText(
  event: PiAgentStreamEvent,
  options?: { readLabel?: string },
): string | null {
  if (event.type === "tool_execution_end") {
    return event.isError ? "工具执行失败，正在继续处理..." : "工具执行完成，正在整理结果...";
  }

  const readLabel = options?.readLabel ?? "正在读取文件...";
  const detail = getToolDetail(event.toolName, event.args);
  return buildStartText(event.toolName, detail, readLabel);
}
