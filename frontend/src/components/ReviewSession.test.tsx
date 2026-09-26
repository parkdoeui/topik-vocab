// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ReviewSession } from "./ReviewSession";

const reviewApi = vi.hoisted(() => ({
  startReviewSession: vi.fn(),
  submitReviewAnswer: vi.fn(),
  completeReviewSession: vi.fn(),
}));

vi.mock("../services/reviewApi", () => ({
  ...reviewApi,
}));

describe("ReviewSession", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    reviewApi.startReviewSession.mockResolvedValue({
      id: "session-1",
      setId: "review-set-1",
      setTitle: "1세트 · 실제 오류 핵심",
      initialQuestionCount: 20,
      questions: [{
        id: "question-1",
        setId: "review-set-1",
        setPosition: 1,
        type: "particle_choice",
        question: "현대 사회에서는 예상하지 못한 문제___ 직면할 수 있다.",
        options: ["를", "에", "가", "으로"],
        targetPattern: "N에 직면하다",
        category: "verb_collocation",
        difficulty: 1,
        source: "user_error",
      }],
    });
    reviewApi.submitReviewAnswer.mockResolvedValue({
      correct: false,
      correctAnswer: "에",
      explanation: "직면하다는 조사 에와 결합한다.",
      targetPattern: "N에 직면하다",
      category: "verb_collocation",
      progress: { correctCount: 0, incorrectCount: 1, streak: 0, masteryLevel: 0 },
      replacementQuestion: {
        id: "question-2",
        setId: "review-set-1",
        setPosition: 2,
        type: "error_correction",
        question: "문제를 직면했다.",
        options: ["문제를 직면했다.", "문제에 직면했다.", "문제가 직면했다.", "문제로 직면했다."],
        targetPattern: "N에 직면하다",
        category: "verb_collocation",
        difficulty: 3,
        source: "user_error",
      },
      insertAfter: 3,
      replacementIsSupplemental: false,
    });
  });

  it("grades a selected answer immediately and shows the saved feedback", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review/review-set-1"]}>
        <Routes><Route path="/review/:setId" element={<ReviewSession />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByText("현대 사회에서는 예상하지 못한 문제___ 직면할 수 있다.");
    await user.click(screen.getByRole("radio", { name: /를/ }));

    await waitFor(() => expect(reviewApi.submitReviewAnswer).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/다시 익혀 볼 표현입니다/)).toBeTruthy();
    expect(screen.getByText("직면하다는 조사 에와 결합한다.")).toBeTruthy();
    expect(screen.getByText("이 패턴은 다른 문장으로 잠시 후 다시 나옵니다.")).toBeTruthy();
    expect(reviewApi.submitReviewAnswer.mock.calls[0][1]).toMatchObject({
      question_id: "question-1",
      submitted_answer: "를",
      excluded_question_ids: [],
    });

    expect(screen.getByRole("button", { name: "다음 문제" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("offers radio choices for an error-correction question", async () => {
    reviewApi.startReviewSession.mockResolvedValueOnce({
      id: "session-c",
      setId: "review-set-1",
      setTitle: "교정",
      initialQuestionCount: 1,
      questions: [{
        id: "correction",
        setId: "review-set-1",
        setPosition: 1,
        type: "error_correction",
        question: "문제를 직면했다.",
        options: ["문제를 직면했다.", "문제에 직면했다.", "문제가 직면했다.", "문제로 직면했다."],
        targetPattern: "N에 직면하다",
        category: "verb_collocation",
        difficulty: 3,
        source: "user_error",
      }],
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/review/review-set-1"]}><Routes><Route path="/review/:setId" element={<ReviewSession />} /></Routes></MemoryRouter>);
    await screen.findByRole("radio", { name: "문제를 직면했다." });
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "문제에 직면했다." }));
    await waitFor(() => expect(reviewApi.submitReviewAnswer).toHaveBeenCalledWith("session-c", expect.objectContaining({ submitted_answer: "문제에 직면했다." })));
  });

  it("reuses the answer id when a saved response is retried after a network failure", async () => {
    reviewApi.submitReviewAnswer
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        correct: true,
        correctAnswer: "에",
        explanation: "직면하다는 조사 에와 결합한다.",
        targetPattern: "N에 직면하다",
        category: "verb_collocation",
        progress: { correctCount: 1, incorrectCount: 0, streak: 1, masteryLevel: 0 },
      });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review/review-set-1"]}>
        <Routes><Route path="/review/:setId" element={<ReviewSession />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByText("현대 사회에서는 예상하지 못한 문제___ 직면할 수 있다.");
    const answer = screen.getByRole("radio", { name: "에" });
    await user.click(answer);
    await screen.findByRole("alert");
    await user.click(answer);

    await waitFor(() => expect(reviewApi.submitReviewAnswer).toHaveBeenCalledTimes(2));
    expect(reviewApi.submitReviewAnswer.mock.calls[1][1].id)
      .toBe(reviewApi.submitReviewAnswer.mock.calls[0][1].id);
    expect(screen.getByText(/정답입니다/)).toBeTruthy();
  });
});
