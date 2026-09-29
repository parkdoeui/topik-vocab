// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { PracticeSession } from "./PracticeSession";
import { PracticeAttemptReview } from "./PracticeAttemptReview";
import { PracticeHome } from "./PracticeHome";
import { practiceSets } from "../data/practiceSets";
import { getPendingPracticeAttempts } from "../services/practicePending";

const practiceApi = vi.hoisted(() => ({
  getPracticeAttempt: vi.fn(),
  submitPracticeAttempt: vi.fn(),
  getPracticeAttempts: vi.fn(),
}));

vi.mock("../services/api", () => ({ ...practiceApi }));

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("crypto", { randomUUID: () => "practice-test-id" });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function renderSession(setId = practiceSets[0].id) {
  return render(
    <MemoryRouter initialEntries={[`/practice/${setId}`]}>
      <Routes>
        <Route path="/practice/:setId" element={<PracticeSession />} />
        <Route path="/practice-attempts/:attemptId" element={<p>저장된 결과 화면</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillSet(user: ReturnType<typeof userEvent.setup>) {
  for (const [index, question] of practiceSets[0].questions.entries()) {
    for (const blank of question.blanks) {
      fireEvent.change(screen.getByLabelText(`${blank.marker} 답안`), {
        target: { value: blank.model_answer },
      });
    }
    if (index < 9) await user.click(screen.getByRole("button", { name: "다음" }));
  }
}

describe("themed Q51/Q52 practice", () => {
  it("shows six mixed theme cards and the renamed heading", async () => {
    practiceApi.getPracticeAttempts.mockResolvedValue([]);
    render(<MemoryRouter><PracticeHome /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Q51/Q52 연습" })).toBeTruthy();
    const catalogue = within(screen.getByRole("region", { name: "연습 세트" }));
    expect(catalogue.getAllByText("Q51 + Q52")).toHaveLength(6);
    expect(catalogue.getAllByRole("link", { name: "시작하기" }).map((link) => link.getAttribute("href")))
      .toEqual(practiceSets.map((set) => `/practice/${set.id}`));
    for (const set of practiceSets) expect(catalogue.getByRole("heading", { name: set.title })).toBeTruthy();
    expect(screen.queryByText("빠른 훈련")).toBeNull();
    expect(screen.queryByText("Q53 + Q54")).toBeNull();
    await screen.findByText(/아직 저장된 풀이가 없습니다/);
  });

  it("shows Q51 and Q52 badges with two blanks as the learner moves", async () => {
    const user = userEvent.setup();
    renderSession();
    expect(screen.getByText("Q51")).toBeTruthy();
    expect(screen.getByText(/스마트폰 기초 수업 참가자를 모집합니다/)).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByText("두 빈칸을 합쳐 1분")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("㉠ 답안"), { target: { value: "참가하실 수 있습니다" } });
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("Q52")).toBeTruthy();
    expect(screen.getByText(/한 직장인은 일을 하는 동안/)).toBeTruthy();
    expect((screen.getByLabelText("㉠ 답안") as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "이전" }));
    expect((screen.getByLabelText("㉠ 답안") as HTMLInputElement).value).toBe("참가하실 수 있습니다");
  });

  it.each(["q51-set-01", "q52-set-01", ...Array.from({ length: 5 }, (_, i) => `q53-q54-mixed-0${i + 1}`)])(
    "does not launch the retired %s deep link", (setId) => {
      renderSession(setId);
      expect(screen.getByText("연습 세트를 찾을 수 없습니다.")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Q51/Q52 연습으로" }).getAttribute("href")).toBe("/practice");
      expect(screen.queryByRole("textbox")).toBeNull();
    },
  );

  it("requires both blanks on every question and saves the complete mixed snapshot", async () => {
    const user = userEvent.setup();
    practiceApi.submitPracticeAttempt.mockResolvedValue({ id: "saved-themed" });
    renderSession();
    await user.click(screen.getByRole("button", { name: "10번 문제" }));
    expect((screen.getByRole("button", { name: "답안 확인하기" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "1번 문제" }));
    await fillSet(user);
    fireEvent.change(screen.getByLabelText("㉡ 답안"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "답안 확인하기" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("㉡ 답안"), { target: { value: practiceSets[0].questions[9].blanks[1].model_answer } });
    await user.click(screen.getByRole("button", { name: "답안 확인하기" }));
    await screen.findByText("저장된 결과 화면");
    expect(practiceApi.submitPracticeAttempt).toHaveBeenCalledTimes(1);
    const payload = practiceApi.submitPracticeAttempt.mock.calls[0][0];
    expect(payload.set_id).toBe(practiceSets[0].id);
    expect(payload.question_type).toBe("q51-q52-mixed");
    expect(payload.target_seconds_per_question).toBe(60);
    expect(payload.questions.map((question: { question_number: number }) => question.question_number)).toEqual([51, 52, 51, 52, 51, 52, 51, 52, 51, 52]);
    for (const [index, question] of payload.questions.entries()) {
      expect(question.prompt).toBe(practiceSets[0].questions[index].prompt);
      expect(question.blanks).toHaveLength(2);
      for (const [blankIndex, blank] of question.blanks.entries()) {
        expect(blank).toEqual({
          ...practiceSets[0].questions[index].blanks[blankIndex],
          submitted_answer: practiceSets[0].questions[index].blanks[blankIndex].model_answer,
        });
      }
    }
    expect(getPendingPracticeAttempts()).toHaveLength(0);
  });

  it("retains the same complete payload and ID when retrying a failed save", async () => {
    const user = userEvent.setup();
    practiceApi.submitPracticeAttempt.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: "saved-themed" });
    renderSession();
    await fillSet(user);
    await user.click(screen.getByRole("button", { name: "답안 확인하기" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    const firstPayload = practiceApi.submitPracticeAttempt.mock.calls[0][0];
    expect(getPendingPracticeAttempts()).toEqual([firstPayload]);
    await user.click(screen.getByRole("button", { name: "다시 저장하기" }));
    await screen.findByText("저장된 결과 화면");
    expect(practiceApi.submitPracticeAttempt.mock.calls[1][0]).toEqual(firstPayload);
    await waitFor(() => expect(getPendingPracticeAttempts()).toHaveLength(0));
  });

  it.each([
    { setId: "q53-q54-mixed-01", numbers: [53, 54], type: "q53-q54-mixed", replay: "새 세트 고르기" },
    { setId: "q51-q52-tech-01", numbers: [51, 52], type: "q51-q52-mixed", replay: "다시 풀기" },
  ])("reopens $type results with each question type preserved", async ({ setId, numbers, type, replay }) => {
    practiceApi.getPracticeAttempt.mockResolvedValue({
      id: "saved-mixed", set_id: setId, set_title: "혼합 1세트",
      completed_at: "2026-09-26T10:00:00Z", started_at: "2026-09-26T09:58:00Z",
      total_time_ms: 120000, target_seconds_per_question: 60,
      question_count: 2, within_target_count: 2, question_type: type,
      questions: numbers.map((question_number) => ({
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
    expect(await screen.findByText(`1번 · Q${numbers[0]}`)).toBeTruthy();
    expect(screen.getByText(`2번 · Q${numbers[1]}`)).toBeTruthy();
    expect(screen.getByRole("link", { name: replay }).getAttribute("href"))
      .toBe(type === "q53-q54-mixed" ? "/practice" : `/practice/${setId}`);
  });
});
