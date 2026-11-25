import type { PublicTest } from "./pythonTests";

export const sampleProblem = {
  slug: "sum-of-positives",
  title: "Sum of positive numbers",
  prompt: "Given a list of integers, return the sum of the numbers greater than zero. Ignore zeros and negative numbers. If there are no positive numbers, return 0.",
  starterCode: "def sum_positives(numbers):\n    # Write your solution here\n    return 0\n",
  entryPoint: "sum_positives",
  publicTests: [
    { id: "mixed", label: "Positive, negative, and zero", args: [[3, -2, 0, 5]], expected: 8 },
    { id: "negative", label: "All negative", args: [[-4, -1]], expected: 0 },
    { id: "empty", label: "Empty list", args: [[]], expected: 0 },
  ] satisfies PublicTest[],
};
