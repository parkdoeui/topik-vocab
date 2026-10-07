import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  getReadingAttempts,
  getReadingSets,
  type ReadingAttemptSummary,
  type ReadingSetSummary,
} from "../services/readingApi";

function topicDescription(topics: string[]): string {
  const counts = new Map<string, number>();
  for (const topic of topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  if ([...counts.values()].every((count) => count === 1)) {
    return `${topics.join(" · ")} · 주제별 1문항`;
  }
  return [...counts].map(([topic, count]) => `${topic} ${count}문항`).join(" · ");
}

export function ReadingPracticeHome() {
  const [sets, setSets] = useState<ReadingSetSummary[]>([]);
  const [attempts, setAttempts] = useState<ReadingAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [setsFailed, setSetsFailed] = useState(false);
  const [attemptsFailed, setAttemptsFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getReadingSets(), getReadingAttempts()]).then(([setResult, attemptResult]) => {
      if (!active) return;
      if (setResult.status === "fulfilled") setSets(setResult.value);
      if (attemptResult.status === "fulfilled") setAttempts(attemptResult.value);
      setSetsFailed(setResult.status === "rejected");
      setAttemptsFailed(attemptResult.status === "rejected");
      setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-8">
      <header>
        <p className="mb-2 text-xs font-medium text-blue-600">TOPIK II · 읽기 28–31번 유형</p>
        <h1 className="text-2xl font-bold text-gray-900">읽기 28–31 연습</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          원하는 주제의 세트를 골라 4문항을 풀어 보세요. 지문을 읽고 빈칸에 가장 알맞은 보기를 고르면 제출 후 정답과 근거 해설을 확인할 수 있습니다.
        </p>
        {sets[0] && <p className="mt-2 text-xs text-gray-400">{sets[0].notice}</p>}
      </header>

      {loading && <p className="py-8 text-center text-sm text-gray-400">읽기 세트를 불러오는 중…</p>}
      {setsFailed && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">읽기 세트를 불러오지 못했습니다. 다시 시도해 주세요.</p>}
      <section className="space-y-3" aria-label="읽기 연습 세트">
        {sets.map((set) => (
          <article key={set.id} className="rounded-2xl border border-gray-200 bg-white p-5">
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">빈칸 추론</span>
            <h2 className="mt-3 font-semibold text-gray-900">{set.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{topicDescription(set.topics)}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">{set.question_count}문항 · 문항별 {set.points_per_question}점 · 총 {set.question_count * set.points_per_question}점</p>
              <Link to={`/reading/${set.id}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">시작하기</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3" aria-label="저장된 읽기 풀이">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">최근 풀이</h2>
          <button type="button" disabled={loading} onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="text-xs font-medium text-blue-600 hover:underline disabled:text-gray-400">
            {loading ? "불러오는 중…" : "새로 고침"}
          </button>
        </div>
        {attemptsFailed ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">풀이 기록을 불러오지 못했습니다. 다시 시도해 주세요.</p>
        ) : !loading && attempts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">아직 저장된 풀이가 없습니다. 첫 세트를 시작해 보세요.</p>
        ) : attempts.map((attempt) => (
          <Link key={attempt.id} to={`/reading-attempts/${attempt.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-200">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-gray-900">{attempt.set_title}</p>
              <span className="shrink-0 text-sm font-semibold text-gray-700">{attempt.score} / {attempt.max_score}점</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{new Date(attempt.completed_at).toLocaleString("ko-KR")} · {attempt.correct_count} / {attempt.question_count}문항 정답</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
