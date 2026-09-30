// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { WritingResultsView } from "./WritingResultsView";

const api = vi.hoisted(() => ({ getWritingSession: vi.fn() }));
vi.mock("../services/api", () => api);
vi.mock("./StoredWritingImage", () => ({
  StoredWritingImage: ({ path, alt }: { path: string; alt: string }) => <img src={path} alt={alt} />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("shows each saved question prompt and every submitted photo in the writing result", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  const grading = {
    score: 8, max_score: 10, criteria: {}, criterion_evidence: {},
    detailed_improvement_points: {}, current_state: "", primary_goal: "", sample_answer: "",
  };
  api.getWritingSession.mockResolvedValue({
    id: "attempt-1", test_id: "test-1", q53_char_count: 200, q54_char_count: 0,
    test: {
      id: "test-1", title: "쓰기 시험", questions: [
        { number: 51, type: "short-blank", max_points: 10, instruction: "51번 안내", prompt: "51번 문제 지문" },
        { number: 53, type: "chart-description", max_points: 30, instruction: "53번 안내", prompt: "53번 도표 설명", image_urls: ["https://assets.test/question.png"] },
        { number: 54, type: "essay", max_points: 50, instruction: "54번 안내", prompt: "54번 문제 지문", image_urls: ["https://assets.test/essay.png"] },
      ],
    },
    answers: {
      "51": { transcription: "답안" },
      "53": { transcription: "도표 답안", answer_image_urls: ["/api/images/one", "/api/images/two"] },
      "54": { transcription: "논술 답안", image_urls: ["https://assets.test/essay.png", "/api/images/legacy"] },
    },
    grading: { total_score: 24, questions: { "51": grading, "53": { ...grading, max_score: 30 }, "54": { ...grading, max_score: 50 } }, action_points: [] },
  });

  render(
    <MemoryRouter initialEntries={["/writing-results/attempt-1"]}>
      <Routes><Route path="/writing-results/:id" element={<WritingResultsView />} /></Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("51번 문제 지문")).toBeTruthy();
  expect(screen.getByText("53번 도표 설명")).toBeTruthy();
  expect(screen.getByAltText("53번 문제 자료 1").getAttribute("src")).toBe("https://assets.test/question.png");
  expect(screen.getByAltText("53번 답안 사진 1").getAttribute("src")).toBe("/api/images/one");
  expect(screen.getByAltText("53번 답안 사진 2").getAttribute("src")).toBe("/api/images/two");
  expect(screen.getByAltText("54번 답안 사진 1").getAttribute("src")).toBe("/api/images/legacy");
  expect(screen.queryByText("제출한 답안 사진 보기")).toBeNull();
  expect(screen.getAllByText("인식된 답안 텍스트 보기")).toHaveLength(3);
});
