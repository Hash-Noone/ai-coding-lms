import type { TestResult } from "./pythonTests";

export async function postAttempt(
  apiUrl: string,
  accessToken: string,
  attempt: { problem_slug: string; code: string; test_results: TestResult[] },
): Promise<void> {
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attempt),
  });
  if (!response.ok) throw new Error("Attempt could not be saved.");
}
