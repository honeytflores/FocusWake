import { CheckCircle, RotateCcw, Zap } from 'lucide-react';

interface SuccessScreenProps {
  userName: string;
  completionTime: number;
  onBackToDashboard: () => void;
  lastEmotion?: string;
}

export function SuccessScreen({
  userName,
  completionTime,
  onBackToDashboard,
  lastEmotion,
}: SuccessScreenProps) {

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return mins > 0
      ? `${mins}m ${secs}s`
      : `${secs}s`;
  };

  const emotion = lastEmotion || 'neutral';

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex flex-col items-center justify-center p-6 font-sans">

      <div className="max-w-md w-full text-center space-y-8">

        {/* Icon */}
        <div className="relative flex justify-center">

          <div className="absolute inset-0 bg-[#4ade80]/20 blur-3xl rounded-full" />

          <div className="relative w-24 h-24 rounded-2xl bg-[#1f1f27] border border-[#4ade80]/30 flex items-center justify-center shadow-2xl">
            <CheckCircle
              size={48}
              className="text-[#4ade80]"
            />
          </div>

        </div>

        {/* Header */}
        <div className="space-y-3">

          <h1 className="text-3xl font-bold tracking-tight">
            Good Morning,{' '}
            <span className="text-[#4ade80]">
              {userName}
            </span>.
          </h1>

          <div>
            <p className="text-xs text-[#888899] uppercase tracking-[0.3em] font-mono">
              Final Emotion Detected
            </p>

            <p className="text-xl font-bold text-[#4ade80] capitalize mt-2">
              {emotion}
            </p>
          </div>

        </div>

        {/* Card */}
        <div className="bg-[#1f1f27] border border-[#2a2a32] rounded-2xl p-8 shadow-xl relative overflow-hidden group">

          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap
              size={80}
              className="text-[#4ade80]"
            />
          </div>

          <div className="relative z-10 space-y-6">

            {/* Time */}
            <div>

              <p className="text-[10px] text-[#555566] uppercase tracking-widest mb-1 font-bold">
                Wake-up Velocity
              </p>

              <div className="text-5xl font-mono font-bold text-[#4ade80] tracking-tighter">
                {formatTime(completionTime)}
              </div>

            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-[#2a2a32]">

              <div className="text-center">

                <p className="text-[10px] text-[#555566] uppercase font-bold mb-1">
                  Tasks
                </p>

                <p className="text-sm font-mono text-[#e5e5e5]">
                  5/5
                </p>

              </div>

              <div className="h-8 w-px bg-[#2a2a32]" />

              <div className="text-center">

                <p className="text-[10px] text-[#555566] uppercase font-bold mb-1">
                  Status
                </p>

                <p className="text-sm font-mono text-[#4ade80] capitalize">
                  {emotion}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* Button */}
        <button
          onClick={onBackToDashboard}
          className="group flex items-center justify-center gap-3 w-full py-4 bg-[#4ade80] text-[#1a1a1f] rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#3bc96e] transition-all shadow-lg shadow-[#4ade80]/10"
        >

          <RotateCcw
            size={16}
            className="group-hover:rotate-[-45deg] transition-transform"
          />

          Back to Home

        </button>

      </div>

    </div>
  );
}