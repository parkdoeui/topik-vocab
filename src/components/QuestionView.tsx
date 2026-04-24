import type { TopikQuestion, VocabWord } from "../types";
import ClickableWord from "./ClickableWord";

interface QuestionViewProps {
  question: TopikQuestion;
  testId: string;
  basket: VocabWord[];
  apiKey?: string;
  selectedAnswer: number | null;
  onSelectAnswer: (choice: number) => void;
  onWordSaved: (word: VocabWord) => void;
  showTranslation: boolean;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/);
}

function hasKorean(token: string): boolean {
  return /[\uAC00-\uD7A3\u1100-\u11FF]/.test(token);
}

function extractWord(token: string): string {
  return token.replace(
    /^[^\uAC00-\uD7A3\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]+|[^\uAC00-\uD7A3\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]+$/g,
    ""
  );
}

function ClickableText({
  text,
  testId,
  questionNumber,
  basket,
  apiKey,
  vocabMap,
  onWordSaved,
  showTranslation,
}: {
  text: string;
  testId: string;
  questionNumber: number;
  basket: VocabWord[];
  apiKey?: string;
  vocabMap?: TopikQuestion["단어맵"];
  onWordSaved: (word: VocabWord) => void;
  showTranslation: boolean;
}) {
  const savedKoreanWords = new Set(basket.map((w) => w.korean));
  const savedOriginalWords = vocabMap
    ? new Set(
      vocabMap
        .filter((entry) => savedKoreanWords.has(entry.root))
        .map((entry) => entry.original_word)
    )
    : null;
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (/^\s+$/.test(token)) return token;
        const wordOnly = extractWord(token);
        if (!hasKorean(token) || !wordOnly) {
          return <span key={i}>{token}</span>;
        }
        return (
          <ClickableWord
            key={`${questionNumber}-${i}-${wordOnly}`}
            word={token}
            testId={testId}
            questionNumber={questionNumber}
            exampleSentence={text}
            apiKey={apiKey}
            vocabMap={vocabMap}
            isSaved={
              savedKoreanWords.has(wordOnly) ||
              !!savedOriginalWords?.has(wordOnly)
            }
            onSaved={onWordSaved}
            showTranslation={showTranslation}
          />
        );
      })}
    </>
  );
}

const CHOICE_LABELS = ["①", "②", "③", "④"] as const;

export default function QuestionView({
  question,
  testId,
  basket,
  apiKey,
  selectedAnswer,
  onSelectAnswer,
  onWordSaved,
}: QuestionViewProps) {
  const choices = Object.entries(question.선택지);
  return (
    <article className="space-y-4">
      {/* Question number + points */}
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-gray-900">
          {question.문제_번호}.
        </span>
        <span className="text-xs text-gray-400">{question.배점}</span>
        <span className="text-xs text-gray-400 ml-auto">{question.주제}</span>
      </div>

      {/* Instruction */}
      <p className="text-sm text-gray-600">{question.지시문}</p>

      {/* Question content */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-xs text-gray-400 mb-3">
          Hover a word to see its translation · Click to save it
        </p>
        {question.문제_내용.split(/\n+/).map((line, li) => (
          <p
            key={li}
            className="mb-2 last:mb-0 leading-8 text-gray-800 text-[17px]"
          >
            <ClickableText
              text={line}
              testId={testId}
              questionNumber={question.문제_번호}
              basket={basket}
              apiKey={apiKey}
              vocabMap={question.단어맵}
              onWordSaved={onWordSaved}
            />
          </p>
        ))}
      </div>

      {/* Choices */}
      <div className="space-y-2">
        {choices.map(([key, value], idx) => {
          const choiceNum = Number(key);
          const isSelected = selectedAnswer === choiceNum;
          return (
            <div
              key={key}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
                }`}
            >
              {/* Number label — click to select answer */}
              <button
                type="button"
                onClick={() => onSelectAnswer(choiceNum)}
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                {CHOICE_LABELS[idx]}
              </button>

              {/* Choice text — words are clickable for vocab */}
              <span className="leading-7 text-gray-800 text-[16px]">
                <ClickableText
                  text={value}
                  testId={testId}
                  questionNumber={question.문제_번호}
                  basket={basket}
                  apiKey={apiKey}
                  vocabMap={question.단어맵}
                  onWordSaved={onWordSaved}
                />
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
