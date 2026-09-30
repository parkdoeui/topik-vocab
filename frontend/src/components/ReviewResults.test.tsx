// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ReviewHome } from "./ReviewHome";
import { ReviewResults } from "./ReviewResults";

const reviewApi = vi.hoisted(() => ({
  getReviewSets: vi.fn(),
  getReviewResult: vi.fn(),
}));

vi.mock("../services/reviewApi", () => reviewApi);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("links a completed review set to its result instead of showing Start", async () => {
  reviewApi.getReviewSets.mockResolvedValue([
    { id: "done", title: "완료 세트", description: "", questionCount: 20, latestBaseCorrectCount: 18, latestSessionId: "session-1", latestCompletedAt: "2026-09-30T10:00:00Z" },
    { id: "new", title: "새 세트", description: "", questionCount: 20, latestBaseCorrectCount: null, latestSessionId: null, latestCompletedAt: null },
  ]);
  render(<MemoryRouter><ReviewHome /></MemoryRouter>);

  expect((await screen.findByRole("link", { name: "결과 보기" })).getAttribute("href")).toBe("/review-results/session-1");
  expect(screen.getAllByRole("link", { name: "시작하기" })).toHaveLength(1);
});

it("shows correct and incorrect answers after reopening a completed review", async () => {
  reviewApi.getReviewResult.mockResolvedValue({
    id: "session-1", setTitle: "표현 복습", baseCorrectCount: 1, initialQuestionCount: 2,
    supplementalAttemptCount: 0, attemptedCount: 2, missedPatterns: [],
    answers: [
      { question: "첫 문항", submittedAnswer: "에", correctAnswer: "에", correct: true, explanation: "맞는 이유", isSupplemental: false },
      { question: "둘째 문항", submittedAnswer: "를", correctAnswer: "에", correct: false, explanation: "틀린 이유", isSupplemental: false },
    ],
  });
  render(<MemoryRouter initialEntries={["/review-results/session-1"]}><Routes><Route path="/review-results/:sessionId" element={<ReviewResults />} /></Routes></MemoryRouter>);

  expect(await screen.findByText("첫 문항", { exact: false })).toBeTruthy();
  expect(screen.getByText("정답", { exact: true })).toBeTruthy();
  expect(screen.getByText("오답", { exact: true })).toBeTruthy();
  expect(screen.getByText("내 답: 를")).toBeTruthy();
  expect(screen.getByText("정답: 에")).toBeTruthy();
});
