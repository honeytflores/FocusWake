import { useState, useEffect, useRef } from 'react';
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
  modelsLoaded: boolean;
}

// ─── Emotion config ───────────────────────────────────────────────────────────
const emotionThemes: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    message: string;
    subtext: string;
  }
> = {
  neutral: {
    color: '#00d4ff',
    bg: 'rgba(0,212,255,0.05)',
    border: 'rgba(0,212,255,0.2)',
    message: 'State: Normal',
    subtext: 'You are in your optimal productivity zone.',
  },
  angry: {
    color: '#ff4d4d',
    bg: 'rgba(255,77,77,0.08)',
    border: 'rgba(255,77,77,0.25)',
    message: 'State: Irritability',
    subtext: 'Irritability detected. Take a deep breath.',
  },
  fearful: {
    color: '#ffb366',
    bg: 'rgba(255,179,102,0.08)',
    border: 'rgba(255,179,102,0.2)',
    message: 'State: Anxiety',
    subtext: 'Feeling anxious? Focus on the next small step.',
  },
  disgusted: {
    color: '#ffff66',
    bg: 'rgba(255,255,102,0.08)',
    border: 'rgba(255,255,102,0.2)',
    message: 'State: Annoyance',
    subtext: 'Clear the noise and reset your focus.',
  },
  sad: {
    color: '#99ff99',
    bg: 'rgba(153,255,153,0.08)',
    border: 'rgba(153,255,153,0.2)',
    message: 'State: Fatigue',
    subtext: 'Rest is productive. Consider a quick stretch.',
  },
  surprised: {
    color: '#cc99ff',
    bg: 'rgba(204,153,255,0.08)',
    border: 'rgba(204,153,255,0.2)',
    message: 'State: Surprise',
    subtext: 'Something caught your attention!',
  },
  happy: {
    color: '#ffd700',
    bg: 'rgba(255,215,0,0.08)',
    border: 'rgba(255,215,0,0.2)',
    message: 'State: Happy',
    subtext: 'Great energy! Keep it up.',
  },
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
    {
      question: 'What is the current month?',
      answer: now.toLocaleDateString('en-US', { month: 'long' }),
    },
    {
      question: 'What day of the week is it?',
      answer: now.toLocaleDateString('en-US', { weekday: 'long' }),
    },
    {
      question: 'Is it currently AM or PM?',
      answer: now.getHours() >= 12 ? 'PM' : 'AM',
    },
    {
      question: 'What is the current year?',
      answer: now.getFullYear().toString(),
    },
    {
      question: "Type the word 'COFFEE' in all caps",
      answer: 'COFFEE',
    },
    {
      question: "Type the word 'ALARM' backwards",
      answer: 'MRALA',
    },
    {
      question: 'Type the name of this app',
      answer: 'FocusWake',
    },
    {
      question: 'What is 5 + 5?',
      answer: '10',
    },
    {
      question: 'What is 10 minus 3?',
      answer: '7',
    },
    {
      question: 'How many hours are in a full day?',
      answer: '24',
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AlarmChallenge({
  onComplete,
  modelsLoaded,
}: AlarmChallengeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // refs prevent stale state in intervals
  const modelsRef = useRef(modelsLoaded);
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

  // keep ref synced
  useEffect(() => {
    modelsRef.current = modelsLoaded;
  }, [modelsLoaded]);

  const theme =
    emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  // ── 1. Questions ──────────────────────────────────────────────────────────
  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(
      () => 0.5 - Math.random()
    );

    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  // ── 2. Camera ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      })
      .catch((err: any) => {
        console.error('Camera Error:', err);

        if (cancelled) return;

        if (err.name === 'NotAllowedError') {
          setCameraError('Camera permission denied.');
        } else if (err.name === 'NotFoundError') {
          setCameraError('No camera found.');
        } else {
          setCameraError('Camera unavailable.');
        }
      });

    return () => {
      cancelled = true;

      streamRef.current?.getTracks().forEach((t) => t.stop());

      streamRef.current = null;
    };
  }, []);

  // ── 3. Face Detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelsLoaded) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const startupDelay = setTimeout(() => {
      intervalRef.current = setInterval(async () => {
        try {
          const video = videoRef.current;

          // Ensure video is fully ready
          if (
            !video ||
            video.readyState !== 4 ||
            video.videoWidth === 0 ||
            video.videoHeight === 0
          ) {
            return;
          }

          const detection = await faceapi
            .detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 512,
                scoreThreshold: 0.2,
              })
            )
            .withFaceLandmarks()
            .withFaceExpressions();

          if (detection?.expressions) {
            const expressions = detection.expressions;

            console.log('🎭 Expressions:', expressions);

            const sorted = Object.entries(expressions).sort(
              (a, b) => b[1] - a[1]
            );

            const [emotion, confidence] = sorted[0];

            console.log(
              `Detected: ${emotion} (${(
                confidence * 100
              ).toFixed(1)}%)`
            );

            // Prevent false neutral readings
            if (confidence > 0.45) {
              if (emotion !== emotionRef.current) {
                emotionRef.current = emotion;

                setCurrentEmotion(emotion);

                setMoodHistory((prev) => [
                  ...prev.slice(-19),
                  emotion,
                ]);
              }
            }

            setDetectionActive(true);
          } else {
            setDetectionActive(false);
          }
        } catch (err) {
          console.error('🎭 Face Detection Error:', err);

          setDetectionActive(false);
        }
      }, 700);
    }, 500);

    return () => {
      clearTimeout(startupDelay);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [modelsLoaded]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeQuestions.length === 0 || error) return;

    const correct =
      answer.toLowerCase().trim() ===
      activeQuestions[0].answer.toLowerCase().trim();

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

          arr.push(arr.shift()!);

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
          style={{
            borderColor: theme.border,
            backgroundColor: theme.bg,
          }}
        >
          {/* CAMERA */}
          <div
            className="relative bg-black overflow-hidden"
            style={{ aspectRatio: '3/4' }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center gap-3">
                <span className="text-2xl">📷</span>

                <span className="text-[10px] text-[#ff6b6b] uppercase tracking-wider">
                  {cameraError}
                </span>

                <button
                  onClick={() => window.location.reload()}
                  className="text-[10px] px-3 py-1.5 bg-[#222] border border-[#444] rounded hover:bg-[#333] transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* LIVE STATUS */}
            <div
              className={`absolute top-3 left-3 text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                detectionActive
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-[#111]/80 text-[#555]'
              }`}
            >
              {detectionActive ? '● Live' : '○ Waiting'}
            </div>
          </div>

          {/* EMOTION PANEL */}
          <div className="flex-1 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2 h-2 rounded-full animate-pulse shrink-0"
                  style={{ backgroundColor: theme.color }}
                />

                <span
                  className="text-[10px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: theme.color }}
                >
                  Live Analysis
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-5xl leading-none">
                  {EMOTION_ICONS[currentEmotion] ?? '😐'}
                </span>

                <div>
                  <p
                    className="font-bold text-base leading-tight"
                    style={{ color: theme.color }}
                  >
                    {theme.message}
                  </p>

                  <p
                    className="text-[11px] mt-1 leading-snug"
                    style={{ color: `${theme.color}99` }}
                  >
                    {theme.subtext}
                  </p>
                </div>
              </div>
            </div>

            {/* HISTORY */}
            {moodHistory.length > 0 && (
              <div>
                <p
                  className="text-[9px] uppercase tracking-widest mb-2"
                  style={{ color: `${theme.color}55` }}
                >
                  Session history
                </p>

                <div className="flex flex-wrap gap-1">
                  {moodHistory.slice(-12).map((m, i) => (
                    <span
                      key={i}
                      title={emotionThemes[m]?.message ?? m}
                      className="text-lg leading-none"
                      style={{
                        opacity: 0.2 + (i / 12) * 0.8,
                      }}
                    >
                      {EMOTION_ICONS[m] ?? '😐'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-2xl">

            <div className="mb-14">
              <ProgressStepper
                currentStep={completedCount}
                totalSteps={5}
              />
            </div>

            <div className="text-center space-y-8">

              <h1 className="text-4xl md:text-5xl text-[#e5e5e5] leading-tight min-h-[120px]">
                {activeQuestions[0].question}
              </h1>

              <form
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    activeQuestions[0].placeholder ||
                    'Type answer...'
                  }
                  disabled={!!error}
                  className={`w-full px-6 py-4 bg-[#141419] border-2 rounded-lg text-2xl text-[#e5e5e5] focus:outline-none transition-all ${
                    error
                      ? 'border-red-500 animate-pulse'
                      : ''
                  }`}
                  style={
                    !error
                      ? { borderColor: theme.color }
                      : {}
                  }
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={!!error || !answer.trim()}
                  className="px-12 py-4 rounded-lg text-xl font-bold w-full md:w-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  style={{
                    backgroundColor: theme.color,
                    color: '#1a1a1f',
                  }}
                >
                  Verify [Enter]
                </button>
              </form>

              {error && (
                <p className="text-red-400 text-sm tracking-widest uppercase animate-pulse">
                  {error}
                </p>
              )}

              <div className="text-[#555566] text-xs tracking-widest uppercase">
                {completedCount} of 5 Completed
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}