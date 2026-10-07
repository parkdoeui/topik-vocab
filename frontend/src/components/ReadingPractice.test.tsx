// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import bank from "../../../backend/data/reading_practice/questions.json";
import additionalSets from "../../../backend/data/reading_practice/additional-sets.json";
import reading19Bank from "../../../backend/data/reading_practice/reading-19.json";
import { ReadingPracticeHome } from "./ReadingPracticeHome";
import { ReadingPracticeSession } from "./ReadingPracticeSession";
import { ReadingPracticeReview } from "./ReadingPracticeReview";
import { readingOptionMarkers, type ReadingSet, type ReadingAttemptReview, type ReadingOption } from "../services/readingApi";

const readingApi = vi.hoisted(() => ({
  getReadingSets: vi.fn(),
  getReadingSet: vi.fn(),
  getReadingAttempts: vi.fn(),
  getReadingAttempt: vi.fn(),
  submitReadingAttempt: vi.fn(),
}));

vi.mock("../services/readingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/readingApi")>(),
  ...readingApi,
}));

const sets: ReadingSet[] = Array.from({ length: 5 }, (_, index) => ({
  id: `reading-28-31-0${index + 1}`,
  practice_type: "28-31",
  title: `읽기 28–31 · ${index + 1}세트`,
  notice: bank.notice,
  instruction: bank.instruction,
  points_per_question: bank.points_per_question,
  topics: ["기술", "환경", "도시", "문화"],
  question_count: 4,
  questions: bank.questions.filter((question) => (question.source_number - 1) % 5 === index).map(({ id, topic, prompt, options }) => ({ id, topic, prompt, options })),
}));
const extraSet: ReadingSet = {
  ...sets[0],
  id: additionalSets[0].id,
  title: additionalSets[0].title,
  topics: additionalSets[0].questions.map((question) => question.topic),
  questions: additionalSets[0].questions.map(({ id, topic, prompt, options }) => ({ id, topic, prompt, options })),
};
sets.push(extraSet);

const review: ReadingAttemptReview = {
  id: "saved-reading",
  practice_type: "28-31",
  set_id: sets[0].id,
  set_title: sets[0].title,
  completed_at: "2026-10-06T12:00:00Z",
  correct_count: 3,
  question_count: 4,
  score: 6,
  max_score: 8,
  instruction: bank.instruction,
  points_per_question: 2,
  questions: sets[0].questions.map((question, index) => {
    const original = bank.questions.find((candidate) => candidate.id === question.id)!;
    return {
      ...question,
      selected_option: (index === 0 ? 1 : original.correct_option) as ReadingOption,
      correct_option: original.correct_option as ReadingOption,
      correct: index !== 0,
      explanation: original.explanation,
      vocabulary: original.vocabulary,
    };
  }),
};
const extraReview: ReadingAttemptReview = {
  ...review,
  id: "saved-science-history",
  set_id: extraSet.id,
  set_title: extraSet.title,
  correct_count: 4,
  score: 8,
  questions: additionalSets[0].questions.map((question) => ({
    ...question,
    selected_option: question.correct_option as ReadingOption,
    correct_option: question.correct_option as ReadingOption,
    correct: true,
  })),
};

const reading19Sets: ReadingSet[] = reading19Bank.sets.map((practiceSet) => {
  const questions = practiceSet.question_ids.map((id) => reading19Bank.questions.find((question) => question.id === id)!);
  return {
    id: practiceSet.id,
    practice_type: "19",
    title: practiceSet.title,
    notice: reading19Bank.notice,
    instruction: reading19Bank.instruction,
    guidance: reading19Bank.guidance,
    points_per_question: reading19Bank.points_per_question,
    topics: questions.map((question) => question.topic),
    question_count: questions.length,
    questions: questions.map(({ id, topic, prompt, options }) => ({ id, topic, prompt, options })),
  };
});
const reading19Review: ReadingAttemptReview = {
  id: "saved-reading-19",
  practice_type: "19",
  set_id: reading19Sets[0].id,
  set_title: reading19Sets[0].title,
  completed_at: "2026-10-06T12:00:00Z",
  correct_count: 5,
  question_count: 6,
  score: 5,
  max_score: 6,
  instruction: reading19Bank.instruction,
  points_per_question: reading19Bank.points_per_question,
  questions: reading19Sets[0].questions.map((question, index) => {
    const original = reading19Bank.questions.find((candidate) => candidate.id === question.id)!;
    return {
      ...original,
      selected_option: (index === 0 ? original.correct_option % 4 + 1 : original.correct_option) as ReadingOption,
      correct_option: original.correct_option as ReadingOption,
      correct: index !== 0,
    };
  }),
};

function renderReading(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reading" element={<ReadingPracticeHome />} />
        <Route path="/reading/:setId" element={<ReadingPracticeSession />} />
        <Route path="/reading-attempts/:attemptId" element={<ReadingPracticeReview />} />
        <Route path="/reading-19" element={<ReadingPracticeHome practiceType="19" />} />
        <Route path="/reading-19/:setId" element={<ReadingPracticeSession practiceType="19" />} />
        <Route path="/reading-19-attempts/:attemptId" element={<ReadingPracticeReview practiceType="19" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: () => "reading-client-id" });
  readingApi.getReadingSets.mockResolvedValue(sets);
  readingApi.getReadingAttempts.mockResolvedValue([]);
  readingApi.getReadingSet.mockResolvedValue(sets[0]);
  readingApi.getReadingAttempt.mockResolvedValue(review);
  readingApi.submitReadingAttempt.mockResolvedValue(review);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function answerSet(user: ReturnType<typeof userEvent.setup>, attemptReview = review) {
  await screen.findByText(attemptReview.questions[0].prompt, { normalizer: (text) => text });
  for (const [index, question] of attemptReview.questions.entries()) {
    await user.click(screen.getByRole("radio", { name: `${readingOptionMarkers[question.selected_option - 1]} ${question.options[question.selected_option - 1]}` }));
    if (index < attemptReview.questions.length - 1) await user.click(screen.getByRole("button", { name: "다음 문제" }));
  }
}

describe("reading 28–31 practice", () => {
  it("lists the original five sets plus a science/history set and saved reviews", async () => {
    readingApi.getReadingAttempts.mockResolvedValue([review]);
    renderReading("/reading");
    const catalogue = await screen.findByRole("region", { name: "읽기 연습 세트" });
    await waitFor(() => expect(within(catalogue).getAllByRole("link", { name: "시작하기" })).toHaveLength(6));
    expect(within(catalogue).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(sets.map((set) => `/reading/${set.id}`));
    expect(within(catalogue).getAllByText("기술 · 환경 · 도시 · 문화 · 주제별 1문항")).toHaveLength(5);
    expect(within(catalogue).getByText("과학 2문항 · 한국 역사 2문항")).toBeTruthy();
    expect(within(catalogue).getAllByText("4문항 · 문항별 2점 · 총 8점")).toHaveLength(6);
    const history = screen.getByRole("region", { name: "저장된 읽기 풀이" });
    expect(within(history).getByRole("link").getAttribute("href")).toBe("/reading-attempts/saved-reading");
  });

  it("preserves choices when navigating and requires all four answers before submitting", async () => {
    const user = userEvent.setup();
    renderReading(`/reading/${sets[0].id}`);
    await screen.findByText(sets[0].questions[0].prompt, { normalizer: (text) => text });
    expect((screen.getByRole("button", { name: "다음 문제" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByText(review.questions[0].explanation)).toBeNull();
    const selectedLabel = `① ${sets[0].questions[0].options[0]}`;
    await user.click(screen.getByRole("radio", { name: selectedLabel }));
    await user.click(screen.getByRole("button", { name: "다음 문제" }));
    expect(screen.getByText(sets[0].questions[1].prompt, { normalizer: (text) => text })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "이전 문제" }));
    expect((screen.getByRole("radio", { name: selectedLabel }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "4. 문화" }));
    expect((screen.getByRole("button", { name: "제출하고 해설 보기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(readingApi.submitReadingAttempt).not.toHaveBeenCalled();
  });

  it("submits selected options and shows every correct answer with the supplied explanation", async () => {
    const user = userEvent.setup();
    renderReading(`/reading/${sets[0].id}`);
    await answerSet(user);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    expect(readingApi.submitReadingAttempt).toHaveBeenCalledWith({
      id: "reading-client-id",
      set_id: sets[0].id,
      answers: review.questions.map((question) => ({ question_id: question.id, selected_option: question.selected_option })),
    });
    expect(screen.getByText("6 / 8점")).toBeTruthy();
    expect(screen.getByText("오답")).toBeTruthy();
    for (const question of review.questions) {
      expect(screen.getByText(question.explanation)).toBeTruthy();
      expect(screen.getByText(`정답: ${readingOptionMarkers[question.correct_option - 1]} ${question.options[question.correct_option - 1]}`)).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "다시 풀기" }).getAttribute("href")).toBe(`/reading/${sets[0].id}`);
    expect(screen.getByRole("link", { name: "풀이 기록 보기" }).getAttribute("href")).toBe("/reading");
    expect(screen.getByText(/자동 저장 완료/)).toBeTruthy();
  });

  it("retains answers and reuses the attempt id after a failed save", async () => {
    readingApi.submitReadingAttempt.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(review);
    const user = userEvent.setup();
    renderReading(`/reading/${sets[0].id}`);
    await answerSet(user);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("alert");
    const firstPayload = readingApi.submitReadingAttempt.mock.calls[0][0];
    expect(screen.getAllByRole("radio").every((radio) => (radio as HTMLInputElement).disabled || radio.closest("fieldset")?.disabled)).toBe(true);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    expect(readingApi.submitReadingAttempt.mock.calls[1][0]).toEqual(firstPayload);
  });

  it("completes the science/history set and shows all explanations and sources", async () => {
    readingApi.getReadingSet.mockResolvedValue(extraSet);
    readingApi.submitReadingAttempt.mockResolvedValue(extraReview);
    readingApi.getReadingAttempt.mockResolvedValue(extraReview);
    const user = userEvent.setup();
    renderReading(`/reading/${extraSet.id}`);
    await answerSet(user, extraReview);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    expect(readingApi.submitReadingAttempt).toHaveBeenCalledWith({
      id: "reading-client-id",
      set_id: extraSet.id,
      answers: extraReview.questions.map((question) => ({ question_id: question.id, selected_option: question.selected_option })),
    });
    expect(screen.getByText("8 / 8점")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1. 과학" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2. 과학" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3. 한국 역사" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "4. 한국 역사" })).toBeTruthy();
    for (const question of extraReview.questions) {
      expect(screen.getByText(question.explanation)).toBeTruthy();
      for (const source of question.sources ?? []) {
        expect(screen.getByRole("link", { name: source.title }).getAttribute("href")).toBe(source.url);
      }
    }
  });

  it("reopens a saved review directly and retries a failed result load", async () => {
    readingApi.getReadingAttempt.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(review);
    const user = userEvent.setup();
    renderReading("/reading-attempts/saved-reading");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    expect(screen.getByText(review.questions[0].explanation)).toBeTruthy();
    expect(readingApi.submitReadingAttempt).not.toHaveBeenCalled();
  });

  it("still displays sets when history fails and recovers on refresh", async () => {
    readingApi.getReadingAttempts.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    renderReading("/reading");
    await screen.findByRole("alert");
    expect(screen.getAllByRole("link", { name: "시작하기" })).toHaveLength(6);
    await user.click(screen.getByRole("button", { name: "새로 고침" }));
    await screen.findByText("아직 저장된 풀이가 없습니다. 첫 세트를 시작해 보세요.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a path back to the catalogue when a set cannot be loaded", async () => {
    readingApi.getReadingSet.mockRejectedValueOnce(new Error("404"));
    renderReading("/reading/missing");
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: "읽기 연습으로" }).getAttribute("href")).toBe("/reading");
  });
});

describe("reading 19 practice", () => {
  beforeEach(() => {
    readingApi.getReadingSets.mockResolvedValue(reading19Sets);
    readingApi.getReadingAttempts.mockResolvedValue([reading19Review]);
    readingApi.getReadingSet.mockResolvedValue(reading19Sets[0]);
    readingApi.getReadingAttempt.mockResolvedValue(reading19Review);
    readingApi.submitReadingAttempt.mockResolvedValue(reading19Review);
  });

  it("lists six sets with six distinct categories and links to its own saved history", async () => {
    renderReading("/reading-19");
    await screen.findByRole("heading", { name: "읽기 19번 연습" });
    const catalogue = screen.getByRole("region", { name: "읽기 연습 세트" });
    await waitFor(() => expect(within(catalogue).getAllByRole("link", { name: "시작하기" })).toHaveLength(6));
    expect(readingApi.getReadingSets).toHaveBeenCalledWith("19");
    expect(readingApi.getReadingAttempts).toHaveBeenCalledWith("19");
    expect(within(catalogue).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(reading19Sets.map((set) => `/reading-19/${set.id}`));
    expect(within(catalogue).getAllByText("6문항 · 문항별 1점 · 총 6점")).toHaveLength(6);
    for (const practiceSet of reading19Sets) {
      expect(within(catalogue).getByText(`${practiceSet.topics.join(" · ")} · 분류별 1문항`)).toBeTruthy();
    }
    expect(screen.getByText(reading19Bank.guidance)).toBeTruthy();
    const history = screen.getByRole("region", { name: "저장된 읽기 풀이" });
    expect(within(history).getByRole("link").getAttribute("href")).toBe("/reading-19-attempts/saved-reading-19");
  });

  it("keeps selections across navigation and requires all six answers before submitting", async () => {
    const user = userEvent.setup();
    renderReading(`/reading-19/${reading19Sets[0].id}`);
    await screen.findByText(reading19Sets[0].questions[0].prompt, { normalizer: (text) => text });
    expect(screen.getByRole("heading", { name: "1 / 6문항" })).toBeTruthy();
    for (const question of reading19Review.questions) {
      expect(screen.queryByText(question.topic, { exact: true })).toBeNull();
      expect(screen.queryByText(question.explanation)).toBeNull();
    }
    const selectedLabel = `① ${reading19Sets[0].questions[0].options[0]}`;
    await user.click(screen.getByRole("radio", { name: selectedLabel }));
    await user.click(screen.getByRole("button", { name: "다음 문제" }));
    await user.click(screen.getByRole("button", { name: "이전 문제" }));
    expect((screen.getByRole("radio", { name: selectedLabel }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "6. 문항" }));
    expect((screen.getByRole("button", { name: "제출하고 해설 보기" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getAllByRole("radio")[0]);
    expect((screen.getByRole("button", { name: "제출하고 해설 보기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(readingApi.submitReadingAttempt).not.toHaveBeenCalled();
  });

  it("submits six answers and shows correct answers, category descriptions and source explanations", async () => {
    const user = userEvent.setup();
    renderReading(`/reading-19/${reading19Sets[0].id}`);
    await answerSet(user, reading19Review);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    expect(readingApi.submitReadingAttempt).toHaveBeenCalledWith({
      id: "reading-client-id",
      set_id: reading19Sets[0].id,
      answers: reading19Review.questions.map((question) => ({ question_id: question.id, selected_option: question.selected_option })),
    });
    expect(screen.getByText("5 / 6점")).toBeTruthy();
    expect(screen.getByText("오답")).toBeTruthy();
    for (const [index, question] of reading19Review.questions.entries()) {
      expect(screen.getByRole("heading", { name: `${index + 1}. ${question.topic}` })).toBeTruthy();
      expect(screen.getByText(question.category_description!)).toBeTruthy();
      expect(screen.getByText(question.explanation)).toBeTruthy();
      expect(screen.getByText(`정답: ${readingOptionMarkers[question.correct_option - 1]} ${question.options[question.correct_option - 1]}`)).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "다시 풀기" }).getAttribute("href")).toBe(`/reading-19/${reading19Sets[0].id}`);
    expect(screen.getByRole("link", { name: "풀이 기록 보기" }).getAttribute("href")).toBe("/reading-19");
  });

  it("reopens a six-question review directly without submitting again", async () => {
    renderReading("/reading-19-attempts/saved-reading-19");
    await screen.findByRole("heading", { name: "읽기 연습 결과" });
    const explanations = screen.getByRole("region", { name: "문항별 정답과 해설" });
    expect(within(explanations).getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.getByText(reading19Review.questions[5].explanation)).toBeTruthy();
    expect(readingApi.submitReadingAttempt).not.toHaveBeenCalled();
  });

  it("stays on the catalogue when a pending submission finishes after leaving the session", async () => {
    let finishSave!: (result: ReadingAttemptReview) => void;
    readingApi.submitReadingAttempt.mockReturnValueOnce(new Promise<ReadingAttemptReview>((resolve) => { finishSave = resolve; }));
    const user = userEvent.setup();
    renderReading(`/reading-19/${reading19Sets[0].id}`);
    await answerSet(user, reading19Review);
    await user.click(screen.getByRole("button", { name: "제출하고 해설 보기" }));
    await screen.findByRole("button", { name: "저장 중…" });
    await user.click(screen.getByRole("link", { name: "← 읽기 19번 연습" }));
    await screen.findByRole("heading", { name: "읽기 19번 연습" });
    await act(async () => { finishSave(reading19Review); });
    expect(screen.getByRole("heading", { name: "읽기 19번 연습" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "읽기 연습 결과" })).toBeNull();
    expect(readingApi.getReadingAttempt).not.toHaveBeenCalled();
  });

  it("links back to the correct catalogue when the set cannot be loaded", async () => {
    readingApi.getReadingSet.mockRejectedValueOnce(new Error("404"));
    renderReading("/reading-19/missing");
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: "읽기 연습으로" }).getAttribute("href")).toBe("/reading-19");
  });
});
