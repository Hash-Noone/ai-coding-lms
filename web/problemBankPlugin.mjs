import fs from "node:fs";
import path from "node:path";

const VIRTUAL_ID = "virtual:problem-bank";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

export function problemBankPlugin() {
  const dataDir = path.resolve(import.meta.dirname, "../data");
  const problemsDir = path.join(dataDir, "problems");

  return {
    name: "problem-bank",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;

      const concepts = JSON.parse(
        fs.readFileSync(path.join(dataDir, "concepts.json"), "utf8"),
      );
      const resources = JSON.parse(
        fs.readFileSync(path.join(dataDir, "resources.json"), "utf8"),
      );

      const slugs = fs
        .readdirSync(problemsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const problems = slugs.map((slug) => {
        const dir = path.join(problemsDir, slug);
        const meta = JSON.parse(fs.readFileSync(path.join(dir, "problem.json"), "utf8"));
        const starterCode = fs.readFileSync(path.join(dir, "starter.py"), "utf8");
        const publicTests = meta.public_tests.map((test, index) => ({
          id: `${slug}-test-${index}`,
          label: test.label,
          args: test.args,
          expected: test.expected,
        }));

        return {
          slug: meta.slug,
          title: meta.title,
          prompt: meta.prompt,
          entryPoint: meta.entry_point,
          concepts: meta.concepts,
          starterCode,
          publicTests,
        };
      });

      return [
        `export const concepts = ${JSON.stringify(concepts)};`,
        `export const problems = ${JSON.stringify(problems)};`,
        `export const resources = ${JSON.stringify(resources)};`,
      ].join("\n");
    },
  };
}
