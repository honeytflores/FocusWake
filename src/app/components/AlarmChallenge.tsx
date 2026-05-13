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

// ─── Emotion config (focused on target states) ────────────────────────────────

const TARGET_EMOTIONS = ['angry', 'fearful', 'disgusted', 'sad'] as const;
type TargetEmotion = typeof TARGET_EMOTIONS[number];

const emotionThemes: Record<string, { color: string; bg: string; border: string; message: string; subtext: string }> = {
  neutral:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',   border: 'rgba(0,212,255,0.25)',   message: 'Normal',       subtext: 'You are in your optimal zone.'            },
  angry:     { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)',   border: 'rgba(255,77,77,0.3)',    message: 'Irritability', subtext: 'Take a deep breath.'                       },
  fearful:   { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', border: 'rgba(255,179,102,0.3)',  message: 'Anxiety',      subtext: 'Focus on the next small step.'              },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', border: 'rgba(255,255,102,0.25)', message: 'Annoyance',    subtext: 'Clear the noise and reset.'                },
  sad:       { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', border: 'rgba(153,255,153,0.25)', message: 'Fatigue',      subtext: 'Rest is productive.'                       },
  // Fallbacks for non-target emotions
  surprised: { color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',   border: 'rgba(0,212,255,0.25)',   message: 'Normal',       subtext: 'You are in your optimal zone.'            },
  happy:     { color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',   border: 'rgba(0,212,255,0.25)',   message: 'Normal',       subtext: 'You are in your optimal zone.'            },
};

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😐', angry: '😤', fearful: '😰', disgusted: '😒',
  sad: '😴', surprised: '😐', happy: '😐',
};

// ─── Question bank ────────────────────────────────────────────────────────────

function getFullQuestionBank(): Question[] {
  const now = new Date();
  return [
    { question: "What is the current month?",              answer: now.toLocaleDateString('en-US', { month: 'long' }),    placeholder: 'e.g. April'    },
    { question: "What day of the week is it?",             answer: now.toLocaleDateString('en-US', { weekday: 'long' }), placeholder: 'e.g. Thursday' },
    { question: "Is it currently AM or PM?",               answer: now.getHours() >= 12 ? 'PM' : 'AM',                  placeholder: 'AM or PM'      },
    { question: "What is the current year?",               answer: now.getFullYear().toString(),                         placeholder: 'YYYY'          },
    { question: "What was the day yesterday?",             answer: new Date(Date.now() - 86400000).toLocaleDateString('en-US', { weekday: 'long' }) },
    { question: "Type the word 'COFFEE' in all caps",      answer: 'COFFEE'              },
    { question: "Type the word 'ALARM' backwards",         answer: 'MRALA'               },
    { question: "Type the name of this app",               answer: 'FocusWake'           },
    { question: "Type 'READYREADYREADY'",                  answer: 'READYREADYREADY'     },
    { question: "What is the third letter in 'STUDENT'?",  answer: 'U'                   },
    { question: "Type the first five letters of the alphabet", answer: 'ABCDE'           },
    { question: "What is 5 + 5?",                          answer: '10'                  },
    { question: "What is 10 minus 3?",                     answer: '7'                   },
    { question: "What is 2 x 3?",                          answer: '6'                   },
    { question: "How many hours are in a full day?",        answer: '24'                  },
    { question: "How many letters are in the word 'HELLO'?", answer: '5'                 },
    { question: "Type 'STOP' to confirm",                  answer: 'STOP'                },
    { question: "Type 'I AM AWAKE'",                       answer: 'I AM AWAKE'          },
    { question: "What is 15 + 15?",                        answer: '30'                  },
    { question: "Type 'WAKE UP' three times",              answer: 'WAKE UP WAKE UP WAKE UP' },
  ];
}

// ─── Helper: Map detected emotion to target state or neutral ─────────────────
function mapToTargetEmotion(detected: string, expressions: Record<string, number>): string {
  // Only update if it's a target emotion AND confidence > threshold
  const CONFIDENCE_THRESHOLD = 0.6;
  
  if (TARGET_EMOTIONS.includes(detected as TargetEmotion) && expressions[detected] > CONFIDENCE_THRESHOLD) {
    return detected;
  }
  // For non-target emotions or low confidence, show neutral
  return 'neutral';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlarmChallenge({ onComplete, modelsLoaded }: AlarmChallengeProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [answer, setAnswer]               = useState('');
  const [startTime]                       = useState(Date.now());
  const [error, setError]                 = useState('');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [completedCount, setCompletedCount]   = useState(0);

  // Emotion state
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [moodHistory, setMoodHistory]       = useState<string[]>([]);
  const [cameraReady, setCameraReady]       = useState(false);
  const [isTargetEmotion, setIsTargetEmotion] = useState(false); // Visual feedback flag

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  // ── Init questions ──
  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  // ── Camera stream ──
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setCameraReady(true);
      })
      .catch(() => setCameraReady(false));
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── face-api detection (filtered for target emotions) ──
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
            .reduce((a, b) => a[1] > b[1] ? a : b);
            
          const [detectedEmotion, confidence] = best;
          const mappedEmotion = mapToTargetEmotion(detectedEmotion, expressions);
          
          setCurrentEmotion(mappedEmotion);
          setIsTargetEmotion(TARGET_EMOTIONS.includes(mappedEmotion as TargetEmotion));
          
          // Only log target emotions or significant changes to history
          setMoodHistory(h => {
            const last = h[h.length - 1];
            if (mappedEmotion !== last || TARGET_EMOTIONS.includes(mappedEmotion as TargetEmotion)) {
              return [...h.slice(-19), mappedEmotion];
            }
            return h;
          });
        }
      } catch { /* ignore mid-unmount errors */ }
    }, 500);
  }, [modelsLoaded]);

  // ── Answer submit ──
  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // Prevent multiple clicks during the error/success pause
  if (activeQuestions.length === 0 || error) return;

  const currentQuestion = activeQuestions[0];
  const userAnswer = answer.toLowerCase().trim();
  const correctAnswer = currentQuestion.answer.toLowerCase().trim();

  if (userAnswer === correctAnswer) {
    // SUCCESS PATH
    const updatedQuestions = [...activeQuestions];
    updatedQuestions.shift(); // Remove the current question
    
    setCompletedCount(prev => prev + 1);
    setAnswer('');
    setError('');
    setActiveQuestions(updatedQuestions);

    // If no more questions, trigger completion
    if (updatedQuestions.length === 0) {
      const completionTime = Math.floor((Date.now() - startTime) / 1000);
      onComplete(completionTime, [...moodHistory, currentEmotion]);
    }
  } else {
    // ERROR PATH: Re-queue logic
    setError('Incorrect! Question moved to end.');
    
    // Disable input briefly so user sees the error
    setTimeout(() => {
      const updatedQuestions = [...activeQuestions];
      const missedQuestion = updatedQuestions.shift()!; // Remove from front
      updatedQuestions.push(missedQuestion);           // Add to back
      
      setActiveQuestions(updatedQuestions);
      setAnswer('');
      setError('');
    }, 1500); // 1.5 second penalty/wait time
  }
};

  if (activeQuestions.length === 0) return null;

  return (
    <div
      className="min-h-screen text-[#e5e5e5] flex flex-col items-center justify-center p-8 font-mono transition-colors duration-1000"
      style={{ backgroundColor: '#1a1a1f', backgroundImage: `radial-gradient(ellipse at 50% 0%, ${theme.bg} 0%, transparent 70%)` }}
    >
      <div className="w-full max-w-3xl">

        {/* ── Emotion analysis banner ── */}
        <div
          className={`w-full mb-10 rounded-2xl overflow-hidden border transition-all duration-700 ${
            isTargetEmotion ? 'ring-2 ring-offset-2 ring-offset-[#1a1a1f]' : ''
          }`}
          style={{ 
            borderColor: theme.border, 
            backgroundColor: theme.bg,
            ringColor: theme.color 
          }}
        >
          <div className="flex items-stretch">

            {/* Live camera thumbnail */}
            <div className="relative w-36 shrink-0 bg-black">
              {cameraReady ? (
                <video
                  ref={videoRef}
                  onPlay={handleVideoPlay}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)', minHeight: 96 }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#333344] min-h-[96px]">
                  <span className="text-xs uppercase tracking-widest text-center px-2">No camera</span>
                </div>
              )}
              {/* Scan line animation */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to bottom, transparent 45%, ${theme.color}22 50%, transparent 55%)`,
                  animation: 'scanline 2.5s linear infinite',
                }}
              />
              {/* Target emotion indicator */}
              {isTargetEmotion && (
                <div 
                  className="absolute top-2 right-2 w-3 h-3 rounded-full animate-ping"
                  style={{ backgroundColor: theme.color }}
                />
              )}
            </div>

            {/* Emotion readout */}
            <div className="flex-1 px-5 py-4 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isTargetEmotion ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: theme.color }}
                />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: theme.color }}>
                  {isTargetEmotion ? '⚠️ Alert State' : 'Live Analysis'}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl leading-none">{EMOTION_ICONS[currentEmotion] ?? '😐'}</span>
                <div>
                  <p className="font-bold text-lg leading-tight" style={{ color: theme.color }}>
                    State: {theme.message}
                  </p>
                  <p className="text-xs text-[#666677] mt-0.5">{theme.subtext}</p>
                </div>
              </div>
            </div>

            {/* Mood history strip */}
            {moodHistory.length > 0 && (
              <div className="w-28 shrink-0 px-3 py-4 flex flex-col justify-center border-l" style={{ borderColor: theme.border }}>
                <p className="text-[9px] text-[#444455] uppercase tracking-widest mb-2">History</p>
                <div className="flex flex-wrap gap-1">
                  {moodHistory.slice(-10).map((m, i) => (
                    <span
                      key={i}
                      title={m}
                      className="text-sm leading-none"
                      style={{ 
                        opacity: 0.3 + (i / 10) * 0.7,
                        color: TARGET_EMOTIONS.includes(m as TargetEmotion) ? emotionThemes[m].color : '#666677'
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

        {/* ── Progress stepper ── */}
        <div className="mb-16">
          <ProgressStepper currentStep={completedCount} totalSteps={5} />
        </div>

        {/* ── Question + form ── */}
        <div className="text-center space-y-8">
          <h1 className="text-5xl text-[#e5e5e5] leading-tight min-h-[120px]">
            {activeQuestions[0].question}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={activeQuestions[0].placeholder || 'Type answer...'}
              className={`w-full px-6 py-4 bg-[#141419] border-2 rounded-lg text-2xl text-[#e5e5e5] focus:outline-none transition-all ${
                error ? 'border-red-500 animate-pulse' : ''
              }`}
              style={!error ? { borderColor: theme.color } : {}}
              autoFocus
              disabled={!!error}
            />
            <button
              type="submit"
              disabled={!!error}
              className="px-12 py-4 rounded-lg text-xl font-bold w-full md:w-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              style={{ backgroundColor: theme.color, color: '#1a1a1f' }}
            >
              Verify [Enter]
            </button>
          </form>

          {error && (
            <p className="text-red-400 text-sm tracking-widest uppercase animate-pulse">{error}</p>
          )}

          <div className="text-[#888899] text-sm tracking-widest uppercase">
            {completedCount} of 5 Completed
          </div>
        </div>
      </div>

      {/* Scanline keyframe */}
      <style>{`
        @keyframes scanline {
          0%   { background-position: 0 -100%; }
          100% { background-position: 0 200%;  }
        }
      `}</style>
    </div>
  );
}