// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { writingTests } from "../data/tests";
import { WritingHome } from "./WritingHome";

const api = vi.hoisted(() => ({
  getProgress: vi.fn(),
  startWritingSession: vi.fn(),
}));

vi.mock("../services/api", () => api);

beforeEach(() => {
  vi.stubGlobal("localStorage", { length: 0, key: () => null, getItem: () => null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("shows completed attempt count for each writing test", async () => {
  const testId = writingTests[0].id;
  api.getProgress.mockResolvedValue({
    total_sessions: 2, average_score: 75,
    sessions: [
      { id: "attempt-1", test_id: testId, date: "2026-09-29T10:00:00Z", total_score: 70, max_score: 100 },
      { id: "attempt-2", test_id: testId, date: "2026-09-30T10:00:00Z", total_score: 80, max_score: 100 },
    ],
  });
  render(<MemoryRouter><WritingHome /></MemoryRouter>);

  expect(await screen.findByText("완료 2회")).toBeTruthy();
  expect(screen.getByRole("button", { name: "다시 풀기" })).toBeTruthy();
  expect((screen.getByRole("link", { name: "최근 채점 결과" })).getAttribute("href"))
    .toBe("/writing-results/attempt-2");
});
