import type { TopikTest, TopikQuestion } from "../types";

// Test 35 — chunked with vocab map
import chunk35_1_10 from "./reading/91/1-10.json";
import chunk35_11_20 from "./reading/91/11-20.json";
import chunk35_21_30 from "./reading/91/21-30.json";
import chunk35_31_40 from "./reading/91/31-40.json";
import chunk35_41_50 from "./reading/91/41-50.json";

// To add a new test:
// 1. Import its chunk files above
// 2. Add an entry to TEST_REGISTRY below

const TEST_REGISTRY: TopikTest[] = [
  {
    id: "topik2-35",
    title: "제35회 TOPIK II 읽기",
    level: "TOPIK II",
    questions: [
      ...chunk35_1_10,
      ...chunk35_11_20,
      ...chunk35_21_30,
      ...chunk35_31_40,
      ...chunk35_41_50,
    ] as TopikQuestion[],
  },
];

export const tests: TopikTest[] = TEST_REGISTRY;
