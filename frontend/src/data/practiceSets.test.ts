import { describe, expect, it } from "vitest";
import { practiceSets } from "./practiceSets";

describe("practice sets", () => {
  it("ships a complete Q51 and Q52 set", () => {
    expect(practiceSets.map((set) => set.id)).toEqual([
      "q51-set-01",
      "q52-set-01",
    ]);

    for (const set of practiceSets) {
      expect(set.questions).toHaveLength(10);
      expect(set.target_seconds_per_question).toBe(60);
      for (const question of set.questions) {
        expect(question.blanks.length).toBeGreaterThan(0);
        for (const blank of question.blanks) {
          expect(blank.model_answer).not.toHaveLength(0);
          expect(blank.feedback).not.toHaveLength(0);
        }
      }
    }
  });
});
