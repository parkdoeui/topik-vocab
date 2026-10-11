import { useEffect, useRef, useState } from "react";
import { formatListeningTime, type ListeningAudio } from "../services/listeningApi";

function stageLabel(audio: ListeningAudio, time: number, finished: boolean): string {
  if (finished) return "듣기 완료";
  const { first_end, cue_start, cue_end, second_start } = audio.stages;
  if (time < first_end) return "첫 번째 듣기";
  if (time < cue_start) return `다시 듣기 안내까지 ${Math.ceil(cue_start - time)}초`;
  if (time < cue_end) return "다시 들으십시오.";
  if (time < second_start) return `두 번째 듣기까지 ${Math.ceil(second_start - time)}초`;
  return "두 번째 듣기";
}

export function ListeningAudioPlayer({ audio, disabled = false, replayCount, onReplay }: {
  audio: ListeningAudio;
  disabled?: boolean;
  replayCount?: number;
  onReplay?: () => void;
}) {
  const media = useRef<HTMLAudioElement>(null);
  const active = useRef(false);
  const startedOnce = useRef(false);
  const replayRequested = useRef(false);
  const pendingStart = useRef(false);
  const generation = useRef(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = media.current;
    active.current = true;
    return () => {
      active.current = false;
      generation.current += 1;
      element?.pause();
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      const version = ++generation.current;
      pendingStart.current = false;
      media.current?.pause();
      void Promise.resolve().then(() => {
        if (active.current && generation.current === version) setPending(false);
      });
    }
  }, [disabled]);

  async function play(restart: boolean): Promise<void> {
    const element = media.current;
    if (!element || disabled || pendingStart.current) return;
    pendingStart.current = true;
    const version = ++generation.current;
    if (restart) {
      replayRequested.current = startedOnce.current;
      element.pause();
      element.currentTime = 0;
      setTime(0);
      setFinished(false);
    }
    setPending(true);
    setError(false);
    try {
      await element.play();
      if (!active.current || generation.current !== version) return;
      if (replayRequested.current) onReplay?.();
      replayRequested.current = false;
      startedOnce.current = true;
      setStarted(true);
    } catch {
      if (active.current && generation.current === version) setError(true);
    } finally {
      if (generation.current === version) {
        pendingStart.current = false;
        if (active.current) setPending(false);
      }
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4" aria-label="듣기 음성">
      <audio ref={media} src={`${import.meta.env.BASE_URL}${audio.path}`} preload="metadata"
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={() => setTime(media.current?.currentTime ?? 0)}
        onEnded={() => { setPlaying(false); setFinished(true); }}
        onError={() => { setPlaying(false); setError(true); }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">듣기 음성</h2>
        {replayCount !== undefined && <p className="text-xs text-gray-500">전체 다시 재생 {replayCount}회</p>}
      </div>
      <p className="text-sm font-medium text-blue-700" role="status" aria-live="polite">
        {started ? stageLabel(audio, time, finished) : "문제와 보기를 확인한 뒤 듣기를 시작하세요."}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="음성 재생 진행률" aria-valuemin={0} aria-valuemax={audio.duration_seconds} aria-valuenow={Math.min(time, audio.duration_seconds)}>
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, time / audio.duration_seconds * 100)}%` }} />
      </div>
      <p className="text-xs tabular-nums text-gray-400">{formatListeningTime(time)} / {formatListeningTime(audio.duration_seconds)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || pending || finished} onClick={() => playing ? media.current?.pause() : void play(!started)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
          {pending ? "음성 준비 중…" : finished ? "재생 완료" : playing ? "일시 정지" : started ? "계속 듣기" : "듣기 시작"}
        </button>
        <button type="button" disabled={disabled || pending || !started} onClick={() => void play(true)} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">전체 다시 듣기</button>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">지문을 두 번 읽습니다. 첫 번째 듣기 후 5초 쉬고 “다시 들으십시오.” 안내 후 5초 뒤 다시 읽습니다.{replayCount !== undefined && " 전체 다시 듣기는 처음부터 재생하며, 최초 재생을 제외한 횟수가 풀이에 저장됩니다."}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">음성을 재생하지 못했습니다. 연결을 확인한 뒤 재생 버튼으로 다시 시도해 주세요.</p>}
    </section>
  );
}
