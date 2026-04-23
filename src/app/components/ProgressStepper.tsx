interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressStepper({ currentStep, totalSteps }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all font-mono ${
              index < currentStep
                ? 'bg-[var(--electric-blue)] border-[var(--electric-blue)] text-[#1a1a1f]'
                : index === currentStep
                ? 'border-[var(--electric-blue)] text-[var(--electric-blue)]'
                : 'border-[#2a2a32] text-[#888899]'
            }`}
          >
            {index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div
              className={`w-12 h-0.5 ${
                index < currentStep ? 'bg-[var(--electric-blue)]' : 'bg-[#2a2a32]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
