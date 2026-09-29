import { describe, expect, it } from "vitest";
import { getPracticeSet, practiceSets } from "./practiceSets";

describe("practice sets", () => {
  it("ships six themed sets with five Q51 and five Q52 questions each", () => {
    expect(practiceSets.map((set) => set.id)).toEqual([
      "q51-q52-tech-01", "q51-q52-environment-02", "q51-q52-city-03",
      "q51-q52-culture-04", "q51-q52-economy-05", "q51-q52-policy-06",
    ]);
    expect(practiceSets.map((set) => set.title.split(" · ")[0])).toEqual([
      "기술", "환경", "도시", "문화", "경제", "공공정책",
    ]);
    const questionIds = new Set<string>();
    const prompts = new Set<string>();
    for (const set of practiceSets) {
      expect(set.questions).toHaveLength(10);
      expect(set.target_seconds_per_question).toBe(60);
      expect(set.question_type).toBe("q51-q52-mixed");
      expect(set.description.trim().length).toBeGreaterThan(0);
      expect(set.accepted_variants_policy).toContain("자동 채점하지 않습니다");
      expect(set.questions.map((question) => question.question_number)).toEqual([51, 52, 51, 52, 51, 52, 51, 52, 51, 52]);
      for (const question of set.questions) {
        expect(questionIds.has(question.id)).toBe(false);
        const normalizedPrompt = question.prompt.normalize("NFKC").replace(/\s+/g, " ").trim();
        expect(prompts.has(normalizedPrompt)).toBe(false);
        questionIds.add(question.id);
        prompts.add(normalizedPrompt);
        expect(question.blanks.map((blank) => blank.marker)).toEqual(["㉠", "㉡"]);
        expect(question.prompt.match(/\( ㉠ \)/g)).toHaveLength(1);
        expect(question.prompt.match(/\( ㉡ \)/g)).toHaveLength(1);
        for (const blank of question.blanks) {
          expect(blank.model_answer.trim().length).toBeGreaterThan(0);
          expect(blank.focus.trim().length).toBeGreaterThan(0);
          expect(blank.feedback.trim().length).toBeGreaterThan(0);
          expect(blank.accepted_variants.length).toBeGreaterThan(0);
          const answers = [blank.model_answer, ...blank.accepted_variants];
          expect(new Set(answers).size).toBe(answers.length);
          for (const answer of answers) {
            expect(answer).toBe(answer.trim());
            expect(answer.length).toBeGreaterThan(0);
            expect(answer).not.toMatch(/[㉠㉡.!?]/);
          }
        }
      }
    }
    expect(questionIds.size).toBe(60);
  });

  it("does not offer any retired set while resolving the new catalogue", () => {
    for (const id of ["q51-set-01", "q52-set-01", ...Array.from({ length: 5 }, (_, i) => `q53-q54-mixed-0${i + 1}`)]) {
      expect(getPracticeSet(id)).toBeUndefined();
    }
    for (const set of practiceSets) expect(getPracticeSet(set.id)).toBe(set);
    expect(getPracticeSet(undefined)).toBeUndefined();
  });
});
