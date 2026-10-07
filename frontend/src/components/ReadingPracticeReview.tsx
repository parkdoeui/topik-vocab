import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getReadingAttempt, readingOptionMarkers, readingPracticeConfig, type ReadingAttemptReview, type ReadingPracticeType } from "../services/readingApi";

export function ReadingPracticeReview({ practiceType = "28-31" }: { practiceType?: ReadingPracticeType }) {
  const { attemptId } = useParams<{ attemptId: string }>();
  return <ReadingReview key={`${practiceType}:${attemptId}`} attemptId={attemptId ?? ""} practiceType={practiceType} />;
}

function ReadingReview({ attemptId, practiceType }: { attemptId: string; practiceType: ReadingPracticeType }) {
  const config = readingPracticeConfig[practiceType];
  const [attempt, setAttempt] = useState<ReadingAttemptReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void getReadingAttempt(attemptId)
      .then((data) => {
        if (data.practice_type !== practiceType) throw new Error("Reading practice type mismatch");
        if (active) setAttempt(data);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attemptId, reload, practiceType]);

  if (!attempt && !failed) return <p className="py-16 text-center text-sm text-gray-400">읽기 결과를 불러오는 중…</p>;
  if (!attempt) return (
    <div className="px-4 py-16 text-center text-sm text-gray-500 space-y-3">
      <p role="alert">읽기 결과를 불러오지 못했습니다.</p>
      <button type="button" onClick={() => { setFailed(false); setReload((value) => value + 1); }} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">다시 시도</button>
      <Link to={config.homePath} className="block text-blue-600 hover:underline">읽기 연습으로</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <header>
        <Link to={config.homePath} className="text-xs font-medium text-blue-600 hover:underline">← {config.title}</Link>
        <p className="mt-3 text-xs text-gray-400">{attempt.set_title}</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">읽기 연습 결과</h1>
        <p className="mt-2 text-xs text-gray-400">자동 저장 완료 · {new Date(attempt.completed_at).toLocaleString("ko-KR")}</p>
      </header>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">세트 점수</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">{attempt.score} / {attempt.max_score}점</p>
        <p className="mt-3 text-sm text-gray-500">{attempt.correct_count} / {attempt.question_count}문항 정답 · 문항별 {attempt.points_per_question}점</p>
      </section>

      <section className="space-y-4" aria-label="문항별 정답과 해설">
        <h2 className="font-bold text-gray-900">문항별 정답과 해설</h2>
        {attempt.questions.map((question, index) => (
          <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">{index + 1}. {question.topic}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${question.correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{question.correct ? "정답" : "오답"}</span>
            </div>
            {question.category_description && <p className="text-xs leading-relaxed text-gray-500">{question.category_description}</p>}
            <p className="whitespace-pre-wrap text-sm leading-loose text-gray-800">{question.prompt}</p>
            <ol className="space-y-2" aria-label={`${index + 1}번 보기`}>
              {question.options.map((option, optionIndex) => (
                <li key={optionIndex} className={`rounded-xl border p-3 text-sm leading-relaxed ${optionIndex + 1 === question.correct_option ? "border-green-200 bg-green-50 text-green-900" : optionIndex + 1 === question.selected_option ? "border-red-200 bg-red-50 text-red-900" : "border-gray-100 text-gray-600"}`}>
                  {readingOptionMarkers[optionIndex]} {option}
                </li>
              ))}
            </ol>
            <div className="space-y-2 text-sm leading-relaxed">
              <p className="text-gray-700">내 답: {readingOptionMarkers[question.selected_option - 1]} {question.options[question.selected_option - 1]}</p>
              <p className="font-semibold text-green-700">정답: {readingOptionMarkers[question.correct_option - 1]} {question.options[question.correct_option - 1]}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <h4 className="text-sm font-semibold text-blue-900">정답 근거</h4>
              <p className="mt-2 text-sm leading-relaxed text-blue-950">{question.explanation}</p>
            </div>
            {question.vocabulary && question.vocabulary.length > 0 && <p className="text-xs leading-relaxed text-gray-500">사용 어휘: {question.vocabulary.join(" · ")}</p>}
            {question.sources && question.sources.length > 0 && (
              <div className="space-y-1 text-xs leading-relaxed text-gray-500">
                <p>지문 참고 자료</p>
                {question.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">{source.title}</a>)}
              </div>
            )}
          </article>
        ))}
      </section>
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link to={config.homePath} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">풀이 기록 보기</Link>
        <Link to={`${config.homePath}/${attempt.set_id}`} className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700">다시 풀기</Link>
      </div>
    </div>
  );
}
