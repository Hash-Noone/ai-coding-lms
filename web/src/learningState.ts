import { problems } from "virtual:problem-bank";
import { courses } from "./courses";

export const SOLVED_STORAGE_KEY = "ai-coding-lms:solved";
export const ENROLLED_STORAGE_KEY = "ai-coding-lms:enrolled";

export function readStoredList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === "string"))] : [];
  } catch {
    return [];
  }
}

export function saveStoredList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Practice remains available when browser storage is unavailable.
  }
}

export function loadSolved() {
  return readStoredList(SOLVED_STORAGE_KEY).filter((slug) => problems.some((problem) => problem.slug === slug));
}

export function loadEnrolled() {
  return readStoredList(ENROLLED_STORAGE_KEY).filter((slug) => courses.some((course) => course.slug === slug));
}
