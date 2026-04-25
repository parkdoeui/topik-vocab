import type { QuizSet } from "../data/quizData";

interface ReviewSetListProps {
  quizSets: QuizSet[];
  clearedSets: Set<number>;
  onSelectSet: (quizSet: QuizSet) => void;
}

export default function ReviewSetList({ quizSets, clearedSets, onSelectSet }: ReviewSetListProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Quiz Sets</h2>
      <p className="text-sm text-gray-400 mb-6">Select a set to study flashcards or take a quiz.</p>

      <div className="flex flex-col gap-3">
        {quizSets.map((qs) => {
          const cleared = clearedSets.has(qs.id);
          return (
            <button
              key={qs.id}
              onClick={() => onSelectSet(qs)}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
            >
              <div>
                <p className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                  {qs.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{qs.cards.length} words</p>
              </div>
              <div className="flex items-center gap-3">
                {cleared && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 rounded-full px-2.5 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                    Cleared
                  </span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors">
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
