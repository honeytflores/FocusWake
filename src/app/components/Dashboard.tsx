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

export function Dashboard({ userName, setUserName, onStartAlarm }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [tempName, setTempName] = useState(userName);

  const [alarms, setAlarms] = useState<Alarm[]>([
    { id: '1', time: '07:00', enabled: true, label: 'Morning Wake' },
    { id: '2', time: '09:30', enabled: false, label: 'Work Start' },
    { id: '3', time: '14:00', enabled: true, label: 'Afternoon Check' },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('08:00');
  const [newLabel, setNewLabel] = useState('');

  // Keep the input field in sync if userName changes elsewhere
  useEffect(() => {
    setTempName(userName);
  }, [userName]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const currentHHmm = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const triggered = alarms.find(a => a.enabled && a.time === currentHHmm);
      if (triggered && now.getSeconds() === 0) {
        onStartAlarm();
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
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex">
      <aside className="w-64 bg-[#141419] border-r border-[#2a2a32] p-6">
        <h3 className="mb-6 text-[var(--electric-blue)] font-mono font-bold tracking-tighter text-xl">FocusWake</h3>
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

      <main className="flex-1 p-12 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold">Welcome back, {userName}</h1>
                <div className="flex gap-4">
                  <button onClick={() => setShowAddForm(!showAddForm)} className="px-6 py-2 border border-[var(--electric-blue)] text-[var(--electric-blue)] rounded-lg hover:bg-[var(--electric-blue)]/10 transition-colors">
                    {showAddForm ? 'Cancel' : '+ Add Alarm'}
                  </button>
                  <button onClick={onStartAlarm} className="px-6 py-2 bg-[var(--electric-blue)] text-[#1a1a1f] rounded-lg hover:bg-[#00b8e6] transition-colors">
                    Test Alarm
                  </button>
                </div>
              </div>

              {showAddForm && (
                <div className="bg-[#1f1f27] rounded-xl p-6 border border-[var(--electric-blue)] mb-8 animate-in fade-in slide-in-from-top-4">
                  <form onSubmit={handleAddAlarm} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm text-[#888899]">Wake Time</label>
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-[#141419] border border-[#2a2a32] rounded-lg p-2 text-xl text-[#e5e5e5] outline-none" />
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm text-[#888899]">Label</label>
                      <input type="text" placeholder="e.g. Study Session" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-full bg-[#141419] border border-[#2a2a32] rounded-lg p-2 text-xl text-[#e5e5e5] outline-none" />
                    </div>
                    <button type="submit" className="px-8 py-3 bg-[var(--success-green)] text-[#1a1a1f] rounded-lg font-bold">Save</button>
                  </form>
                </div>
              )}

              <div className="bg-gradient-to-br from-[#1f1f27] to-[#1a1a1f] rounded-2xl p-12 mb-8 border border-[#2a2a32]/50 text-center">
                <div className="font-mono text-7xl tracking-wider text-[var(--electric-blue)] mb-2">{formatTime(currentTime)}</div>
                <div className="text-[#888899] uppercase tracking-widest text-sm">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              <div className="bg-[#1f1f27] rounded-xl p-6 border border-[#2a2a32]">
                <h2 className="mb-6 font-semibold">Scheduled Alarms</h2>
                <div className="space-y-4">
                  {alarms.map((alarm) => (
                    <div key={alarm.id} className="flex items-center justify-between p-4 bg-[#141419] rounded-lg border border-[#2a2a32]">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-3xl">{alarm.time}</span>
                        <span className="text-[#888899]">{alarm.label}</span>
                      </div>
                      <button onClick={() => toggleAlarm(alarm.id)} className={`relative w-14 h-7 rounded-full transition-colors ${alarm.enabled ? 'bg-[var(--electric-blue)]' : 'bg-[#2a2a32]'}`}>
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
              <div className="bg-card rounded-xl p-8 border border-[#2a2a32] space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-medium">User Profile</h4>
                    <p className="text-sm text-[#888899]">How the app greets you.</p>
                  </div>
                  <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)} 
                    className="bg-[#141419] border border-[#3a5a40] rounded-lg p-3 text-right text-[var(--electric-blue)] outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveSettings} className="px-8 py-2 bg-[var(--electric-blue)] text-[#1a1a1f] rounded-lg font-bold">
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