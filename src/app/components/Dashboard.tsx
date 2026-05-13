import { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Activity } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

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

type EmotionType = 'Normal' | 'Irritability' | 'Anxiety' | 'Annoyance' | 'Fatigue';

// Mapping face-api emotions to your specific project requirements
const emotionThemes: Record<string, { color: string; bg: string; message: string; subtext: string }> = {
  neutral: { color: '#00d4ff', bg: 'rgba(0, 212, 255, 0.05)', message: 'State: Normal', subtext: 'You are in your optimal productivity zone.' },
  angry: { color: '#ff4d4d', bg: 'rgba(255, 77, 77, 0.08)', message: 'State: Irritability', subtext: 'Irritability detected. Take a deep breath.' },
  fearful: { color: '#ffb366', bg: 'rgba(255, 179, 102, 0.08)', message: 'State: Anxiety', subtext: 'Feeling anxious? Focus on the next small step.' },
  disgusted: { color: '#ffff66', bg: 'rgba(255, 255, 102, 0.08)', message: 'State: Annoyance', subtext: 'Clear the noise and reset your focus.' },
  sad: { color: '#99ff99', bg: 'rgba(153, 255, 153, 0.08)', message: 'State: Fatigue', subtext: 'Rest is productive. Consider a quick stretch.' },
};

export function Dashboard({ userName, setUserName, onStartAlarm }: DashboardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const saved = localStorage.getItem('focusWake_alarms');
    return saved ? JSON.parse(saved) : [
      { id: '1', time: '07:00', enabled: true, label: 'Morning Wake' },
    ];
  });

  // 1. Load AI Models
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  // 2. Manage Clock & Alarm Triggers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now.getSeconds() === 0) {
        const currentHHmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const triggered = alarms.find(a => a.enabled && a.time === currentHHmm);
        if (triggered) {
          setIsAlarmActive(true);
          setIsCameraOn(true);
          onStartAlarm();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, onStartAlarm]);

  // 3. Camera Stream Control
  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(err => console.error("Camera access denied", err));
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
  }, [isCameraOn]);

  // 4. AI Detection Logic
  const handleVideoPlay = () => {
    const detectionInterval = setInterval(async () => {
      if (videoRef.current && isCameraOn && modelsLoaded) {
        const detections = await faceapi.detectAllFaces(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceExpressions();

        if (detections.length > 0) {
          const expressions = detections[0].expressions;
          const best = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b);
          setCurrentEmotion(best[0]);
        }
      }
    }, 500);
    return () => clearInterval(detectionInterval);
  };

  const theme = emotionThemes[currentEmotion] || emotionThemes['neutral'];
  const formatTime = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex">
      {/* Sidebar navigation can stay as you had it */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          
          {/* Top Section: AI Vision and Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            
            {/* Live Camera Feed */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-[#2a2a32] shadow-xl aspect-video">
              {isCameraOn ? (
                <video ref={videoRef} onPlay={handleVideoPlay} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#444455]">
                  <CameraOff size={32} className="mb-2" />
                  <span className="text-[10px] uppercase tracking-widest">Feed Offline</span>
                </div>
              )}
              <div className="absolute top-4 left-4 bg-black/60 p-2 rounded text-[10px] font-mono text-[#00d4ff]">
                Live_Analysis: {currentEmotion.toUpperCase()}
              </div>
              <button onClick={() => setIsCameraOn(!isCameraOn)} className="absolute bottom-4 right-4 p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors">
                <Camera size={18} className="text-white" />
              </button>
            </div>

            {/* Questions Card */}
            <div className="bg-[#1f1f27] p-8 rounded-2xl border border-[#2a2a32] flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-[#888899]" />
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#888899] font-bold">Verification Task</h4>
              </div>
              <p className="text-lg mb-6">Question 1: What is 15 + 27?</p>
              <input type="text" className="bg-[#141419] border border-[#2a2a32] p-4 rounded-xl outline-none focus:border-[#00d4ff] mb-4" placeholder="Answer..." />
              <button className="py-4 bg-[#00d4ff] text-black font-bold rounded-xl hover:bg-[#00b8e6] transition-colors">Submit</button>
            </div>
          </div>

          {/* Reactive Clock Section */}
          <div 
            className="rounded-3xl p-12 mb-10 border transition-all duration-1000 text-center shadow-2xl relative overflow-hidden"
            style={{ borderColor: `${theme.color}33`, backgroundColor: theme.bg }}
          >
            <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: theme.color }}>{theme.message}</h2>
            <p className="text-xs text-[#888899] mb-8">{theme.subtext}</p>
            <div className="font-mono text-7xl md:text-8xl tracking-tighter mb-4" style={{ color: theme.color }}>
              {formatTime(currentTime)}
            </div>
          </div>

          {/* Alarms Section */}
          <div className="bg-[#1f1f27]/50 rounded-2xl p-8 border border-[#2a2a32]">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xs font-bold text-[#888899] uppercase tracking-widest">Alarms</h2>
               <button onClick={() => setIsAlarmActive(!isAlarmActive)} className="text-[10px] font-bold text-[#00d4ff] uppercase">presentation mode</button>
            </div>
            {alarms.map(alarm => (
              <div key={alarm.id} className="flex items-center justify-between p-4 bg-[#141419] rounded-xl border border-[#2a2a32] mb-3">
                <span className="font-mono text-2xl">{alarm.time}</span>
                <span className="text-sm text-[#888899]">{alarm.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}