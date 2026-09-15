import type { WritingTest } from "../types";

import topik102 from "./writing-tests/topik-102.json";
import writingSample from "./writing-tests/writing-sample.json";

export const writingTests: WritingTest[] = [
  topik102 as WritingTest,
  writingSample as WritingTest,
];
