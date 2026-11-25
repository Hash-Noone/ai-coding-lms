declare module "virtual:problem-bank" {
  import type { PublicTest } from "./pythonTests";

  export type Concept = {
    slug: string;
    name: string;
  };

  export type BankProblem = {
    slug: string;
    title: string;
    prompt: string;
    entryPoint: string;
    concepts: string[];
    starterCode: string;
    publicTests: PublicTest[];
  };

  export type CuratedResource = {
    title: string;
    url: string;
    concepts: string[];
    mistake_type: string | null;
    start_seconds: number;
  };

  export const concepts: Concept[];
  export const problems: BankProblem[];
  export const resources: CuratedResource[];
}
