// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { PracticeSession } from "./PracticeSession";
import { PracticeAttemptReview } from "./PracticeAttemptReview";

const practiceApi = vi.hoisted(() => ({
  getPracticeAttempt: vi.fn(),
  submitPracticeAttempt: vi.fn(),
}));

vi.mock("../services/api", () => ({ ...practiceApi }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("mixed quick practice", () => {
  it("shows Q53 and Q54 badges as the learner moves between questions", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/practice/q53-q54-mixed-01"]}>
        <Routes><Route path="/practice/:setId" element={<PracticeSession />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Q53")).toBeTruthy();
    expect(screen.getByText(/공공도서관 월평균 방문자/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("Q54")).toBeTruthy();
    expect(screen.getByText(/학교의 토론 수업/)).toBeTruthy();
  });

  it("reopens saved results with each question type preserved", async () => {
    practiceApi.getPracticeAttempt.mockResolvedValue({
      id: "saved-mixed", set_id: "q53-q54-mixed-01", set_title: "혼합 1세트",
      completed_at: "2026-09-26T10:00:00Z", started_at: "2026-09-26T09:58:00Z",
      total_time_ms: 120000, target_seconds_per_question: 60,
      question_count: 2, within_target_count: 2, question_type: "q53-q54-mixed",
      questions: [53, 54].map((question_number) => ({
        id: `saved-${question_number}`, question_number, prompt: `Q${question_number} 문항`,
        elapsed_ms: 40000,
        blanks: [{ marker: "㉠", submitted_answer: "내 답", model_answer: "예시 답", accepted_variants: [], focus: "연습", feedback: "설명" }],
      })),
    });
    render(
      <MemoryRouter initialEntries={["/practice-attempts/saved-mixed"]}>
        <Routes><Route path="/practice-attempts/:attemptId" element={<PracticeAttemptReview />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("1번 · Q53")).toBeTruthy();
    expect(screen.getByText("2번 · Q54")).toBeTruthy();
  });
});
