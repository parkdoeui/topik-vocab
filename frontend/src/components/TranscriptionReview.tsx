import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { writingTests } from "../data/tests";
import { submitWritingSession } from "../services/api";
import { getSessionImages, loadWritingDraft } from "../services/session";
import { LoadingSpinner } from "./LoadingSpinner";

function countChars(s: string): number {
  return s.replace(/\s/g, "").length;
}

function CharCount({
  count,
  min,
  max,
}: {
  count: number;
  min?: number;
  max?: number;
}) {
  const tooShort = min !== undefined && count < min;
  const tooLong = max !== undefined && count > max;
  const color = tooShort || tooLong ? "text-red-500" : "text-green-600";

  return (
    <span className={`text-xs font-mono ${color}`}>
      {count}자{min && max ? ` (${min}–${max}자)` : ""}
    </span>
  );
}

export function TranscriptionReview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const test = writingTests.find((t) => t.id === id);
  const sessionId = searchParams.get("session") ?? "";
  const draft = loadWritingDraft(sessionId);
  const sessionImages = getSessionImages(sessionId);

  const [transcriptions, setTranscriptions] = useState<Record<number, string>>(
    () => draft?.transcriptions ?? {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!test || !draft) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        세션 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const completedAt = new Date().toISOString();
    const answers: Record<string, { image_urls: string[]; transcription: string; char_count: number }> = {};

    for (const q of test!.questions) {
      const text = transcriptions[q.number] ?? "";
      answers[String(q.number)] = {
        image_urls: [],
        transcription: text,
        char_count: countChars(text),
      };
    }

    const result = await submitWritingSession({
      id: draft!.id,
      test_id: draft!.testId,
      started_at: draft!.startedAt,
      completed_at: completedAt,
      total_time_ms: draft!.elapsedMs,
      answers,
    });

    if (!result) {
      setError("채점 요청에 실패했습니다. 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    localStorage.setItem(
      `topik-writing-result-${draft!.id}`,
      JSON.stringify(result)
    );
    navigate(`/writing-results/${draft!.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">답안 확인</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI가 인식한 내용을 확인하고 수정한 뒤 채점을 요청하세요.
        </p>
      </div>

      {test.questions.map((q) => {
        const imgs = sessionImages?.[q.number] ?? [];
        const text = transcriptions[q.number] ?? "";
        const chars = countChars(text);

        return (
          <div key={q.number} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{q.number}번</span>
              <span className="text-xs text-gray-400">{q.max_points}점</span>
            </div>

            {/* Uploaded image thumbnails */}
            {imgs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imgs.map((img, i) => (
                  <img
                    key={i}
                    src={`data:${img.mime_type};base64,${img.data}`}
                    alt={`답안 사진 ${i + 1}`}
                    className="h-24 w-auto rounded-lg border border-gray-200 shrink-0"
                  />
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">인식된 답안</label>
                <CharCount count={chars} min={q.min_chars} max={q.max_chars} />
              </div>
              <textarea
                value={text}
                onChange={(e) =>
                  setTranscriptions((prev) => ({
                    ...prev,
                    [q.number]: e.target.value,
                  }))
                }
                rows={q.type === "essay" ? 10 : q.type === "chart-description" ? 6 : 3}
                className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="답안이 없으면 직접 입력하세요."
              />
            </div>
          </div>
        );
      })}

      {error && <p role="alert" className="text-sm text-red-500 text-center">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        aria-busy={submitting}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold transition-colors"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            채점 중…
          </span>
        ) : (
          "채점 요청"
        )}
      </button>
    </div>
  );
}
