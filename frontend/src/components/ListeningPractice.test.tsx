// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import bank from "../../../backend/data/listening_practice/questions.json";
import manifest from "../../../backend/data/listening_practice/audio-manifest.json";
import dialogueBank from "../../../backend/data/listening_39_practice/questions.json";
import { ListeningPracticeHome } from "./ListeningPracticeHome";
import { ListeningPracticeSession } from "./ListeningPracticeSession";
import { ListeningPracticeReview } from "./ListeningPracticeReview";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";
import type { ListeningAudio, ListeningAttemptReview, ListeningOption, ListeningSet } from "../services/listeningApi";

const api = vi.hoisted(() => ({ getListeningSets: vi.fn(), getListeningSet: vi.fn(), getListeningAttempts: vi.fn(), getListeningAttempt: vi.fn(), submitListeningAttempt: vi.fn() }));
vi.mock("../services/listeningApi", async (original) => ({ ...await original<typeof import("../services/listeningApi")>(), ...api }));
const tracks: Record<string, ListeningAudio> = manifest.tracks;
const sets: ListeningSet[] = bank.sets.map((set) => ({
  ...set, practice_type: "43-44", notice: "창작 연습 문제", question_count: 2,
  audio_duration_seconds: tracks[set.id].duration_seconds, audio: tracks[set.id],
  questions: set.questions.map((q) => ({ ...q, id: `${set.id}-${q.number}`, options: Object.values(q.options) })),
}));
const dialogueSets: ListeningSet[] = dialogueBank.sets.map((set, index) => ({
  id: `listening-39-40-${String(index + 1).padStart(2, "0")}`, practice_type: "39-40", title: `듣기 39–40 · ${index + 1}세트`,
  topics: [set.topic], combination: "대화 전의 내용 + 내용 일치", notice: "가상의 상황", question_count: 2,
  audio_duration_seconds: sets[0].audio.duration_seconds, audio: sets[0].audio,
  questions: set.questions.map((q) => ({ ...q, id: `listening-39-40-${String(index + 1).padStart(2, "0")}-${q.number}`, options: Object.values(q.options) })),
}));
const review: ListeningAttemptReview = {
  id: "saved-listening", practice_type: "43-44", set_id: sets[0].id, set_title: sets[0].title,
  completed_at: "2026-10-11T21:00:00Z", correct_count: 2, question_count: 2, replay_count: 2,
  passage: bank.sets[0].passage, audio: sets[0].audio, topics: sets[0].topics, notice: sets[0].notice,
  questions: sets[0].questions.map((q, index) => ({ ...q, selected_option: bank.answer_key[0].answers[index].correct_option as ListeningOption, correct_option: bank.answer_key[0].answers[index].correct_option as ListeningOption, correct: true, explanation: bank.answer_key[0].answers[index].explanation })),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BASE_URL", "/topik-vocab/");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("playing")); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("pause")); });
  api.getListeningSets.mockResolvedValue(sets);
  api.getListeningSet.mockResolvedValue(sets[0]);
  api.getListeningAttempts.mockResolvedValue([]);
  api.getListeningAttempt.mockResolvedValue(review);
  api.submitListeningAttempt.mockResolvedValue(review);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function renderSession() {
  return render(<MemoryRouter initialEntries={["/listening/set_01"]}><Routes>
    <Route path="/listening/:setId" element={<ListeningPracticeSession />} />
    <Route path="/listening-attempts/:attemptId" element={<ListeningPracticeReview />} />
  </Routes></MemoryRouter>);
}

async function answerBoth() {
  const user = userEvent.setup();
  await user.click(within(screen.getByRole("group", { name: "43번 보기" })).getAllByRole("radio")[1]);
  await user.click(within(screen.getByRole("group", { name: "44번 보기" })).getAllByRole("radio")[3]);
}

describe("listening practice", () => {
  it("lists all eight sets and opens saved attempts with replay counts", async () => {
    api.getListeningAttempts.mockResolvedValue([review]);
    render(<MemoryRouter><ListeningPracticeHome /></MemoryRouter>);
    const catalogue = await screen.findByRole("region", { name: "듣기 연습 세트" });
    await waitFor(() => expect(within(catalogue).getAllByRole("link", { name: "시작하기" })).toHaveLength(8));
    expect(within(catalogue).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(sets.map((set) => `/listening/${set.id}`));
    expect(screen.getByText(/전체 다시 재생 2회/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /2 \/ 2문항 정답/ }).getAttribute("href")).toBe("/listening-attempts/saved-listening");
  });

  it("shows both questions, hides the transcript, and submits before any playback", async () => {
    renderSession();
    await screen.findByRole("group", { name: "43번 보기" });
    expect(screen.getByRole("group", { name: "44번 보기" })).toBeTruthy();
    expect(screen.queryByText(bank.sets[0].passage)).toBeNull();
    expect((screen.getByRole("button", { name: "제출하고 지문 · 해설 보기" }) as HTMLButtonElement).disabled).toBe(true);
    await answerBoth();
    await userEvent.click(screen.getByRole("button", { name: "제출하고 지문 · 해설 보기" }));
    await screen.findByRole("heading", { name: "듣기 연습 결과" });
    expect(screen.getByText(bank.sets[0].passage)).toBeTruthy();
    expect(api.submitListeningAttempt.mock.calls[0][0].replay_count).toBe(0);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("restarts the whole track and logs replays, excluding initial play and pause/resume", async () => {
    const { container } = renderSession();
    const user = userEvent.setup();
    await screen.findByRole("group", { name: "43번 보기" });
    const media = container.querySelector("audio")!;
    expect(media.getAttribute("src")).toContain(`/topik-vocab/${sets[0].audio.path}`);
    await user.click(screen.getByRole("button", { name: "듣기 시작" }));
    expect(screen.getByText("전체 다시 재생 0회")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "일시 정지" }));
    await user.click(screen.getByRole("button", { name: "계속 듣기" }));
    expect(screen.getByText("전체 다시 재생 0회")).toBeTruthy();
    media.currentTime = 25;
    fireEvent.timeUpdate(media);
    await user.click(screen.getByRole("button", { name: "일시 정지" }));
    await user.click(screen.getByRole("button", { name: "계속 듣기" }));
    expect(media.currentTime).toBe(25);
    expect(screen.getByText("전체 다시 재생 0회")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    expect(media.currentTime).toBe(0);
    expect(screen.getByText("전체 다시 재생 1회")).toBeTruthy();
    media.currentTime = sets[0].audio.duration_seconds;
    fireEvent.ended(media);
    await user.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    expect(screen.getByText("전체 다시 재생 2회")).toBeTruthy();
    await answerBoth();
    await user.click(screen.getByRole("button", { name: "제출하고 지문 · 해설 보기" }));
    await screen.findByRole("heading", { name: "듣기 연습 결과" });
    expect(api.submitListeningAttempt.mock.calls[0][0].replay_count).toBe(2);
    expect(screen.getByText(/풀이 중 전체 다시 재생 2회/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "듣기 시작" }));
    await user.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    expect(screen.getByText(/풀이 중 전체 다시 재생 2회/)).toBeTruthy();
  });

  it("preserves the submitted answers and replay count when saving needs a retry", async () => {
    api.submitListeningAttempt.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(review);
    renderSession();
    await screen.findByRole("group", { name: "43번 보기" });
    await userEvent.click(screen.getByRole("button", { name: "듣기 시작" }));
    await userEvent.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    await answerBoth();
    await userEvent.click(screen.getByRole("button", { name: "제출하고 지문 · 해설 보기" }));
    await screen.findByRole("alert");
    expect(screen.queryByText(bank.sets[0].passage)).toBeNull();
    expect((screen.getByRole("button", { name: "전체 다시 듣기" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "같은 답으로 다시 제출" }));
    await screen.findByRole("heading", { name: "듣기 연습 결과" });
    expect(api.submitListeningAttempt.mock.calls[1][0]).toEqual(api.submitListeningAttempt.mock.calls[0][0]);
    expect(api.submitListeningAttempt.mock.calls[1][0].replay_count).toBe(1);
  });

  it("uses the Q39–40 catalogue and routes", async () => {
    api.getListeningSets.mockResolvedValue(dialogueSets);
    render(<MemoryRouter><ListeningPracticeHome practiceType="39-40" /></MemoryRouter>);
    await screen.findByRole("heading", { name: "듣기 39–40 · 6세트" });
    expect(api.getListeningSets).toHaveBeenCalledWith("39-40");
    expect(api.getListeningAttempts).toHaveBeenCalledWith("39-40");
    expect(screen.getAllByRole("link", { name: "시작하기" }).map((link) => link.getAttribute("href"))).toEqual(dialogueSets.map((set) => `/listening-39/${set.id}`));
  });

  it("submits Q39–40 answers and opens the dialogue transcript in its own review", async () => {
    const set = dialogueSets[0];
    const dialogueReview: ListeningAttemptReview = {
      ...review, practice_type: "39-40", set_id: set.id, set_title: set.title, replay_count: 0,
      passage: dialogueBank.sets[0].passage.map((u) => `${u.speaker}: ${u.text}`).join("\n\n"),
      questions: set.questions.map((q, index) => ({ ...q, selected_option: dialogueBank.answer_key[0].answers[index].correct_option as ListeningOption, correct_option: dialogueBank.answer_key[0].answers[index].correct_option as ListeningOption, correct: true, explanation: dialogueBank.answer_key[0].answers[index].explanation })),
    };
    api.getListeningSet.mockResolvedValue(set);
    api.getListeningAttempt.mockResolvedValue(dialogueReview);
    api.submitListeningAttempt.mockResolvedValue(dialogueReview);
    render(<MemoryRouter initialEntries={[`/listening-39/${set.id}`]}><Routes>
      <Route path="/listening-39/:setId" element={<ListeningPracticeSession practiceType="39-40" />} />
      <Route path="/listening-39-attempts/:attemptId" element={<ListeningPracticeReview practiceType="39-40" />} />
    </Routes></MemoryRouter>);
    await screen.findByRole("group", { name: "39번 보기" });
    expect(screen.queryByText(/여자:/)).toBeNull();
    await userEvent.click(within(screen.getByRole("group", { name: "39번 보기" })).getAllByRole("radio")[1]);
    await userEvent.click(within(screen.getByRole("group", { name: "40번 보기" })).getAllByRole("radio")[0]);
    await userEvent.click(screen.getByRole("button", { name: "제출하고 지문 · 해설 보기" }));
    await screen.findByRole("heading", { name: "듣기 연습 결과" });
    expect(screen.getByText(/여자:/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "다시 풀기" }).getAttribute("href")).toBe(`/listening-39/${set.id}`);
    expect(api.submitListeningAttempt.mock.calls[0][0].set_id).toBe(set.id);
  });
});

describe("listening audio lifecycle", () => {
  it("does not count failed starts or rapid duplicate clicks as replays", async () => {
    const onReplay = vi.fn();
    render(<ListeningAudioPlayer audio={sets[0].audio} onReplay={onReplay} />);
    await userEvent.click(screen.getByRole("button", { name: "듣기 시작" }));
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("blocked"));
    await userEvent.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    expect(onReplay).not.toHaveBeenCalled();
    await screen.findByRole("alert");
    let resolve!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    await act(async () => resolve());
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
  });

  it("cancels a pending replay on submission and pauses on unmount", async () => {
    const onReplay = vi.fn();
    const { rerender, unmount } = render(<ListeningAudioPlayer audio={sets[0].audio} onReplay={onReplay} />);
    await userEvent.click(screen.getByRole("button", { name: "듣기 시작" }));
    let resolve!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole("button", { name: "전체 다시 듣기" }));
    rerender(<ListeningAudioPlayer audio={sets[0].audio} disabled onReplay={onReplay} />);
    await act(async () => resolve());
    expect(onReplay).not.toHaveBeenCalled();
    const pauses = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(pauses + 1);
  });

  it("shows both countdowns and the repeat instruction from the audio timestamps", async () => {
    const { container } = render(<ListeningAudioPlayer audio={sets[0].audio} />);
    await userEvent.click(screen.getByRole("button", { name: "듣기 시작" }));
    const media = container.querySelector("audio")!;
    media.currentTime = sets[0].audio.stages.first_end + 1;
    fireEvent.timeUpdate(media);
    expect(screen.getByRole("status").textContent).toContain("다시 듣기 안내까지 4초");
    media.currentTime = sets[0].audio.stages.cue_start + 0.1;
    fireEvent.timeUpdate(media);
    expect(screen.getByRole("status").textContent).toBe("다시 들으십시오.");
    media.currentTime = sets[0].audio.stages.cue_end + 1;
    fireEvent.timeUpdate(media);
    expect(screen.getByRole("status").textContent).toContain("두 번째 듣기까지 4초");
  });

  it("can start again after a pending play was disabled and cancelled", async () => {
    let resolve!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const { rerender } = render(<ListeningAudioPlayer audio={sets[0].audio} />);
    fireEvent.click(screen.getByRole("button", { name: "듣기 시작" }));
    rerender(<ListeningAudioPlayer audio={sets[0].audio} disabled />);
    await act(async () => { await Promise.resolve(); });
    rerender(<ListeningAudioPlayer audio={sets[0].audio} />);
    const start = screen.getByRole("button", { name: "듣기 시작" });
    expect((start as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(start);
    await act(async () => resolve());
    expect(screen.getByRole("button", { name: "일시 정지" })).toBeTruthy();
  });
});
