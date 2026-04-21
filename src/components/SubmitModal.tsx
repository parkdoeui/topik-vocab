interface SubmitModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SubmitModal({ onConfirm, onCancel }: SubmitModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/40 z-50"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs space-y-4 pointer-events-auto">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">Submit test?</p>
            <p className="text-sm text-gray-500 mt-1">
              Your answers will be recorded and cannot be changed.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
