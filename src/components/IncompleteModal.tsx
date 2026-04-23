interface IncompleteModalProps {
  missingNumbers: number[];
  onClose: () => void;
}

export default function IncompleteModal({ missingNumbers, onClose }: IncompleteModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4 pointer-events-auto">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">Not all questions answered</p>
            <p className="text-sm text-gray-500 mt-1">
              Please answer all {missingNumbers.length === 1 ? "the remaining question" : `the remaining ${missingNumbers.length} questions`} before submitting.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-400 mb-1.5">Unanswered questions</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {missingNumbers.join(", ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
