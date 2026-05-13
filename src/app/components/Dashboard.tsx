import { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Activity } from 'lucide-react';

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

const emotionThemes: Record<EmotionType, { color: string; bg: string; message: string; subtext: string }> = {
  Normal: { color: '#00d4ff', bg: 'rgba(0, 212, 255, 0.05)', message: 'Stay Focused, Hani.', subtext: 'You are in your optimal productivity zone.' },
  Irritability: { color: '#ff4d4d', bg: 'rgba(255, 77, 77, 0.08)', message: 'Take a Breath.', subtext: 'Irritability detected. Let’s break tasks into smaller pieces.' },
  Anxiety: { color: '#ffb366', bg: 'rgba(255, 179, 102, 0.08)', message: 'One Step at a Time.', subtext: 'Feeling anxious? Focus only on the next 5 minutes.' },
  Annoyance: { color: '#ffff66', bg: 'rgba(255, 255, 102, 0.08)', message: 'Clear the Noise.', subtext: 'Annoyance can be a distraction. Let’s reset the vibe.' },
  Fatigue: { color: '#99ff99', bg: 'rgba(153, 255, 153, 0.08)', message: 'Rest is Productive.', subtext: 'Fatigue detected. Consider a short "Power Wake" stretch.' }
};

export function Dashboard({ userName, setUserName, onStartAlarm }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [tempName, setTempName] = useState(userName);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('Normal');
  const theme = emotionThemes[currentEmotion];
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const saved = localStorage.getItem('focusWake_alarms');
    return saved ? JSON.parse(saved) : [
      { id: '1', time: '07:00', enabled: true, label: 'Morning Wake' },
      { id: '2', time: '09:30', enabled: false, label: 'Work Start' },
    ];
  });

  // Handle Camera Logic
  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Camera access denied", err));
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
  }, [isCameraOn]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now.getSeconds() === 0) {
        const currentHHmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const triggered = alarms.find(a => a.enabled && a.time === currentHHmm);
        if (triggered) onStartAlarm();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, onStartAlarm]);

  const formatTime = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex font-sans">
      <aside className="w-64 bg-[#141419] border-r border-[#2a2a32] p-6 hidden md:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-[#00d4ff] animate-pulse" />
          <h3 className="text-[#00d4ff] font-mono font-bold tracking-tighter text-xl">FocusWake</h3>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === 'dashboard' ? 'bg-[#2a2a32] text-[#e5e5e5]' : 'text-[#888899] hover:bg-[#2a2a32]/50'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === 'settings' ? 'bg-[#2a2a32] text-[#e5e5e5]' : 'text-[#888899] hover:bg-[#2a2a32]/50'}`}>Settings</button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_#1a1a1f_0%,_#141419_100%)]">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-700">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                {/* Mental State Selector */}
                <div className="lg:col-span-2 p-6 bg-[#1f1f27] rounded-2xl border border-[#2a2a32] shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-[#888899]" />
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#888899] font-bold">Affective Analysis</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(emotionThemes) as EmotionType[]).map((emo) => (
                      <button
                        key={emo}
                        onClick={() => setCurrentEmotion(emo)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 border ${
                          currentEmotion === emo 
                          ? 'bg-white text-black border-white shadow-lg' 
                          : 'bg-[#141419] text-[#555566] border-[#2a2a32] hover:border-[#00d4ff]/50'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Camera Feed */}
                <div className="relative group overflow-hidden rounded-2xl bg-black border border-[#2a2a32] shadow-xl aspect-video lg:aspect-square">
                  {isCameraOn ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#444455]">
                      <CameraOff size={32} className="mb-2" />
                      <span className="text-[10px] uppercase tracking-widest">Feed Offline</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isCameraOn ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                    <span className="text-[10px] font-mono text-white/70 uppercase">Live_Vision_v1.0</span>
                  </div>
                  <button 
                    onClick={() => setIsCameraOn(!isCameraOn)}
                    className="absolute bottom-3 right-3 p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Camera size={18} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Reactive Digital Clock */}
              <div 
                className="rounded-3xl p-12 mb-10 border transition-all duration-1000 text-center shadow-2xl relative overflow-hidden group"
                style={{ borderColor: `${theme.color}33`, backgroundColor: theme.bg }}
              >
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: theme.color }}>{theme.message}</h2>
                  <p className="text-xs text-[#888899] mb-8 max-w-xs mx-auto">{theme.subtext}</p>
                  <div className="font-mono text-7xl md:text-8xl tracking-tighter mb-4 transition-colors duration-1000" style={{ color: theme.color, textShadow: `0 0 30px ${theme.color}44` }}>
                    {formatTime(currentTime)}
                  </div>
                  <div className="text-[#888899] uppercase tracking-[0.3em] text-[10px] font-bold">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                {/* Decorative background pulse */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              </div>

              {/* Alarm List */}
              <div className="bg-[#1f1f27]/50 backdrop-blur-sm rounded-2xl p-8 border border-[#2a2a32]">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-bold text-[#888899] uppercase tracking-[0.2em] text-xs">Scheduled Wake-Up</h2>
                  <button onClick={onStartAlarm} className="text-[10px] font-bold text-[#00d4ff] hover:underline uppercase">Manual Test</button>
                </div>
                <div className="space-y-4">
                  {alarms.map((alarm) => (
                    <div key={alarm.id} className="flex items-center justify-between p-5 bg-[#141419] rounded-xl border border-[#2a2a32] hover:border-[#00d4ff]/30 transition-all group">
                      <div className="flex items-center gap-6">
                        <span className="font-mono text-3xl group-hover:text-[#00d4ff] transition-colors">{alarm.time}</span>
                        <div className="h-4 w-[1px] bg-[#2a2a32]" />
                        <span className="text-sm text-[#888899] font-medium uppercase tracking-wider">{alarm.label}</span>
                      </div>
                      <button onClick={() => setAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, enabled: !a.enabled } : a))} className={`relative w-12 h-6 rounded-full transition-all duration-500 ${alarm.enabled ? 'bg-[#00d4ff]' : 'bg-[#2a2a32]'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${alarm.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}