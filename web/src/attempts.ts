import type { TestResult } from "./pythonTests";

export type StaticFinding = {
  source: "ast" | "ruff";
  code: string;
  message: string;
  line?: number;
  column?: number;
};

type SavedAttempt = { id: number; test_results: TestResult[]; static_findings: StaticFinding[] };

export async function postAttempt(
  apiUrl: string,
  accessToken: string,
  attempt: { problem_slug: string; code: string; test_results: TestResult[] },
): Promise<SavedAttempt> {
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attempt),
  });
  if (!response.ok) throw new Error("Attempt could not be saved.");
  return response.json();
}
