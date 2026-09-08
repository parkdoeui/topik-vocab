const CHOICES = ["①", "②", "③", "④"] as const;

interface AnswerSheetProps {
  totalQuestions: number;
  answers: Record<string, number>;
  correctAnswers?: Record<string, number | null>;
  onSelect?: (questionNumber: number, choice: number) => void;
  readOnly?: boolean;
}

export function AnswerSheet({
  totalQuestions,
  answers,
  correctAnswers,
  onSelect,
  readOnly = false,
}: AnswerSheetProps) {
  return (
    <div className="grid grid-cols-5 gap-1 select-none">
      {Array.from({ length: totalQuestions }, (_, i) => {
        const num = i + 1;
        const key = String(num);
        const selected = answers[key];
        const correct = correctAnswers?.[key];
        const isReview = readOnly && correct !== undefined && correct !== null;

        return (
          <div key={num} className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 mb-0.5">{num}</span>
            <div className="flex gap-0.5">
              {CHOICES.map((label, idx) => {
                const choice = idx + 1;
                const isSelected = selected === choice;
                const isCorrectChoice = isReview && correct === choice;
                const isWrongSelected = isReview && isSelected && !isCorrectChoice;

                let cls =
                  "w-5 h-5 text-[10px] flex items-center justify-center rounded cursor-pointer border transition-colors ";
                if (isCorrectChoice && isSelected) {
                  cls += "bg-green-500 border-green-500 text-white";
                } else if (isCorrectChoice) {
                  cls += "bg-green-100 border-green-400 text-green-700";
                } else if (isWrongSelected) {
                  cls += "bg-red-100 border-red-400 text-red-700";
                } else if (isSelected) {
                  cls += "bg-blue-600 border-blue-600 text-white";
                } else {
                  cls += "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600";
                }

                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={readOnly}
                    onClick={() => !readOnly && onSelect?.(num, choice)}
                    className={cls}
                    aria-label={`Q${num} choice ${choice}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
