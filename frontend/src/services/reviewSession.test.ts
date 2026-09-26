import { describe, expect, it } from "vitest";
import type { ReviewQuestion } from "./reviewApi";
import {
  insertReplacementQuestion,
} from "./reviewSession";

const question = (id: string, type: ReviewQuestion["type"] = "particle_choice"): ReviewQuestion => ({
  id,
  setId: "review-set-1",
  setPosition: 1,
  type,
  question: "문제___ 직면하다.",
  options: ["를", "에", "가", "으로"],
  targetPattern: "N에 직면하다",
  category: "verb_collocation",
  difficulty: 1,
  source: "user_error",
});

describe("review session UI helpers", () => {
  it("keeps a wrong-pattern variation 3–7 questions after the current item", () => {
    const queue = Array.from({ length: 10 }, (_, index) => question(`q-${index}`));
    const next = insertReplacementQuestion(queue, 1, question("replacement"), 4);

    expect(next.map((item) => item.id)).toContain("replacement");
    expect(next.findIndex((item) => item.id === "replacement")).toBe(6);
  });

  it("moves an unattempted base question instead of adding it twice", () => {
    const queue = [question("q-1"), question("replacement"), question("q-2"), question("q-3")];
    const next = insertReplacementQuestion(queue, 0, question("replacement"), 3);
    expect(next.map((item) => item.id)).toEqual(["q-1", "q-2", "q-3", "replacement"]);
  });

  it("removes a future duplicate when that replacement was already shown", () => {
    const queue = [
      question("q-1"),
      question("replacement"),
      question("q-2"),
      question("replacement"),
    ];
    const next = insertReplacementQuestion(queue, 2, question("replacement"), 3);
    expect(next.map((item) => item.id)).toEqual(["q-1", "replacement", "q-2"]);
  });

  it("requires a valid delayed-repeat protocol", () => {
    expect(() => insertReplacementQuestion([question("q-1")], 0, question("replacement"), 2))
      .toThrow(/3–7/);
  });

});
