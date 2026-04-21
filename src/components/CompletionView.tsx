interface CompletionViewProps {
  onRestart: () => void;
}

export default function CompletionView({ onRestart }: CompletionViewProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">Test submitted</p>
          <p className="text-sm text-gray-400 mt-1">Your answers have been recorded.</p>
        </div>

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
