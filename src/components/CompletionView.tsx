import type { TestSession } from "../services/session";

interface CompletionViewProps {
  session: TestSession;
  onRestart: () => void;
}

export default function CompletionView({ session, onRestart }: CompletionViewProps) {
  const { score, savedWords, totalTimeMs } = session;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-blue-600 mb-1">{pct}%</div>
          <p className="text-gray-500 text-sm">
            {score.correct} / {score.total} correct
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xl font-semibold text-gray-900">
              {minutes}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Time</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xl font-semibold text-gray-900">{savedWords.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">Words saved</div>
          </div>
        </div>

        {savedWords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Saved words
            </p>
            <ul className="space-y-1">
              {savedWords.map((w, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-gray-900">{w.korean}</span>
                  <span className="text-gray-400">{w.english}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-center text-green-600 font-medium">
          Your results have been submitted.
        </p>

        <button
          type="button"
          onClick={onRestart}
          className="w-full rounded-lg border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium py-2.5 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
