import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { writingTests } from "../data/tests";
import { getProgress, startWritingSession } from "../services/api";
import type { WritingSessionResponse } from "../services/api";
import { newSessionId } from "../services/session";

const TYPE_LABELS: Record<string, string> = {
  "short-blank": "단문 쓰기",
  "chart-description": "도표 설명",
  "essay": "논설문",
};

type LatestResult = { id: string; date: string };

function getCachedLatestResults(): Record<string, LatestResult> {
  const latest: Record<string, LatestResult> = {};

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      try {
        const key = localStorage.key(index);
        if (!key?.startsWith("topik-writing-result-")) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const result = JSON.parse(raw) as Partial<WritingSessionResponse>;
        if (!result?.id || !result.test_id || !result.completed_at) continue;

        const current = latest[result.test_id];
        if (!current || result.completed_at > current.date) {
          latest[result.test_id] = { id: result.id, date: result.completed_at };
        }
      } catch {
        // Ignore an invalid cached result without hiding the remaining results.
      }
    }
  } catch {
    // Server progress still provides result links when storage is unavailable.
  }

  return latest;
}

export function WritingHome() {
  const navigate = useNavigate();
  const [latestResultByTest, setLatestResultByTest] =
    useState<Record<string, LatestResult>>(getCachedLatestResults);
  const [startingTestId, setStartingTestId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgress().then((progress) => {
      if (cancelled || !progress) return;

      setLatestResultByTest((currentResults) => {
        const latest = { ...currentResults };
        for (const session of progress.sessions) {
          const current = latest[session.test_id];
          if (!current || session.date > current.date) {
            latest[session.test_id] = { id: session.id, date: session.date };
          }
        }
        return latest;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startTest(testId: string): Promise<void> {
    if (startingTestId) return;
    const sessionId = newSessionId();
    setStartingTestId(testId);
    setStartError(null);

    const started = await startWritingSession({ id: sessionId, test_id: testId });
    if (!started) {
      setStartError("시험 시작 시간을 저장하지 못했습니다. 다시 시도해 주세요.");
      setStartingTestId(null);
      return;
    }

    navigate(`/writing/${testId}?session=${sessionId}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">TOPIK II 쓰기</h1>
      <p className="text-sm text-gray-500 mb-8">
        손으로 쓴 답안 사진을 업로드하면 AI가 채점합니다.
      </p>

      {startError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {startError}
        </p>
      )}

      <div className="space-y-3">
        {writingTests.map((test) => {
          const types = [...new Set(test.questions.map((q) => TYPE_LABELS[q.type] ?? q.type))];
          const totalPoints = test.questions.reduce((s, q) => s + q.max_points, 0);
          const result = latestResultByTest[test.id];

          return (
            <div
              key={test.id}
              className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{test.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {test.questions.length}문제 · {totalPoints}점 · {test.time_limit_minutes}분
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {types.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => void startTest(test.id)}
                  disabled={startingTestId !== null}
                  className="flex-1 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 sm:flex-none"
                >
                  {startingTestId === test.id ? "시작 중…" : "시작"}
                </button>
                {result && (
                  <Link
                    to={`/writing-results/${result.id}`}
                    className="flex-1 whitespace-nowrap rounded-xl border border-blue-200 px-4 py-2 text-center text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 sm:flex-none"
                  >
                    채점 결과 보기
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {writingTests.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            등록된 시험이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
