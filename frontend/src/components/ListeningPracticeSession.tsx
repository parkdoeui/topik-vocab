import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getListeningSet, listeningOptionMarkers, listeningPracticeConfig, submitListeningAttempt, type ListeningAttemptPayload, type ListeningOption, type ListeningPracticeType, type ListeningSet } from "../services/listeningApi";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";

export function ListeningPracticeSession({ practiceType = "43-44" }: { practiceType?: ListeningPracticeType }) {
  const { setId } = useParams<{ setId: string }>();
  return <ListeningSession key={`${practiceType}:${setId}`} setId={setId ?? ""} practiceType={practiceType} />;
}

function ListeningSession({ setId, practiceType }: { setId: string; practiceType: ListeningPracticeType }) {
  const config = listeningPracticeConfig[practiceType];
  const navigate = useNavigate();
  const [set, setSet] = useState<ListeningSet | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ListeningOption>>({});
  const [replayCount, setReplayCount] = useState(0);
  const [attemptId] = useState(() => crypto.randomUUID());
  const [payload, setPayload] = useState<ListeningAttemptPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    let current = true;
    active.current = true;
    void getListeningSet(setId).then((data) => {
      if (data.practice_type !== practiceType) throw new Error("Listening practice type mismatch");
      if (current) setSet(data);
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; active.current = false; };
  }, [setId, practiceType]);

  const allAnswered = set?.questions.every((question) => answers[question.id] !== undefined) ?? false;

  async function submit(): Promise<void> {
    if (!set || !allAnswered || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveFailed(false);
    const submitted = payload ?? {
      id: attemptId, set_id: set.id, replay_count: replayCount,
      answers: set.questions.map((question) => ({ question_id: question.id, selected_option: answers[question.id] })),
    };
    setPayload(submitted);
    try {
      const attempt = await submitListeningAttempt(submitted);
      if (active.current) navigate(`${config.reviewPath}/${attempt.id}`, { replace: true });
    } catch {
      if (active.current) setSaveFailed(true);
    } finally {
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  }

  if (failed) return <div className="px-4 py-16 text-center text-sm text-gray-500"><p role="alert">듣기 문제를 불러오지 못했습니다. 세트를 다시 선택해 주세요.</p><Link to={config.homePath} className="mt-3 inline-block text-blue-600 hover:underline">듣기 연습으로</Link></div>;
  if (!set) return <p className="py-16 text-center text-sm text-gray-400">듣기 문제를 준비하는 중…</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-5">
      <header>
        <Link to={config.homePath} className="text-xs font-medium text-blue-600 hover:underline">← {config.title}</Link>
        <p className="mt-2 text-xs text-gray-400">{set.title}</p>
        <h1 className="mt-1 text-lg font-bold text-gray-900">{set.questions.map((question) => question.number).join(" · ")}번 문제</h1>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">두 문제의 보기를 모두 선택하면 음성이 끝나기 전에도 제출할 수 있습니다.</p>
      </header>
      <ListeningAudioPlayer audio={set.audio} disabled={payload !== null} replayCount={replayCount} onReplay={() => setReplayCount((count) => count + 1)} />
      <section className="space-y-4" aria-label="듣기 문제">
        {set.questions.map((question) => (
          <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-gray-900">{question.number}번</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{question.type}</span></div>
            <p className="text-sm font-semibold leading-relaxed text-gray-800">{question.prompt}</p>
            <fieldset disabled={payload !== null} className="space-y-2">
              <legend className="sr-only">{question.number}번 보기</legend>
              {question.options.map((option, index) => (
                <label key={index} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-blue-400 ${answers[question.id] === index + 1 ? "border-blue-400 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input type="radio" name={question.id} value={index + 1} checked={answers[question.id] === index + 1} onChange={() => setAnswers((current) => ({ ...current, [question.id]: index + 1 as ListeningOption }))} className="mt-1 shrink-0 accent-blue-600" />
                  <span>{listeningOptionMarkers[index]} {option}</span>
                </label>
              ))}
            </fieldset>
          </article>
        ))}
      </section>
      <button type="button" disabled={!allAnswered || saving} onClick={() => void submit()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">{saving ? "저장 중…" : saveFailed ? "같은 답으로 다시 제출" : "제출하고 지문 · 해설 보기"}</button>
      {saveFailed && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">답안 저장을 확인하지 못했습니다. 답안과 다시 재생 횟수는 유지됩니다. 같은 내용으로 다시 제출해 주세요.</p>}
    </div>
  );
}
