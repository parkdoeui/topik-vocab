import type { TopikTest, TopikQuestion } from "../types";

import chunk_35 from "./reading/35/index.ts";
// To add a new test:
// 1. Import its chunk files above
// 2. Add an entry to TEST_REGISTRY below

const TEST_REGISTRY: TopikTest[] = [
  // {
  //   id: "topik2-91",
  //   title: "제91회 TOPIK II 읽기",
  //   level: "TOPIK II",
  //   questions: [
  //     ...chunk35_1_10,
  //     ...chunk35_11_20,
  //     ...chunk35_21_30,
  //     ...chunk35_31_40,
  //     ...chunk35_41_50,
  //   ] as TopikQuestion[],
  // },
  {
    id: "topik2-35",
    title: "제35회 TOPIK II 읽기",
    level: "TOPIK II",
    questions: chunk_35 as TopikQuestion[],
  }
];

export const tests: TopikTest[] = TEST_REGISTRY;
