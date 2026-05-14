import React, { useState, useEffect, useRef } from 'react';
import { ProgressStepper } from './ProgressStepper';
import * as faceapi from '@vladmandic/face-api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  question: string;
  answer: string;
  placeholder?: string;
}

interface AlarmChallengeProps {
  onComplete: (completionTime: number, moodHistory: string[]) => void;
}

// ─── Emotion config ───────────────────────────────────────────────────────────
const emotionThemes: Record<
  string,
  { color: string; bg: string; border: string; message: string; subtext: string }
> = {
  neutral: { color: '#00d4ff', bg: 'rgba(0,212,255,0.05)', border: 'rgba(0,212,255,0.2)', message: 'State: Normal', subtext: 'You are in your optimal productivity zone.' },
  angry: { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)', border: 'rgba(255,77,77,0.25)', message: 'State: Irritability', subtext: 'Irritability detected. Take a deep breath.' },
  fearful: { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', border: 'rgba(255,179,102,0.2)', message: 'State: Anxiety', subtext: 'Feeling anxious? Focus on the next small step.' },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', border: 'rgba(255,255,102,0.2)', message: 'State: Annoyance', subtext: 'Clear the noise and reset your focus.' },
  sad: { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', border: 'rgba(153,255,153,0.2)', message: 'State: Fatigue', subtext: 'Rest is productive. Consider a quick stretch.' },
  surprised: { color: '#cc99ff', bg: 'rgba(204,153,255,0.08)', border: 'rgba(204,153,255,0.2)', message: 'State: Surprise', subtext: 'Something caught your attention!' },
  happy: { color: '#ffd700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.2)', message: 'State: Happy', subtext: 'Great energy! Keep it up.' },
};

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😐',
  angry: '😤',
  fearful: '😰',
  disgusted: '😒',
  sad: '😴',
  surprised: '😲',
  happy: '😊',
};

// ─── Question bank ────────────────────────────────────────────────────────────
function getFullQuestionBank(): Question[] {
  const now = new Date();
  return [
    { question: 'What is the current month?', answer: now.toLocaleDateString('en-US', { month: 'long' }) },
    { question: 'What day of the week is it?', answer: now.toLocaleDateString('en-US', { weekday: 'long' }) },
    { question: 'Is it currently AM or PM?', answer: now.getHours() >= 12 ? 'PM' : 'AM' },
    { question: 'What is the current year?', answer: now.getFullYear().toString() },
    { question: "Type the word 'COFFEE' in all caps", answer: 'COFFEE' },
    { question: "Type the word 'ALARM' backwards", answer: 'MRALA' },
    { question: 'Type the name of this app', answer: 'FocusWake' },
    { question: 'What is 5 + 5?', answer: '10' },
    { question: 'What is 10 minus 3?', answer: '7' },
    { question: 'How many hours are in a full day?', answer: '24' },
  ];
}

export function AlarmChallenge({ onComplete }: AlarmChallengeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emotionRef = useRef('neutral');
  const [answer, setAnswer] = useState('');
  const [startTime] = useState(Date.now());
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [moodHistory, setMoodHistory] = useState<string[]>([]);
  const [detectionActive, setDetectionActive] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  // ── Load Models ──
  useEffect(() => {
    async function loadModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Model loading error:', err);
      }
    }
    loadModels();
  }, []);

  // ── Setup Questions ──
  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  // ── Camera Access ──
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCameraError('Camera access required.');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Detection Logic ──
  useEffect(() => {
    if (!modelsLoaded) return;

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
          .withFaceExpressions();

        if (detection?.expressions) {
          const sorted = Object.entries(detection.expressions).sort((a, b) => b[1] - a[1]);
          const [emotion] = sorted[0];
          
          if (emotion !== emotionRef.current) {
            emotionRef.current = emotion;
            setCurrentEmotion(emotion);
            setMoodHistory((prev) => [...prev.slice(-19), emotion]);
          }
          setDetectionActive(true);
        } else {
          setDetectionActive(false);
        }
      } catch (err) {
        setDetectionActive(false);
      }
    }, 700);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [modelsLoaded]);

  // ── Handlers ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQuestions.length === 0 || error) return;

    const correct = answer.toLowerCase().trim() === activeQuestions[0].answer.toLowerCase().trim();

    if (correct) {
      const next = activeQuestions.slice(1);
      setActiveQuestions(next);
      setCompletedCount((c) => c + 1);
      setAnswer('');
      setError('');

      if (next.length === 0) {
        onComplete(
          Math.floor((Date.now() - startTime) / 1000),
          [...moodHistory, emotionRef.current]
        );
      }
    } else {
      setError('Incorrect! Question moved to end.');
      setTimeout(() => {
        setActiveQuestions((q) => {
          const arr = [...q];
          const failed = arr.shift();
          if (failed) arr.push(failed);
          return arr;
        });
        setAnswer('');
        setError('');
      }, 1500);
    }
  };

  if (activeQuestions.length === 0) return null;

  return (
    <div
      className="min-h-screen text-[#e5e5e5] font-mono transition-colors duration-700"
      style={{
        backgroundColor: '#1a1a1f',
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${theme.bg} 0%, transparent 60%)`,
      }}
    >
      <div className="flex min-h-screen">
        {/* LEFT PANEL */}
        <div
          className="w-72 shrink-0 flex flex-col border-r transition-colors duration-700"
          style={{ borderColor: theme.border, backgroundColor: theme.bg }}
        >
          <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '3/4' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
                <span className="text-[10px] text-red-400 uppercase tracking-wider">{cameraError}</span>
              </div>
            )}
            <div className={`absolute top-3 left-3 text-[9px] px-2 py-1 rounded-full font-bold uppercase ${detectionActive ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-white/20'}`}>
              {detectionActive ? '● Live' : '○ Waiting'}
            </div>
          </div>

          <div className="flex-1 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.color }} />
                <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: theme.color }}>Live Analysis</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-5xl">{EMOTION_ICONS[currentEmotion] || '😐'}</span>
                <div>
                  <p className="font-bold text-base leading-tight" style={{ color: theme.color }}>{theme.message}</p>
                  <p className="text-[11px] opacity-60 mt-1">{theme.subtext}</p>
                </div>
              </div>
            </div>

            {moodHistory.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {moodHistory.slice(-12).map((m, i) => (
                  <span key={i} className="text-lg" style={{ opacity: 0.2 + (i / 12) * 0.8 }}>
                    {EMOTION_ICONS[m] || '😐'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <main className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-2xl text-center space-y-12">
            <ProgressStepper currentStep={completedCount} totalSteps={5} />
            <h1 className="text-4xl md:text-5xl font-light min-h-[120px] flex items-center justify-center">
              {activeQuestions[0].question}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <input
                autoFocus
                type="text"
                value={answer}
                disabled={!!error}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type answer..."
                className={`w-full px-6 py-4 bg-white/5 border-2 rounded-lg text-2xl text-center transition-all ${error ? 'border-red-500 scale-95' : 'border-white/10'}`}
                style={!error ? { borderColor: `${theme.color}40` } : {}}
              />
              <button
                type="submit"
                disabled={!!error || !answer.trim()}
                className="px-12 py-4 rounded-lg font-bold w-full transition-all active:scale-95 disabled:opacity-20"
                style={{ backgroundColor: theme.color, color: '#111' }}
              >
                Verify Entry
              </button>
            </form>
            {error && <p className="text-red-400 text-xs uppercase tracking-tighter animate-pulse">{error}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}