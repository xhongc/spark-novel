import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const chapterHeadingRegex = /^(#{2,6})\s*(?:第\s*([0-9零一二三四五六七八九十百千两]+)\s*(章|节|幕|回|篇|卷)|(?:chapter|chap\.?)\s*(\d+)|(\d+)[.、])\s*[:：\-、.]?\s*(.*)$/i

export function countOutlineSections(text: string): number {
  const normalized = text.replace(/\r\n/g, "\n")
  const count = normalized
    .split("\n")
    .filter(line => chapterHeadingRegex.test(line.trim()))
    .length

  if (count > 0) return count
  return normalized.trim() ? 1 : 0
}
