import { useState, useCallback, useRef, useEffect } from "react";
import { tests } from "./data/tests";
import { sendSessionData } from "./services/analytics";
import { saveSession } from "./services/session";
import type { SavedWordRecord, TestSession } from "./services/session";
import type { VocabWord } from "./types";
import Header from "./components/Header";
import TestSelector from "./components/TestSelector";
import QuestionView from "./components/QuestionView";
import QuestionNav from "./components/QuestionNav";
import Sidebar from "./components/Sidebar";
import BasketDrawer from "./components/BasketDrawer";
import AccessGate, { isAccessGranted } from "./components/AccessGate";
import CompletionView from "./components/CompletionView";
import SubmitModal from "./components/SubmitModal";
import IncompleteModal from "./components/IncompleteModal";

export default function App() {
  const [accessGranted, setAccessGranted] = useState(() => isAccessGranted());
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0].id);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [basket, setBasket] = useState<VocabWord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("krdict-api-key") ?? ""
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});

  // Session timing refs (don't trigger re-renders)
  const sessionStartRef = useRef<number>(Date.now());
  const questionEnteredAtRef = useRef<number>(Date.now());

  const selectedTest = tests.find((t) => t.id === selectedTestId) ?? tests[0];
  const question = selectedTest.questions[questionIndex];

  const buildSession = useCallback((timings: Record<string, number>): TestSession => {
    const now = Date.now();
    const savedWords: SavedWordRecord[] = basket
      .filter((w) => w.testId === selectedTestId)
      .map((w) => ({ korean: w.korean, english: w.english, questionNumber: w.questionNumber }));

    let correct = 0;
    const answerRecords: Record<string, { selected: number; correct: boolean; timeSpentMs: number }> = {};
    for (const q of selectedTest.questions) {
      const key = `${selectedTestId}-${q.문제_번호}`;
      const qNum = String(q.문제_번호);
      const timeSpentMs = timings[qNum] ?? 0;
      if (key in answers) {
        const selected = answers[key];
        const isCorrect = selected === q.정답;
        if (isCorrect) correct++;
        answerRecords[qNum] = { selected, correct: isCorrect, timeSpentMs };
      } else if (timeSpentMs > 0) {
        // Visited but not answered — record timing only
        answerRecords[qNum] = { selected: 0, correct: false, timeSpentMs };
      }
    }

    return {
      testId: selectedTestId,
      startedAt: new Date(sessionStartRef.current).toISOString(),
      completedAt: new Date(now).toISOString(),
      totalTimeMs: now - sessionStartRef.current,
      answers: answerRecords,
      savedWords,
      score: { correct, total: selectedTest.questions.length },
    };
  }, [answers, basket, selectedTestId, selectedTest]);

  // Auto-save session whenever answers, timings, or basket change
  useEffect(() => {
    saveSession(buildSession(questionTimings));
  }, [answers, questionTimings, basket, selectedTestId, selectedTest]);

  const handleWordSaved = useCallback((word: VocabWord) => {
    setBasket((prev) => {
      if (prev.find((w) => w.id === word.id)) return prev;
      return [...prev, word];
    });
  }, []);

  const handleWordRemoved = useCallback((id: string) => {
    setBasket((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleSelectTest = (id: string) => {
    setSelectedTestId(id);
    setQuestionIndex(0);
    setAnswers({});
    setQuestionTimings({});
    setBasket([]);
    setCompleted(false);
    sessionStartRef.current = Date.now();
    questionEnteredAtRef.current = Date.now();
  };

  const handleQuestionChange = (newIndex: number) => {
    const now = Date.now();
    const elapsed = now - questionEnteredAtRef.current;
    const prevQNum = String(question.문제_번호);
    setQuestionTimings((prev) => ({
      ...prev,
      [prevQNum]: (prev[prevQNum] ?? 0) + elapsed,
    }));
    questionEnteredAtRef.current = now;
    setQuestionIndex(newIndex);
  };

  const handleSelectAnswer = (choice: number) => {
    const answerKey = `${selectedTestId}-${question.문제_번호}`;
    const newAnswers = { ...answers, [answerKey]: choice };
    setAnswers(newAnswers);
    const nextIndex = questionIndex + 1;
    if (nextIndex < selectedTest.questions.length) {
      handleQuestionChange(nextIndex);
    }
    // If all questions now answered, show submit modal
    const nowAllAnswered = selectedTest.questions.every(
      (q) => `${selectedTestId}-${q.문제_번호}` in newAnswers
    );
    if (nowAllAnswered) {
      setShowSubmitModal(true);
    }
  };

  const handleSubmit = () => {
    // Capture final question's elapsed time before sending
    const now = Date.now();
    const elapsed = now - questionEnteredAtRef.current;
    const currQNum = String(question.문제_번호);
    const finalTimings = {
      ...questionTimings,
      [currQNum]: (questionTimings[currQNum] ?? 0) + elapsed,
    };
    const session = buildSession(finalTimings);
    saveSession(session);
    sendSessionData(session);
    setCompleted(true);
  };

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [incompleteNumbers, setIncompleteNumbers] = useState<number[] | null>(null);

  const answerKey = `${selectedTestId}-${question.문제_번호}`;
  const selectedAnswer = answers[answerKey] ?? null;


  if (!accessGranted) {
    return <AccessGate onGranted={() => setAccessGranted(true)} />;
  }

  if (completed) {
    return (
      <CompletionView
        onRestart={() => {
          setCompleted(false);
          setAnswers({});
          setQuestionTimings({});
          setBasket([]);
          setQuestionIndex(0);
          sessionStartRef.current = Date.now();
          questionEnteredAtRef.current = Date.now();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-yellow-100 text-xs text-gray-700 px-2 py-1 font-mono truncate">
        ANALYTICS_URL: {import.meta.env.VITE_ANALYTICS_URL ?? "(not set)"}
      </div>
      <Header
        basketCount={basket.length}
        onBasketClick={() => setDrawerOpen(true)}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        showTranslation={showTranslation}
        onToggleTranslation={() => setShowTranslation((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <TestSelector
              tests={tests}
              selectedId={selectedTestId}
              onSelect={handleSelectTest}
            />
            <QuestionNav
              current={questionIndex + 1}
              total={selectedTest.questions.length}
              onPrev={() => handleQuestionChange(Math.max(0, questionIndex - 1))}
              onNext={() => handleQuestionChange(Math.min(selectedTest.questions.length - 1, questionIndex + 1))}
            />
            <QuestionView
              question={question}
              testId={selectedTestId}
              basket={basket}
              apiKey={apiKey}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={handleSelectAnswer}
              onWordSaved={handleWordSaved}
            />
            {/* Submit modal trigger — only when all questions answered */}
            {!showSubmitModal && (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const missing = selectedTest.questions
                      .filter((q) => !(`${selectedTestId}-${q.문제_번호}` in answers))
                      .map((q) => q.문제_번호)
                      .sort((a, b) => a - b);
                    if (missing.length > 0) {
                      setIncompleteNumbers(missing);
                    } else {
                      setShowSubmitModal(true);
                    }
                  }}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 transition-colors"
                >
                  Submit Test
                </button>
              </div>
            )}
          </div>
        </main>

        <Sidebar basket={basket} onWordRemoved={handleWordRemoved} />
      </div>

      <BasketDrawer
        open={drawerOpen}
        basket={basket}
        onClose={() => setDrawerOpen(false)}
        onWordRemoved={handleWordRemoved}
      />

      {showSubmitModal && (
        <SubmitModal
          onConfirm={() => {
            setShowSubmitModal(false);
            handleSubmit();
          }}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}

      {incompleteNumbers && (
        <IncompleteModal
          missingNumbers={incompleteNumbers}
          onClose={() => setIncompleteNumbers(null)}
        />
      )}
    </div>
  );
}
