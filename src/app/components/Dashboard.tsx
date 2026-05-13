import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Activity, Plus, Trash2, Bell, BellOff, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
}

interface DashboardProps {
  userName: string;
  setUserName: (name: string) => void;
  onStartAlarm: () => void;
}

type Phase = 'idle' | 'ringing' | 'challenge' | 'summary';

// ─── Constants ────────────────────────────────────────────────────────────────



const emotionThemes: Record<string, { color: string; bg: string; message: string; subtext: string }> = {
  neutral:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.05)',   message: 'State: Normal',       subtext: 'You are in your optimal productivity zone.'   },
  angry:     { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)',   message: 'State: Irritability', subtext: 'Irritability detected. Take a deep breath.'    },
  fearful:   { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', message: 'State: Anxiety',      subtext: 'Feeling anxious? Focus on the next small step.' },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', message: 'State: Annoyance',    subtext: 'Clear the noise and reset your focus.'          },
  sad:       { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', message: 'State: Fatigue',      subtext: 'Rest is productive. Consider a quick stretch.'  },
  surprised: { color: '#cc99ff', bg: 'rgba(204,153,255,0.08)', message: 'State: Surprise',     subtext: 'Something caught your attention!'               },
  happy:     { color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   message: 'State: Happy',        subtext: 'Great energy! Keep it up.'                      },
};

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😐', angry: '😤', fearful: '😰', disgusted: '😒',
  sad: '😴', surprised: '😲', happy: '😊',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pulsing ring shown when alarm is ringing */
function RingingOverlay({ alarmLabel, onSnooze, onDismiss }: {
  alarmLabel: string;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex items-center justify-center mb-8">
        {[1, 2, 3].map(i => (
          <span
            key={i}
            className="absolute rounded-full border border-[#00d4ff] animate-ping"
            style={{
              width: 80 + i * 48,
              height: 80 + i * 48,
              animationDelay: `${i * 0.25}s`,
              opacity: 0.3,
            }}
          />
        ))}
        <Bell size={48} className="text-[#00d4ff] relative z-10" />
      </div>
      <p className="text-[#00d4ff] font-mono text-5xl font-bold tracking-tight mb-2">
        {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[#888899] text-sm mb-10 uppercase tracking-widest">{alarmLabel}</p>
      <div className="flex gap-4">
        <button
          onClick={onSnooze}
          className="px-8 py-3 rounded-xl border border-[#00d4ff] text-[#00d4ff] text-sm font-bold uppercase tracking-widest hover:bg-[#00d4ff]/10 transition-colors"
        >
          Snooze → Challenge
        </button>
        <button
          onClick={onDismiss}
          className="px-8 py-3 rounded-xl border border-[#2a2a32] text-[#555566] text-sm font-bold uppercase tracking-widest hover:border-[#555566] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/** Question panel with queue loop — camera feed embedded inline */
function ChallengePanel({
  currentEmotion,
  videoRef,
  isCameraOn,
  onVideoPlay,
  onComplete,
}: {
  currentEmotion: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraOn: boolean;
  onVideoPlay: () => void;
  onComplete: (moodHistory: string[]) => void;
}) {
  const [queue, setQueue]               = useState([...QUESTIONS]);
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [input, setInput]               = useState('');
  const [feedback, setFeedback]         = useState<'correct' | 'wrong' | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [wrongCount, setWrongCount]     = useState(0);
  const [moodHistory, setMoodHistory]   = useState<string[]>([]);

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  // Accumulate mood every 3 s while challenge is open
  useEffect(() => {
    const t = setInterval(() => {
      setMoodHistory(h => [...h, currentEmotion]);
    }, 3000);
    return () => clearInterval(t);
  }, [currentEmotion]);

  const handleSubmit = useCallback(() => {
    if (feedback) return;
    const q = queue[currentIdx];
    const correct = input.trim().toLowerCase() === q.answer.toLowerCase();
    setFeedback(correct ? 'correct' : 'wrong');

    setTimeout(() => {
      if (correct) {
        const newCorrect = totalCorrect + 1;
        setTotalCorrect(newCorrect);
        const newQueue = queue.filter((_, i) => i !== currentIdx);
        if (newQueue.length === 0) {
          onComplete([...moodHistory, currentEmotion]);
          return;
        }
        setQueue(newQueue);
        setCurrentIdx(i => Math.min(i, newQueue.length - 1));
      } else {
        setWrongCount(w => w + 1);
        const newQueue = [...queue];
        const [missed] = newQueue.splice(currentIdx, 1);
        newQueue.push(missed);
        setQueue(newQueue);
        setCurrentIdx(i => Math.min(i, newQueue.length - 1));
      }
      setInput('');
      setFeedback(null);
    }, 900);
  }, [feedback, input, queue, currentIdx, totalCorrect, moodHistory, currentEmotion, onComplete]);

  const q = queue[currentIdx];
  const progress = (totalCorrect / QUESTIONS.length) * 100;

  return (
    <div className="bg-[#0e0e16] rounded-2xl border border-[#2a2a32] overflow-hidden w-full">
      <div className="flex flex-col md:flex-row">

        {/* ── Left: live camera feed ── */}
        <div className="relative md:w-72 lg:w-80 shrink-0 bg-black aspect-video md:aspect-auto">
          {isCameraOn ? (
            <video
              ref={videoRef}
              onPlay={onVideoPlay}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover opacity-90"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#333344] min-h-[200px]">
              <CameraOff size={24} className="mb-2" />
              <span className="text-[10px] uppercase tracking-widest">Feed Offline</span>
            </div>
          )}

          {/* Emotion badge — pinned over the video */}
          <div
            className="absolute top-3 left-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ background: 'rgba(0,0,0,0.72)', borderColor: `${theme.color}44` }}
          >
            <span className="text-xl leading-none">{EMOTION_ICONS[currentEmotion] ?? '😐'}</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: theme.color }}>
                {theme.message}
              </span>
              <span className="text-[9px] text-[#555566]">{theme.subtext}</span>
            </div>
            <span
              className="ml-auto w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ background: theme.color }}
            />
          </div>

          {/* Mood history strip at bottom */}
          {moodHistory.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex gap-1 flex-wrap bg-gradient-to-t from-black/60 to-transparent">
              {moodHistory.slice(-10).map((m, i) => (
                <span
                  key={i}
                  title={m}
                  className="text-base"
                  style={{ opacity: 0.35 + (i / 10) * 0.65 }}
                >
                  {EMOTION_ICONS[m] ?? '😐'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: question + answer ── */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          {/* Header row */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#888899]" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#888899] font-bold">
                  Verification Task
                </span>
              </div>
              <span className="text-[10px] text-[#555566] font-mono">
                {totalCorrect}/{QUESTIONS.length} correct
                {wrongCount > 0 && (
                  <span className="ml-2 text-[#ff9944]">↩ {wrongCount} re-queued</span>
                )}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-[#141419] rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-[#00d4ff] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Question */}
            <p className="text-[10px] text-[#444455] uppercase tracking-widest mb-1 font-mono">
              Question {currentIdx + 1} of {queue.length}
            </p>
            <p className="text-xl font-bold text-[#e5e5e5] mb-5 leading-snug">{q?.question}</p>
          </div>

          {/* Input + submit */}
          <div>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Type your answer…"
              disabled={!!feedback}
              className="w-full bg-[#141419] border border-[#2a2a32] p-4 rounded-xl outline-none focus:border-[#00d4ff] mb-3 text-[#e5e5e5] placeholder-[#444455] transition-colors"
            />

            {feedback === 'correct' && (
              <div className="flex items-center gap-2 mb-3 text-[#22c55e] text-sm">
                <CheckCircle size={14} /> Correct!
              </div>
            )}
            {feedback === 'wrong' && (
              <div className="flex items-center gap-2 mb-3 text-[#ef4444] text-sm">
                <XCircle size={14} /> Incorrect — question added back to the queue
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!!feedback || !input.trim()}
              className="w-full py-4 bg-[#00d4ff] text-black font-bold rounded-xl hover:bg-[#00b8e6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Summary after completing all questions */
function SummaryPanel({ moodHistory, onDone }: { moodHistory: string[]; onDone: () => void }) {
  const counts: Record<string, number> = {};
  moodHistory.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
  const total = moodHistory.length || 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0];
  const dominantTheme = emotionThemes[dominant?.[0]] ?? emotionThemes['neutral'];

  return (
    <div className="bg-[#1f1f27] p-8 rounded-2xl border border-[#2a2a32] flex flex-col h-full min-h-[340px]">
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle size={16} style={{ color: dominantTheme.color }} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#888899] font-bold">
          Wake-up complete
        </span>
      </div>

      <p className="text-2xl font-bold text-[#e5e5e5] mb-1">You're officially awake!</p>
      <p className="text-sm text-[#555566] mb-6">Mood analysis from your session:</p>

      {/* Dominant mood */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center gap-4 border"
        style={{ borderColor: `${dominantTheme.color}33`, backgroundColor: dominantTheme.bg }}
      >
        <span className="text-4xl">{EMOTION_ICONS[dominant?.[0]] ?? '😐'}</span>
        <div>
          <p className="text-xs text-[#888899] uppercase tracking-widest mb-0.5">Dominant mood</p>
          <p className="font-bold text-lg" style={{ color: dominantTheme.color }}>
            {dominantTheme.message.replace('State: ', '')}
          </p>
          <p className="text-xs text-[#555566]">{dominantTheme.subtext}</p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="flex flex-col gap-2 mb-6">
        {sorted.map(([emotion, count]) => {
          const t = emotionThemes[emotion] ?? emotionThemes['neutral'];
          const pct = Math.round((count / total) * 100);
          return (
            <div key={emotion} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">{EMOTION_ICONS[emotion] ?? '😐'}</span>
              <div className="flex-1 h-2 bg-[#141419] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: t.color }}
                />
              </div>
              <span className="text-xs text-[#555566] w-8 text-right font-mono">{pct}%</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onDone}
        className="mt-auto flex items-center justify-center gap-2 py-3 border border-[#2a2a32] rounded-xl text-sm text-[#888899] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
      >
        <RotateCcw size={14} /> Back to Dashboard
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard({ userName, setUserName, onStartAlarm }: DashboardProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentTime, setCurrentTime]       = useState(new Date());
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [isCameraOn, setIsCameraOn]         = useState(false);
  const [modelsLoaded, setModelsLoaded]     = useState(false);

  const [phase, setPhase]           = useState<Phase>('idle');
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [summaryMoods, setSummaryMoods] = useState<string[]>([]);
  const [moodHistory, setMoodHistory] = useState<string[]>([]);

  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem('focusWake_alarms');
      return saved ? JSON.parse(saved) : [{ id: '1', time: '07:00', enabled: true, label: 'Morning Wake' }];
    } catch { return [{ id: '1', time: '07:00', enabled: true, label: 'Morning Wake' }]; }
  });

  // Persist alarms
  useEffect(() => {
    localStorage.setItem('focusWake_alarms', JSON.stringify(alarms));
  }, [alarms]);

  // Load face-api models
  useEffect(() => {
    const load = async () => {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    };
    load().catch(console.error);
  }, []);

  // Clock tick + alarm trigger
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now.getSeconds() === 0 && phase === 'idle') {
        const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const triggered = alarms.find(a => a.enabled && a.time === hhmm);
        if (triggered) {
          setActiveAlarm(triggered);
          setPhase('ringing');
          setIsCameraOn(true);
          onStartAlarm();
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [alarms, phase, onStartAlarm]);

  // Camera stream
  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(err => console.error('Camera denied', err));
    } else {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOn]);

  // face-api detection loop (starts when video plays)
  const handleVideoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !modelsLoaded) return;
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
        if (detections.length > 0) {
          const expressions = detections[0].expressions;
          const best = (Object.entries(expressions) as [string, number][])
            .reduce((a, b) => (a[1] > b[1] ? a : b));
          setCurrentEmotion(best[0]);
          setMoodHistory(h => [...h.slice(-19), best[0]]);
        }
      } catch { /* silently ignore mid-unmount errors */ }
    }, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [modelsLoaded]);

  // Phase handlers
  const handleSnooze = useCallback(() => {
    setPhase('challenge');
  }, []);

  const handleDismiss = useCallback(() => {
    setPhase('idle');
    setActiveAlarm(null);
    setIsCameraOn(false);
  }, []);

  const handleChallengeComplete = useCallback((moods: string[]) => {
    setSummaryMoods(moods);
    setPhase('summary');
  }, []);

  const handleSummaryDone = useCallback(() => {
    setPhase('idle');
    setActiveAlarm(null);
    setIsCameraOn(false);
    setMoodHistory([]);
  }, []);

  // Alarm CRUD helpers
  const addAlarm = () => {
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      time: '08:00',
      enabled: true,
      label: 'New Alarm',
    };
    setAlarms(a => [...a, newAlarm]);
  };

  const toggleAlarm = (id: string) =>
    setAlarms(a => a.map(al => al.id === id ? { ...al, enabled: !al.enabled } : al));

  const deleteAlarm = (id: string) =>
    setAlarms(a => a.filter(al => al.id !== id));

  const updateAlarm = (id: string, field: keyof Alarm, value: string | boolean) =>
    setAlarms(a => a.map(al => al.id === id ? { ...al, [field]: value } : al));

  // Trigger an alarm immediately (demo button)
  const triggerDemo = () => {
    const demo: Alarm = { id: 'demo', time: 'NOW', enabled: true, label: 'Demo Alarm' };
    setActiveAlarm(demo);
    setPhase('ringing');
    setIsCameraOn(true);
    onStartAlarm();
  };

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] font-sans">

      {/* ── Ringing overlay ── */}
      {phase === 'ringing' && activeAlarm && (
        <RingingOverlay
          alarmLabel={activeAlarm.label}
          onSnooze={handleSnooze}
          onDismiss={handleDismiss}
        />
      )}

      <main className="max-w-5xl mx-auto p-6 md:p-10">

        {/* Page title */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              ⏰ FocusWake
              {userName && <span className="text-[#555566] font-normal text-base ml-3">— {userName}</span>}
            </h1>
            <p className="text-xs text-[#444455] mt-1 uppercase tracking-widest">Smart alarm · mood analysis · wake challenge</p>
          </div>
          <button
            onClick={triggerDemo}
            className="text-[10px] font-bold text-[#00d4ff] border border-[#00d4ff]/30 px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-[#00d4ff]/10 transition-colors"
          >
            Test alarm
          </button>
        </div>

        {/* ── Top section — layout shifts by phase ── */}
        <div className="mb-8">

          {/* CHALLENGE: full-width panel with camera embedded inside */}
          {phase === 'challenge' && (
            <ChallengePanel
              currentEmotion={currentEmotion}
              videoRef={videoRef}
              isCameraOn={isCameraOn}
              onVideoPlay={handleVideoPlay}
              onComplete={handleChallengeComplete}
            />
          )}

          {/* SUMMARY: full-width summary */}
          {phase === 'summary' && (
            <SummaryPanel moodHistory={summaryMoods} onDone={handleSummaryDone} />
          )}

          {/* IDLE / RINGING: classic 2-col — camera left, reactive clock right */}
          {(phase === 'idle' || phase === 'ringing') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Camera feed */}
              <div className="relative rounded-2xl overflow-hidden bg-black border border-[#2a2a32] shadow-xl aspect-video">
                {isCameraOn ? (
                  <video
                    ref={videoRef}
                    onPlay={handleVideoPlay}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover opacity-90"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#333344]">
                    <CameraOff size={28} className="mb-2" />
                    <span className="text-[10px] uppercase tracking-widest">Feed Offline</span>
                  </div>
                )}

                {/* Emotion overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-2.5 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.color }} />
                  <span className="text-[10px] font-mono" style={{ color: theme.color }}>
                    {currentEmotion.toUpperCase()}
                  </span>
                </div>

                {/* Mood timeline dots */}
                {moodHistory.length > 0 && (
                  <div className="absolute bottom-10 left-3 right-3 flex gap-1 flex-wrap">
                    {moodHistory.slice(-12).map((m, i) => (
                      <span key={i} title={m} className="text-sm" style={{ opacity: 0.4 + (i / 12) * 0.6 }}>
                        {EMOTION_ICONS[m] ?? '😐'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Camera toggle */}
                <button
                  onClick={() => setIsCameraOn(v => !v)}
                  className="absolute bottom-3 right-3 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                  title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isCameraOn
                    ? <Camera size={16} className="text-white" />
                    : <CameraOff size={16} className="text-[#666677]" />
                  }
                </button>
              </div>

              {/* Reactive clock */}
              <div
                className="rounded-2xl p-8 border transition-all duration-1000 flex flex-col items-center justify-center text-center shadow-2xl"
                style={{ borderColor: `${theme.color}33`, backgroundColor: theme.bg }}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: `${theme.color}88` }}>
                  {modelsLoaded ? 'AI analysis active' : 'Loading AI models…'}
                </p>
                <h2 className="text-xl font-bold mb-1" style={{ color: theme.color }}>{theme.message}</h2>
                <p className="text-xs text-[#555566] mb-8">{theme.subtext}</p>
                <div className="font-mono text-6xl md:text-7xl tracking-tighter font-bold" style={{ color: theme.color }}>
                  {formatTime(currentTime)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Alarms section ── */}
        <div className="bg-[#1f1f27]/60 rounded-2xl p-6 border border-[#2a2a32]">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[10px] font-bold text-[#888899] uppercase tracking-widest">Alarms</h2>
            <button
              onClick={addAlarm}
              className="flex items-center gap-1.5 text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              <Plus size={12} /> Add alarm
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {alarms.map(alarm => (
              <div
                key={alarm.id}
                className="flex items-center gap-4 p-4 bg-[#141419] rounded-xl border border-[#2a2a32] group"
              >
                <input
                  type="time"
                  value={alarm.time}
                  onChange={e => updateAlarm(alarm.id, 'time', e.target.value)}
                  className="font-mono text-2xl bg-transparent outline-none text-[#e5e5e5] w-28"
                />
                <input
                  type="text"
                  value={alarm.label}
                  onChange={e => updateAlarm(alarm.id, 'label', e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-[#888899] placeholder-[#444455]"
                  placeholder="Label…"
                />
                <button
                  onClick={() => toggleAlarm(alarm.id)}
                  className="transition-colors"
                  title={alarm.enabled ? 'Disable alarm' : 'Enable alarm'}
                >
                  {alarm.enabled
                    ? <Bell size={16} className="text-[#00d4ff]" />
                    : <BellOff size={16} className="text-[#444455]" />
                  }
                </button>
                <button
                  onClick={() => deleteAlarm(alarm.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#444455] hover:text-[#ef4444]"
                  title="Delete alarm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {alarms.length === 0 && (
              <p className="text-[#333344] text-sm text-center py-6">No alarms set — add one above.</p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
