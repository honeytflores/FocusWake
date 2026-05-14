import { useState, useEffect, useRef, useCallback } from 'react';
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
const emotionThemes: Record<string, { color: string; bg: string; border: string; message: string; subtext: string }> = {
  neutral:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.05)',   border: 'rgba(0,212,255,0.2)',   message: 'State: Normal',       subtext: 'You are in your optimal productivity zone.'    },
  angry:     { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)',   border: 'rgba(255,77,77,0.25)',  message: 'State: Irritability', subtext: 'Irritability detected. Take a deep breath.'    },
  fearful:   { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', border: 'rgba(255,179,102,0.2)', message: 'State: Anxiety',      subtext: 'Feeling anxious? Focus on the next small step.' },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', border: 'rgba(255,255,102,0.2)', message: 'State: Annoyance',    subtext: 'Clear the noise and reset your focus.'          },
  sad:       { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', border: 'rgba(153,255,153,0.2)', message: 'State: Fatigue',      subtext: 'Rest is productive. Consider a quick stretch.'  },
  surprised: { color: '#cc99ff', bg: 'rgba(204,153,255,0.08)', border: 'rgba(204,153,255,0.2)', message: 'State: Surprise',     subtext: 'Something caught your attention!'               },
  happy:     { color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   border: 'rgba(255,215,0,0.2)',   message: 'State: Happy',        subtext: 'Great energy! Keep it up.'                      },
};

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😐', angry: '😤', fearful: '😰', disgusted: '😒',
  sad: '😴', surprised: '😲', happy: '😊',
};

// ─── Question bank ────────────────────────────────────────────────────────────
function getFullQuestionBank(): Question[] {
  const now = new Date();
  return [
    { question: "What is the current month?", answer: now.toLocaleDateString('en-US', { month: 'long' }) },
    { question: "What day of the week is it?", answer: now.toLocaleDateString('en-US', { weekday: 'long' }) },
    { question: "Is it currently AM or PM?", answer: now.getHours() >= 12 ? 'PM' : 'AM' },
    { question: "What is the current year?", answer: now.getFullYear().toString() },
    { question: "Type the word 'COFFEE' in all caps", answer: 'COFFEE' },
    { question: "Type the word 'ALARM' backwards", answer: 'MRALA' },
    { question: "Type the name of this app", answer: 'FocusWake' },
    { question: "What is 5 + 5?", answer: '10' },
    { question: "What is 10 minus 3?", answer: '7' },
    { question: "How many hours are in a full day?", answer: '24' },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AlarmChallenge({ onComplete, modelsLoaded }: AlarmChallengeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // persist stream across renders

  const [answer, setAnswer] = useState('');
  const [startTime] = useState(Date.now());
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [moodHistory, setMoodHistory] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [isTargetEmotion, setIsTargetEmotion] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  // ── Init questions ──
  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  // ── Camera + Detection Setup (unified effect) ──
  useEffect(() => {
    if (!modelsLoaded) return;

    let cancelled = false;

    const startCameraAndDetection = async () => {
      try {
        // 1. Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        streamRef.current = stream;
        
        // 2. Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Force play - some browsers need this after srcObject assignment
          await videoRef.current.play().catch(err => {
            console.warn('Video play failed:', err);
            setCameraError('Video playback blocked. Click to enable.');
          });
          setCameraReady(true);
          setCameraError(null);
        }

        // 3. Start detection loop (don't wait for onPlay - more reliable)
        startDetectionLoop();
        
      } catch (err: any) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
          setCameraError('Camera permission denied. Please allow access.');
        } else if (err.name === 'NotFoundError') {
          setCameraError('No camera found on this device.');
        } else if (err.name === 'NotSecureContextError' || !window.isSecureContext) {
          setCameraError('Camera requires HTTPS. Please use a secure connection.');
        } else {
          setCameraError(`Camera error: ${err.message || 'Unknown error'}`);
        }
        setCameraReady(false);
      }
    };

    const startDetectionLoop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = setInterval(async () => {
        // Use videoRef directly — no cameraReady state check (stale closure fix)
        if (!videoRef.current || !modelsLoaded) return;
        if (videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) return;
        
        try {
          const detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceExpressions();
            
          if (detections?.length > 0) {
            const expressions = detections[0].expressions;
            const best = (Object.entries(expressions) as [string, number][])
              .reduce((a, b) => a[1] > b[1] ? a : b);
              
            const mappedEmotion = best[0];
            setCurrentEmotion(mappedEmotion);
            setIsTargetEmotion(false);
            setMoodHistory(h => [...h.slice(-19), mappedEmotion]);
            setDetectionActive(true);
          } else {
            setDetectionActive(false);
          }
        } catch (err) {
          console.warn('Detection error:', err);
          setDetectionActive(false);
        }
      }, 500);
    };

    startCameraAndDetection();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [modelsLoaded, cameraReady]);

  // ── Fallback: Retry camera on user click ──
  const handleEnableCamera = async () => {
    setCameraError(null);
    // Re-trigger the effect by toggling a state (or just reload component)
    window.location.reload(); // Simplest reliable retry
  };

  // ── Submit logic ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQuestions.length === 0 || error) return;

    const currentQuestion = activeQuestions[0];
    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = currentQuestion.answer.toLowerCase().trim();

    if (userAnswer === correctAnswer) {
      const updatedQuestions = [...activeQuestions];
      updatedQuestions.shift();
      setActiveQuestions(updatedQuestions);
      setCompletedCount(prev => prev + 1);
      setAnswer('');
      setError('');

      if (updatedQuestions.length === 0) {
        const completionTime = Math.floor((Date.now() - startTime) / 1000);
        onComplete(completionTime, [...moodHistory, currentEmotion]);
      }
    } else {
      setError('Incorrect! Question moved to end.');
      setTimeout(() => {
        const updatedQuestions = [...activeQuestions];
        const missed = updatedQuestions.shift()!;
        updatedQuestions.push(missed);
        setActiveQuestions(updatedQuestions);
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

        {/* ── LEFT: Camera + Emotion Analysis ── */}
        <div
          className="w-72 shrink-0 flex flex-col border-r transition-colors duration-700"
          style={{ borderColor: theme.border, backgroundColor: `${theme.bg}` }}
        >
          {/* Camera feed */}
          <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <span className="text-2xl mb-2">📷</span>
                <span className="text-[10px] text-[#ff6b6b] uppercase tracking-wider mb-3">{cameraError}</span>
                <button
                  onClick={handleEnableCamera}
                  className="text-[10px] px-3 py-1.5 bg-[#222] border border-[#444] rounded hover:bg-[#333] transition"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <span className="text-[10px] text-[#666] uppercase tracking-widest">Starting camera…</span>
                  </div>
                )}
              </>
            )}

            {/* Detection pill */}
            <div className={`absolute top-3 left-3 text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${
              detectionActive ? 'bg-green-500/20 text-green-300' : 'bg-[#222]/80 text-[#555]'
            }`}>
              {detectionActive ? '● Live' : '○ Waiting'}
            </div>
          </div>

          {/* Emotion readout */}
          <div className="flex-1 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2 h-2 rounded-full animate-pulse shrink-0"
                  style={{ backgroundColor: theme.color }}
                />
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.color }}>
                  Live Analysis
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <span className="text-5xl leading-none">{EMOTION_ICONS[currentEmotion] ?? '😐'}</span>
                <div>
                  <p className="font-bold text-base leading-tight" style={{ color: theme.color }}>
                    {theme.message}
                  </p>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: `${theme.color}99` }}>
                    {theme.subtext}
                  </p>
                </div>
              </div>
            </div>

            {/* Mood history */}
            {moodHistory.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: `${theme.color}55` }}>
                  Session history
                </p>
                <div className="flex flex-wrap gap-1">
                  {moodHistory.slice(-12).map((m, i) => (
                    <span
                      key={i}
                      title={emotionThemes[m]?.message ?? m}
                      className="text-lg leading-none"
                      style={{ opacity: 0.2 + (i / 12) * 0.8 }}
                    >
                      {EMOTION_ICONS[m] ?? '😐'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Progress + Question + Form ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-2xl">

            {/* Progress stepper */}
            <div className="mb-14">
              <ProgressStepper currentStep={completedCount} totalSteps={5} />
            </div>

            {/* Question */}
            <div className="text-center space-y-8">
              <h1 className="text-4xl md:text-5xl text-[#e5e5e5] leading-tight min-h-[120px]">
                {activeQuestions[0].question}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-6">
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder={activeQuestions[0].placeholder || 'Type answer...'}
                  disabled={!!error}
                  className={`w-full px-6 py-4 bg-[#141419] border-2 rounded-lg text-2xl text-[#e5e5e5] focus:outline-none transition-all ${
                    error ? 'border-red-500 animate-pulse' : ''
                  }`}
                  style={!error ? { borderColor: theme.color } : {}}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!!error || !answer.trim()}
                  className="px-12 py-4 rounded-lg text-xl font-bold w-full md:w-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  style={{ backgroundColor: theme.color, color: '#1a1a1f' }}
                >
                  Verify [Enter]
                </button>
              </form>

              {error && (
                <p className="text-red-400 text-sm tracking-widest uppercase animate-pulse">{error}</p>
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