import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  getReadingSet,
  readingOptionMarkers,
  readingPracticeConfig,
  submitReadingAttempt,
  type ReadingAttemptPayload,
  type ReadingOption,
  type ReadingPracticeType,
  type ReadingSet,
} from "../services/readingApi";

export function ReadingPracticeSession({ practiceType = "28-31" }: { practiceType?: ReadingPracticeType }) {
  const { setId } = useParams<{ setId: string }>();
  return <ReadingSession key={`${practiceType}:${setId}`} setId={setId ?? ""} practiceType={practiceType} />;
}

function ReadingSession({ setId, practiceType }: { setId: string; practiceType: ReadingPracticeType }) {
  const config = readingPracticeConfig[practiceType];
  const navigate = useNavigate();
  const [set, setSet] = useState<ReadingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ReadingOption>>({});
  const [attemptId] = useState(() => crypto.randomUUID());
  const [submittedPayload, setSubmittedPayload] = useState<ReadingAttemptPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitting = useRef(false);
  const sessionActive = useRef(false);

  useEffect(() => {
    let active = true;
    sessionActive.current = true;
    void getReadingSet(setId)
      .then((data) => {
        if (data.practice_type !== practiceType) throw new Error("Reading practice type mismatch");
        if (active) setSet(data);
      })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; sessionActive.current = false; };
  }, [setId, practiceType]);

  const allAnswered = set?.questions.every((question) => answers[question.id] !== undefined) ?? false;

  async function submit(): Promise<void> {
    if (!set || !allAnswered || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveFailed(false);
    const payload = submittedPayload ?? {
      id: attemptId,
      set_id: set.id,
      answers: set.questions.map((question) => ({ question_id: question.id, selected_option: answers[question.id] })),
    };
    setSubmittedPayload(payload);
    try {
      const attempt = await submitReadingAttempt(payload);
      if (sessionActive.current) navigate(`${config.reviewPath}/${attempt.id}`, { replace: true });
    } catch {
      if (sessionActive.current) setSaveFailed(true);
    } finally {
      submitting.current = false;
      if (sessionActive.current) setSaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-gray-400">읽기 문제를 준비하는 중…</p>;
  if (loadFailed || !set) return (
    <div className="px-4 py-16 text-center text-sm text-gray-500">
      <p role="alert">읽기 문제를 불러오지 못했습니다. 세트를 다시 선택해 주세요.</p>
      <Link to={config.homePath} className="mt-3 inline-block text-blue-600 hover:underline">읽기 연습으로</Link>
    </div>
  );

  const question = set.questions[questionIndex];
  const selected = answers[question.id];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-5">
      <header>
        <Link to={config.homePath} className="text-xs font-medium text-blue-600 hover:underline">← {config.title}</Link>
        <p className="mt-2 text-xs text-gray-400">{set.title}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold text-gray-700">{questionIndex + 1} / {set.questions.length}문항</h1>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{practiceType === "19" ? config.badge : question.topic}</span>
        </div>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="답안 선택 진행률" aria-valuemin={0} aria-valuemax={set.questions.length} aria-valuenow={Object.keys(answers).length}>
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(Object.keys(answers).length / set.questions.length) * 100}%` }} />
      </div>
      <p className="text-xs leading-relaxed text-gray-500">보기 하나를 선택한 뒤 다음 문제로 이동하세요. {set.questions.length}문항을 모두 풀면 마지막 문제에서 제출할 수 있습니다.</p>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
        <p className="text-sm font-semibold leading-relaxed text-gray-700">{set.instruction}</p>
        <p className="whitespace-pre-wrap text-base leading-loose text-gray-900">{question.prompt}</p>
        <fieldset disabled={saving || submittedPayload !== null} className="space-y-2">
          <legend className="mb-3 text-sm font-semibold text-gray-700">보기</legend>
          {question.options.map((option, index) => (
            <label key={index} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed transition focus-within:ring-2 focus-within:ring-blue-400 ${selected === index + 1 ? "border-blue-400 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
              <input type="radio" name={question.id} value={index + 1} checked={selected === index + 1} onChange={() => { setAnswers((current) => ({ ...current, [question.id]: (index + 1) as ReadingOption })); setSaveFailed(false); }} className="mt-1 shrink-0 accent-blue-600" />
              <span>{readingOptionMarkers[index]} {option}</span>
            </label>
          ))}
        </fieldset>
      </article>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={questionIndex === 0 || saving} onClick={() => setQuestionIndex((index) => index - 1)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">이전 문제</button>
        {questionIndex < set.questions.length - 1 ? (
          <button type="button" disabled={selected === undefined || saving} onClick={() => setQuestionIndex((index) => index + 1)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">다음 문제</button>
        ) : (
          <button type="button" disabled={!allAnswered || saving} onClick={() => void submit()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">{saving ? "저장 중…" : "제출하고 해설 보기"}</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="문항 이동">
        {set.questions.map((item, index) => (
          <button key={item.id} type="button" disabled={saving} aria-current={questionIndex === index ? "step" : undefined} onClick={() => setQuestionIndex(index)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${questionIndex === index ? "border-blue-400 bg-blue-50 text-blue-700" : answers[item.id] ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}>
            {index + 1}. {practiceType === "19" ? "문항" : item.topic}{answers[item.id] ? " · 선택 완료" : ""}
          </button>
        ))}
      </div>
      {!allAnswered && questionIndex === set.questions.length - 1 && <p className="text-xs text-gray-500">{set.questions.length}문항의 보기를 모두 선택하면 제출할 수 있습니다.</p>}
      {saveFailed && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">답안 저장을 확인하지 못했습니다. 제출한 답은 유지됩니다. 같은 답으로 다시 제출해 주세요.</p>}
    </div>
  );
}
