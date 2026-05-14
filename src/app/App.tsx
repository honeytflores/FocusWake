import { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { AlarmChallenge } from './components/AlarmChallenge';
import { SuccessScreen } from './components/SuccessScreen';

type AppState = 'dashboard' | 'alarm' | 'success';

export default function App() {
  const [appState, setAppState] = useState<AppState>('dashboard');

  const [completionTime, setCompletionTime] = useState(0);

  const [lastEmotion, setLastEmotion] = useState('neutral');

  const [userName, setUserName] = useState(
    () => localStorage.getItem('focusWake_user') || 'Hani'
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load alarm audio
  useEffect(() => {
    audioRef.current = new Audio('/iphone-radial.mp3');
    audioRef.current.loop = true;
    audioRef.current.load();
  }, []);

  // Start alarm
  const handleStartAlarm = () => {

    if (audioRef.current) {
      audioRef.current.volume = 0.8;

      audioRef.current.play().catch((err) => {
        console.warn('Audio playback blocked.', err);
      });
    }

    setAppState('alarm');
  };

  // Alarm completed
  const handleAlarmComplete = (
    time: number,
    moodHistory: string[]
  ) => {

    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Save completion time
    setCompletionTime(time);

    // Save final detected emotion
    setLastEmotion(
      moodHistory[moodHistory.length - 1] || 'neutral'
    );

    // Go to success screen
    setAppState('success');
  };

  // Return to dashboard
  const handleBackToDashboard = () => {
    setAppState('dashboard');
  };

  return (
    <div className="dark size-full">

      {/* Dashboard */}
      {appState === 'dashboard' && (
        <Dashboard
          userName={userName}
          setUserName={setUserName}
          onStartAlarm={handleStartAlarm}
        />
      )}

      {/* Alarm Challenge */}
      {appState === 'alarm' && (
        <AlarmChallenge
          onComplete={handleAlarmComplete}
        />
      )}

      {/* Success Screen */}
      {appState === 'success' && (
        <SuccessScreen
          userName={userName}
          completionTime={completionTime}
          onBackToDashboard={handleBackToDashboard}
          lastEmotion={lastEmotion}
        />
      )}

    </div>
  );
}