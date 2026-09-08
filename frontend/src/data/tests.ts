import type { TopikTest, TopikQuestion } from "../types";

import chunk_35 from "./reading/35/index.ts";
import chunk_41 from "./reading/41/index.ts";
// To add a new test:
// 1. Import its chunk files above
// 2. Add an entry to TEST_REGISTRY below

const TEST_REGISTRY: TopikTest[] = [
  {
    id: "topik2-35",
    title: "제35회 TOPIK II 읽기",
    level: "TOPIK II",
    questions: chunk_35 as TopikQuestion[],
  },
  {
    id: "topik2-41",
    title: "제41회 TOPIK II 읽기",
    level: "TOPIK II",
    questions: chunk_41 as TopikQuestion[],
  }
];

export const tests: TopikTest[] = TEST_REGISTRY;
