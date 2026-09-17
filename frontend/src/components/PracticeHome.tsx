import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { practiceSets } from "../data/practiceSets";
import {
  getPracticeAttempts,
  submitPracticeAttempt,
  type PracticeAttemptSummary,
} from "../services/api";
import {
  getPendingPracticeAttempts,
  removePendingPracticeAttempt,
} from "../services/practicePending";

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function practiceLabel(questionType: string): string {
  return questionType.startsWith("q51") ? "Q51" : "Q52";
}

export function PracticeHome() {
  const [attempts, setAttempts] = useState<PracticeAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadAttempts = useCallback(async () => {
    for (const attempt of getPendingPracticeAttempts()) {
      try {
        await submitPracticeAttempt(attempt);
        removePendingPracticeAttempt(attempt.id);
      } catch {
        // Keep unsaved attempts for the next automatic or manual retry.
      }
    }

    const data = await getPracticeAttempts();
    setAttempts(data ?? []);
    setLoadError(data === null);
    setPendingCount(getPendingPracticeAttempts().length);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAttempts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAttempts]);

  async function refreshAttempts(): Promise<void> {
    setSyncing(true);
    await loadAttempts();
    setSyncing(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">빠른 훈련</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Q51·Q52를 한 문제씩 1분 안에 풀고, 끝난 뒤 예시 답안과 함께 복습하세요.
        </p>
      </header>

      <section className="space-y-3" aria-label="연습 세트">
        {practiceSets.map((set) => (
          <article
            key={set.id}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {practiceLabel(set.question_type)}
                </span>
                <h2 className="mt-3 font-semibold text-gray-900">{set.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {set.description}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-400">
              <span>{set.questions.length}문제 · 문제당 {set.target_seconds_per_question}초</span>
              <Link
                to={`/practice/${set.id}`}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                시작하기
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3" aria-label="저장된 풀이">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">최근 풀이</h2>
          {!loading && (
            <button
              type="button"
              onClick={() => void refreshAttempts()}
              disabled={syncing}
              className="text-xs font-medium text-blue-600 hover:underline disabled:text-gray-400"
            >
              {syncing ? "동기화 중…" : "새로 고침"}
            </button>
          )}
        </div>

        {pendingCount > 0 && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            저장하지 못한 풀이 {pendingCount}개가 있습니다. 연결되면 자동으로 저장하며, 새로 고침을 눌러 다시 시도할 수 있습니다.
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">풀이 기록을 불러오는 중…</p>
        ) : loadError ? (
          <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            풀이 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : attempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            아직 저장된 풀이가 없습니다. 첫 세트를 시작해 보세요.
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/practice-attempts/${attempt.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{attempt.set_title}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(attempt.completed_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-700">
                    {formatDuration(attempt.total_time_ms)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  {attempt.question_count}문제 · 1분 안에 푼 문제 {attempt.within_target_count}개
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
