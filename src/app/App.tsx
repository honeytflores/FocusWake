import { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { AlarmChallenge } from './components/AlarmChallenge';
import { SuccessScreen } from './components/SuccessScreen';

type AppState = 'dashboard' | 'alarm' | 'success';

export default function App() {
  const [appState, setAppState] = useState<AppState>('dashboard');
  const [completionTime, setCompletionTime] = useState(0);
  const [userName, setUserName] = useState(() => localStorage.getItem('focusWake_user') || 'Hani');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/iphone-radial.mp3');
    audioRef.current.loop = true;
    audioRef.current.load();
  }, []);

  const handleStartAlarm = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.8;
      audioRef.current.play().catch(err => {
        console.warn("Audio playback blocked.", err);
      });
    }
    setAppState('alarm');
  };

  const handleAlarmComplete = (time: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCompletionTime(time);
    setAppState('success');
  };

  const handleBackToDashboard = () => {
    setAppState('dashboard');
  };

  return (
    <div className="dark size-full">
      {appState === 'dashboard' && (
        <Dashboard 
          userName={userName} 
          setUserName={setUserName} 
          onStartAlarm={handleStartAlarm} 
        />
      )}

      {appState === 'alarm' && (
        <AlarmChallenge onComplete={handleAlarmComplete} />
      )}

      {appState === 'success' && (
        <SuccessScreen
  userName={userName}
  completionTime={completionTime}
  onBackToDashboard={handleBackToDashboard}
  lastEmotion={
    moodHistory?.[moodHistory.length - 1] || 'neutral'
  }
/>
      )}
    </div>
  );
}