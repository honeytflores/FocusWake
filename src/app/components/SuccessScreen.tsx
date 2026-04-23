interface SuccessScreenProps {
  userName: string; 
  completionTime: number;
  onBackToDashboard: () => void;
}

export function SuccessScreen({
  userName,
  completionTime,
  onBackToDashboard,
}: SuccessScreenProps) {
  // ... rest of your code

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--success-green)] to-[#1a3a2a] text-[#e5e5e5] flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-2xl">
        <div className="inline-block relative">
          <div className="w-32 h-32 rounded-full border-4 border-[#4ade80] flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
            <svg
              className="w-16 h-16 text-[#4ade80]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl text-[#e5e5e5] font-mono">
              Good Morning, {userName}.
            </h1>
          <p className="text-2xl text-[#a0e0b0]">You're wide awake.</p>
        </div>

        <div className="bg-[#1a3a2a]/50 backdrop-blur border border-[#4ade80]/30 rounded-xl p-6 inline-block">
          <div className="text-[#a0e0b0] mb-2">Completion Time</div>
          <div className="text-4xl font-mono text-[#4ade80]">
            {formatTime(completionTime)}
          </div>
          <div className="text-[#888899] mt-3">5 questions answered</div>
        </div>

        <button
          onClick={onBackToDashboard}
          className="mt-8 px-8 py-3 bg-[#4ade80] text-[#1a3a2a] rounded-lg hover:bg-[#3bc96e] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
