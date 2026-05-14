import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { ProgressStepper } from './ProgressStepper';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  question: string;
  answer: string;
  placeholder?: string;
}

interface AlarmChallengeProps {
  onComplete: (completionTime: number, moodHistory: string[]) => void;
  modelsLoaded: boolean;
}

// ─── Constants & Configuration ────────────────────────────────────────────────
const EMOTION_CONFIG: Record<string, { color: string; bg: string; icon: string; msg: string; sub: string }> = {
  neutral:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',   icon: '😐', msg: 'State: Normal',       sub: 'You are in your optimal productivity zone.' },
  angry:     { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)',   icon: '😤', msg: 'State: Irritability', sub: 'Irritability detected. Take a deep breath.' },
  fearful:   { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', icon: '😰', msg: 'State: Anxiety',      sub: 'Feeling anxious? Focus on the next small step.' },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', icon: '😒', msg: 'State: Annoyance',    sub: 'Clear the noise and reset your focus.' },
  sad:       { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', icon: '😴', msg: 'State: Fatigue',      sub: 'Rest is productive. Consider a quick stretch.' },
  surprised: { color: '#cc99ff', bg: 'rgba(204,153,255,0.08)', icon: '😲', msg: 'State: Surprise',     sub: 'Something caught your attention!' },
  happy:     { color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   icon: '😊', msg: 'State: Happy',        sub: 'Great energy! Keep it up.' },
};

const getQuestions = (): Question[] => {
  const now = new Date();
  const bank = [
    { question: "What is the current month?", answer: now.toLocaleDateString('en-US', { month: 'long' }) },
    { question: "What day of the week is it?", answer: now.toLocaleDateString('en-US', { weekday: 'long' }) },
    { question: "Is it currently AM or PM?", answer: now.getHours() >= 12 ? 'PM' : 'AM' },
    { question: "What is the current year?", answer: now.getFullYear().toString() },
    { question: "Type 'COFFEE' in all caps", answer: 'COFFEE' },
    { question: "Type 'ALARM' backwards", answer: 'MRALA' },
    { question: "Type the name of this app", answer: 'FocusWake' },
    { question: "What is 5 + 5?", answer: '10' },
  ];
  return bank.sort(() => Math.random() - 0.5).slice(0, 5);
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AlarmChallenge({ onComplete, modelsLoaded }: AlarmChallengeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const emotionRef = useRef('neutral');
  const errorTimer = useRef<NodeJS.Timeout | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState({
    answer: '',
    error: '',
    completed: 0,
    startTime: Date.now(),
  });
  const [camera, setCamera] = useState({ error: null as string | null, active: false });
  const [mood, setMood] = useState({ current: 'neutral', history: [] as string[] });

  const theme = EMOTION_CONFIG[mood.current] || EMOTION_CONFIG.neutral;

  // 1. Init Questions
  useEffect(() => setQuestions(getQuestions()), []);

  // 2. Camera Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCamera(prev => ({ ...prev, error: 'Camera access denied' })));

    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // 3. Detection Loop (Including Happy & Surprised)
  useEffect(() => {
    if (!modelsLoaded) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const result = await faceapi.detectSingleFace(
          video, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
        ).withFaceExpressions();

        if (result) {
          const [bestEmotion] = Object.entries(result.expressions).reduce((a, b) => (a[1] > b[1] ? a : b));
          
          emotionRef.current = bestEmotion;
          setMood(prev => ({
            current: bestEmotion,
            history: [...prev.history.slice(-11), bestEmotion]
          }));
          setCamera(prev => ({ ...prev, active: true }));
        } else {
          setCamera(prev => ({ ...prev, active: false }));
        }
      } catch (e) {
        console.error("Detection Error:", e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [modelsLoaded]);

  // 4. Submit Logic
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status.error || !status.answer.trim()) return;

    const isCorrect = status.answer.toLowerCase().trim() === questions[0].answer.toLowerCase();

    if (isCorrect) {
      const nextQuestions = questions.slice(1);
      if (nextQuestions.length === 0) {
        onComplete(Math.floor((Date.now() - status.startTime) / 1000), [...mood.history, emotionRef.current]);
      } else {
        setQuestions(nextQuestions);
        setStatus(prev => ({ ...prev, answer: '', completed: prev.completed + 1 }));
      }
    } else {
      setStatus(prev => ({ ...prev, error: 'Incorrect! Re-sequencing...' }));
      errorTimer.current = setTimeout(() => {
        setQuestions(q => [...q.slice(1), q[0]]); // Move failed question to end
        setStatus(prev => ({ ...prev, answer: '', error: '' }));
      }, 1500);
    }
  };

  if (questions.length === 0) return null;

  return (
    <div className="min-h-screen text-[#e5e5e5] font-mono transition-all duration-700"
      style={{ backgroundColor: '#1a1a1f', backgroundImage: `radial-gradient(circle at 50% 0%, ${theme.color}15 0%, transparent 70%)` }}>
      
      <div className="flex min-h-screen">
        {/* Left Panel: Monitoring */}
        <aside className="w-72 border-r border-white/5 flex flex-col bg-black/20 backdrop-blur-sm">
          <div className="relative aspect-[3/4] bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className={`absolute top-4 left-4 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter ${camera.active ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/30'}`}>
              {camera.active ? '● Live' : '○ Standby'}
            </div>
            {camera.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-[10px] text-red-400 uppercase p-4 text-center">
                {camera.error}
              </div>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <section>
              <header className="flex items-center gap-2 mb-6 opacity-60">
                <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: theme.color }} />
                <span className="text-[10px] uppercase tracking-widest font-bold">Biometric Data</span>
              </header>
              <div className="flex items-center gap-4">
                <span className="text-5xl">{theme.icon}</span>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: theme.color }}>{theme.msg}</h2>
                  <p className="text-[11px] opacity-50 leading-tight mt-1">{theme.sub}</p>
                </div>
              </div>
            </section>

            <section>
              <p className="text-[9px] uppercase tracking-widest mb-3 opacity-30">Pulse History</p>
              <div className="flex flex-wrap gap-1.5">
                {mood.history.map((m, i) => (
                  <span key={i} className="text-lg opacity-40 hover:opacity-100 transition-opacity" title={m}>
                    {EMOTION_CONFIG[m]?.icon || '😐'}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Right Panel: Challenge */}
        <main className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-full max-w-xl space-y-12">
            <ProgressStepper currentStep={status.completed} totalSteps={5} />

            <div className="text-center space-y-10">
              <h1 className="text-4xl font-light tracking-tight h-24 flex items-center justify-center">
                {questions[0].question}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  value={status.answer}
                  disabled={!!status.error}
                  onChange={e => setStatus(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder={questions[0].placeholder || "Type answer..."}
                  className={`w-full bg-white/5 border-2 rounded-xl py-5 px-8 text-2xl text-center transition-all ${status.error ? 'border-red-500/50 scale-[0.98]' : 'border-white/10 focus:border-cyan-500/50'}`}
                  style={!status.error ? { borderColor: `${theme.color}40` } : {}}
                />
                <button
                  type="submit"
                  disabled={!!status.error || !status.answer.trim()}
                  className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-95 disabled:opacity-20"
                  style={{ backgroundColor: theme.color, color: '#1a1a1f' }}>
                  Verify Entry
                </button>
              </form>

              {status.error && (
                <p className="text-red-400 text-xs uppercase tracking-tighter animate-pulse">
                  {status.error}
                </p>
              )}
              <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
                {status.completed} / 5 Systems Cleared
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}