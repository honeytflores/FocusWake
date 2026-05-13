import { useState, useEffect } from 'react';

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

// 1. Emotion Configuration Map
type EmotionType = 'Normal' | 'Irritability' | 'Anxiety' | 'Annoyance' | 'Fatigue';

const emotionThemes: Record<EmotionType, { color: string; bg: string; message: string; subtext: string }> = {
  Normal: {
    color: '#00d4ff', // Electric Blue
    bg: 'rgba(0, 212, 255, 0.05)',
    message: 'Stay Focused.',
    subtext: 'You are in your optimal productivity zone.'
  },
  Irritability: {
    color: '#ff4d4d', // Red
    bg: 'rgba(255, 77, 77, 0.08)',
    message: 'Take a Breath.',
    subtext: 'Irritability detected. Let’s break tasks into smaller pieces.'
  },
  Anxiety: {
    color: '#ffb366', // Soft Orange
    bg: 'rgba(255, 179, 102, 0.08)',
    message: 'One Step at a Time.',
    subtext: 'Feeling anxious? Focus only on the next 5 minutes.'
  },
  Annoyance: {
    color: '#ffff66', // Yellow
    bg: 'rgba(255, 255, 102, 0.08)',
    message: 'Clear the Noise.',
    subtext: 'Annoyance can be a distraction. Let’s reset the vibe.'
  },
  Fatigue: {
    color: '#99ff99', // Gentle Green
    bg: 'rgba(153, 255, 153, 0.08)',
    message: 'Rest is Productive.',
    subtext: 'Fatigue detected. Consider a short stretch.'
  }
};

export function Dashboard({ userName, setUserName, onStartAlarm }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [tempName, setTempName] = useState(userName);
  
  // 2. Emotion State
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('Normal');
  const theme = emotionThemes[currentEmotion];

  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const saved = localStorage.getItem('focusWake_alarms');
    return saved ? JSON.parse(saved) : [
      { id: '1', time: '07:00', enabled: true, label: 'Morning Wake' },
      { id: '2', time: '09:30', enabled: false, label: 'Work Start' },
    ];
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('08:00');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    setTempName(userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('focusWake_alarms', JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (now.getSeconds() === 0) {
        const currentHHmm = now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const triggered = alarms.find(a => a.enabled && a.time === currentHHmm);
        if (triggered) {
          onStartAlarm();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, onStartAlarm]);

  const handleSaveSettings = () => {
    setUserName(tempName); 
    localStorage.setItem('focusWake_user', tempName);
    alert("Settings Saved!");
  };

  const toggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const handleAddAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      time: newTime,
      enabled: true,
      label: newLabel || 'Alarm',
    };
    setAlarms([...alarms, newAlarm].sort((a, b) => a.time.localeCompare(b.time)));
    setShowAddForm(false);
    setNewLabel('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex">
      <aside className="w-64 bg-[#141419] border-r border-[#2a2a32] p-6 hidden md:block">
        <h3 className="mb-6 text-[#00d4ff] font-mono font-bold tracking-tighter text-xl">FocusWake</h3>
        <nav className="space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === 'dashboard' ? 'bg-[#2a2a32] text-[#e5e5e5]' : 'text-[#888899] hover:bg-[#2a2a32]/50'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === 'settings' ? 'bg-[#2a2a32] text-[#e5e5e5]' : 'text-[#888899] hover:bg-[#2a2a32]/50'}`}
          >
            Settings
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500">
              
              {/* 3. Mental State Selector */}
              <div className="mb-10 p-5 bg-[#1f1f27] rounded-xl border border-[#2a2a32]">
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#888899] mb-4 font-bold">Mental State Detection</h4>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(emotionThemes) as EmotionType[]).map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setCurrentEmotion(emo)}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300 border ${
                        currentEmotion === emo 
                        ? 'bg-white text-black border-white' 
                        : 'bg-[#141419] text-[#555566] border-[#2a2a32] hover:border-[#444455]'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
                <h1 className="text-3xl font-bold">Welcome back, {userName}</h1>
                <div className="flex gap-4">
                  <button onClick={() => setShowAddForm(!showAddForm)} className="px-6 py-2 border border-[#00d4ff] text-[#00d4ff] rounded-lg hover:bg-[#00d4ff]/10 transition-colors">
                    {showAddForm ? 'Cancel' : '+ Add Alarm'}
                  </button>
                  <button onClick={onStartAlarm} className="px-6 py-2 bg-[#00d4ff] text-[#1a1a1f] rounded-lg hover:bg-[#00b8e6] transition-colors font-bold">
                    Test
                  </button>
                </div>
              </div>

              {showAddForm && (
                <div className="bg-[#1f1f27] rounded-xl p-6 border border-[#00d4ff] mb-8">
                  <form onSubmit={handleAddAlarm} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm text-[#888899]">Wake Time</label>
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-[#141419] border border-[#2a2a32] rounded-lg p-2 text-xl text-[#e5e5e5] outline-none" required />
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm text-[#888899]">Label</label>
                      <input type="text" placeholder="e.g. Study" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-full bg-[#141419] border border-[#2a2a32] rounded-lg p-2 text-xl text-[#e5e5e5] outline-none" />
                    </div>
                    <button type="submit" className="w-full md:w-auto px-8 py-3 bg-[#4ade80] text-[#1a1a1f] rounded-lg font-bold">Save</button>
                  </form>
                </div>
              )}

              {/* 4. Reactive Digital Clock */}
              <div 
                className="rounded-2xl p-12 mb-8 border transition-all duration-700 text-center shadow-2xl"
                style={{ 
                  borderColor: `${theme.color}44`, 
                  backgroundColor: theme.bg 
                }}
              >
                <div className="mb-4">
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: theme.color }}>{theme.message}</h2>
                  <p className="text-xs text-[#888899] mt-1">{theme.subtext}</p>
                </div>
                <div 
                  className="font-mono text-5xl md:text-7xl tracking-wider mb-2 transition-colors duration-700"
                  style={{ color: theme.color }}
                >
                  {formatTime(currentTime)}
                </div>
                <div className="text-[#888899] uppercase tracking-widest text-xs">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              <div className="bg-[#1f1f27] rounded-xl p-6 border border-[#2a2a32]">
                <h2 className="mb-6 font-semibold text-[#888899] uppercase tracking-tight">Scheduled Alarms</h2>
                <div className="space-y-4">
                  {alarms.map((alarm) => (
                    <div key={alarm.id} className="flex items-center justify-between p-4 bg-[#141419] rounded-lg border border-[#2a2a32]">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-2xl md:text-3xl">{alarm.time}</span>
                        <span className="text-[#e5e5e5]">{alarm.label}</span>
                      </div>
                      <button 
                        onClick={() => toggleAlarm(alarm.id)} 
                        className={`relative w-14 h-7 rounded-full transition-colors ${alarm.enabled ? 'bg-[#00d4ff]' : 'bg-[#2a2a32]'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${alarm.enabled ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h1 className="text-3xl font-bold mb-12">Settings</h1>
              <div className="bg-[#1f1f27] rounded-xl p-8 border border-[#2a2a32] space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h4 className="text-lg font-medium">User Profile</h4>
                    <p className="text-sm text-[#888899]">How the system identifies you.</p>
                  </div>
                  <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)} 
                    className="w-full md:w-64 bg-[#141419] border border-[#2a2a32] rounded-lg p-3 text-[#00d4ff] outline-none"
                  />
                </div>
                <div className="flex justify-end pt-4 border-t border-[#2a2a32]">
                  <button onClick={handleSaveSettings} className="px-8 py-2 bg-[#00d4ff] text-[#1a1a1f] rounded-lg font-bold">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 