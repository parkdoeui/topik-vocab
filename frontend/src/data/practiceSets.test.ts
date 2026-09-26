import { describe, expect, it } from "vitest";
import { practiceSets } from "./practiceSets";

describe("practice sets", () => {
  it("ships two original sets and five balanced Q53/Q54 sets", () => {
    expect(practiceSets.map((set) => set.id)).toEqual([
      "q51-set-01",
      "q52-set-01",
      "q53-q54-mixed-01",
      "q53-q54-mixed-02",
      "q53-q54-mixed-03",
      "q53-q54-mixed-04",
      "q53-q54-mixed-05",
    ]);
    const questionIds = new Set<string>();
    const prompts = new Set<string>();
    for (const set of practiceSets) {
      expect(set.questions).toHaveLength(10);
      expect(set.target_seconds_per_question).toBe(60);
      if (set.question_type === "q53-q54-mixed") {
        expect(set.questions.filter((question) => question.question_number === 53)).toHaveLength(5);
        expect(set.questions.filter((question) => question.question_number === 54)).toHaveLength(5);
      }
      for (const question of set.questions) {
        expect(questionIds.has(question.id)).toBe(false);
        expect(prompts.has(question.prompt)).toBe(false);
        questionIds.add(question.id);
        prompts.add(question.prompt);
        expect(question.blanks.length).toBeGreaterThan(0);
        for (const blank of question.blanks) {
          expect(blank.model_answer).not.toHaveLength(0);
          expect(blank.feedback).not.toHaveLength(0);
        }
      }
    }
  });
});
