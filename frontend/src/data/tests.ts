import type { StructuredReadingTest, ListeningTest, WritingTest } from "../types";

import test35 from "./reading-tests/topik2-35.json";
import test41 from "./reading-tests/topik2-41.json";
import test91 from "./reading-tests/topik2-91.json";

// Add new tests here — structured tests need one JSON file in reading-tests/,
// pdf tests need a pdf_url + answer_key JSON.
export const readingTests: StructuredReadingTest[] = [
  test35 as StructuredReadingTest,
  test41 as StructuredReadingTest,
  test91 as StructuredReadingTest,
];

export const listeningTests: ListeningTest[] = [];

export const writingTests: WritingTest[] = [];
