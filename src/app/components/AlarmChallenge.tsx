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

const TARGET_EMOTIONS = ['angry', 'fearful', 'disgusted', 'sad'] as const;
type TargetEmotion = typeof TARGET_EMOTIONS[number];

const emotionThemes: Record<string, { color: string; bg: string; border: string; message: string; subtext: string }> = {
  neutral:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',   border: 'rgba(0,212,255,0.25)',   message: 'Normal',       subtext: 'You are in your optimal zone.'            },
  angry:     { color: '#ff4d4d', bg: 'rgba(255,77,77,0.08)',   border: 'rgba(255,77,77,0.3)',    message: 'Irritability', subtext: 'Take a deep breath.'                       },
  fearful:   { color: '#ffb366', bg: 'rgba(255,179,102,0.08)', border: 'rgba(255,179,102,0.3)',  message: 'Anxiety',      subtext: 'Focus on the next small step.'              },
  disgusted: { color: '#ffff66', bg: 'rgba(255,255,102,0.08)', border: 'rgba(255,255,102,0.25)', message: 'Annoyance',    subtext: 'Clear the noise and reset.'                },
  sad:       { color: '#99ff99', bg: 'rgba(153,255,153,0.08)', border: 'rgba(153,255,153,0.25)', message: 'Fatigue',      subtext: 'Rest is productive.'                       },
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
    { question: "What is the current month?",              answer: now.toLocaleDateString('en-US', { month: 'long' }) },
    { question: "What day of the week is it?",             answer: now.toLocaleDateString('en-US', { weekday: 'long' }) },
    { question: "Is it currently AM or PM?",               answer: now.getHours() >= 12 ? 'PM' : 'AM' },
    { question: "What is the current year?",               answer: now.getFullYear().toString() },
    { question: "Type the word 'COFFEE' in all caps",      answer: 'COFFEE' },
    { question: "Type the word 'ALARM' backwards",         answer: 'MRALA' },
    { question: "Type the name of this app",               answer: 'FocusWake' },
    { question: "What is 5 + 5?",                          answer: '10' },
    { question: "What is 10 minus 3?",                     answer: '7' },
    { question: "How many hours are in a full day?",        answer: '24' },
  ];
}

function mapToTargetEmotion(detected: string, expressions: Record<string, number>): string {
  const CONFIDENCE_THRESHOLD = 0.5;
  if (TARGET_EMOTIONS.includes(detected as TargetEmotion) && expressions[detected] > CONFIDENCE_THRESHOLD) {
    return detected;
  }
  return 'neutral';
}

export function AlarmChallenge({ onComplete, modelsLoaded }: AlarmChallengeProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [answer, setAnswer]               = useState('');
  const [startTime]                       = useState(Date.now());
  const [error, setError]                 = useState('');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [completedCount, setCompletedCount]   = useState(0);

  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [moodHistory, setMoodHistory]       = useState<string[]>([]);
  const [cameraReady, setCameraReady]       = useState(false);
  const [isTargetEmotion, setIsTargetEmotion] = useState(false);

  const theme = emotionThemes[currentEmotion] ?? emotionThemes['neutral'];

  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  // ── Camera Stream Logic ──
  useEffect(() => {
    if (!modelsLoaded) return; // Wait for models before starting camera

    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 480 }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        console.error("Camera access blocked or not found:", err);
        setCameraReady(false);
      }
    };

    startCamera();

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [modelsLoaded]);

  const handleVideoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !modelsLoaded || videoRef.current.paused || videoRef.current.ended) return;
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
          
        if (detections && detections.length > 0) {
          const expressions = detections[0].expressions;
          const best = (Object.entries(expressions) as [string, number][])
            .reduce((a, b) => a[1] > b[1] ? a : b);
            
          const mappedEmotion = mapToTargetEmotion(best[0], expressions);
          setCurrentEmotion(mappedEmotion);
          setIsTargetEmotion(TARGET_EMOTIONS.includes(mappedEmotion as TargetEmotion));
          
          setMoodHistory(h => [...h.slice(-19), mappedEmotion]);
        }
      } catch (err) {
        console.warn("Face detection error:", err);
      }
    }, 500);
  }, [modelsLoaded]);

  // ── Corrected Submit Logic (Infinite Loop for Incorrect Answers) ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQuestions.length === 0 || error) return;

    const currentQuestion = activeQuestions[0];
    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = currentQuestion.answer.toLowerCase().trim();

    if (userAnswer === correctAnswer) {
      const updatedQuestions = [...activeQuestions];
      updatedQuestions.shift(); // Remove correct question
      
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
      
      // Delay to show error before moving the question to the end
      setTimeout(() => {
        const updatedQuestions = [...activeQuestions];
        const missed = updatedQuestions.shift()!; // Take failed question from front
        updatedQuestions.push(missed);           // Add to back of the queue
        
        setActiveQuestions(updatedQuestions);
        setAnswer('');
        setError('');
      }, 1500);
    }
  };

  if (activeQuestions.length === 0) return null;

  return (
    <div
      className="min-h-screen text-[#e5e5e5] flex flex-col items-center justify-center p-8 font-mono transition-colors duration-1000"
      style={{ backgroundColor: '#1a1a1f', backgroundImage: `radial-gradient(ellipse at 50% 0%, ${theme.bg} 0%, transparent 70%)` }}
    >
      <div className="w-full max-w-3xl">
        <div
          className={`w-full mb-10 rounded-2xl overflow-hidden border transition-all duration-700 ${
            isTargetEmotion ? 'ring-2 ring-offset-2 ring-offset-[#1a1a1f]' : ''
          }`}
          style={{ borderColor: theme.border, backgroundColor: theme.bg }}
        >
          <div className="flex items-stretch">
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
                  <span className="text-[10px] uppercase tracking-widest text-center px-2">Camera Offline</span>
                </div>
              )}
            </div>

            <div className="flex-1 px-5 py-4 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isTargetEmotion ? 'animate-pulse' : ''}`} style={{ backgroundColor: theme.color }} />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: theme.color }}>Live Analysis</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl leading-none">{EMOTION_ICONS[currentEmotion] ?? '😐'}</span>
                <div>
                  <p className="font-bold text-lg leading-tight" style={{ color: theme.color }}>{theme.message}</p>
                  <p className="text-xs text-[#666677] mt-0.5">{theme.subtext}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <ProgressStepper currentStep={completedCount} totalSteps={5} />
        </div>

        <div className="text-center space-y-8">
          <h1 className="text-4xl text-[#e5e5e5] leading-tight min-h-[100px]">
            {activeQuestions[0].question}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type answer..."
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
              className="px-12 py-4 rounded-lg text-xl font-bold w-full md:w-auto transition-all disabled:opacity-50"
              style={{ backgroundColor: theme.color, color: '#1a1a1f' }}
            >
              Verify [Enter]
            </button>
          </form>

          {error && <p className="text-red-400 text-sm tracking-widest uppercase animate-pulse">{error}</p>}
        </div>
      </div>
    </div>
  );
}