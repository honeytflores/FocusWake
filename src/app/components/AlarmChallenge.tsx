import { useState, useEffect } from 'react';
import { ProgressStepper } from './ProgressStepper';

interface Question {
  question: string;
  answer: string;
  placeholder?: string;
}

interface AlarmChallengeProps {
  onComplete: (completionTime: number) => void;
}

export function AlarmChallenge({ onComplete }: AlarmChallengeProps) {
  // We keep currentStep at 0 because we will always show the first item in the queue
  const [answer, setAnswer] = useState('');
  const [startTime] = useState(Date.now());
  const [error, setError] = useState('');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [completedCount, setCompletedCount] = useState(0); // Track successful answers

  const getFullQuestionBank = (): Question[] => {
    const now = new Date();
    return [
      { question: "What is the current month?", answer: now.toLocaleDateString('en-US', { month: 'long' }), placeholder: 'e.g. April' },
      { question: "What day of the week is it?", answer: now.toLocaleDateString('en-US', { weekday: 'long' }), placeholder: 'e.g. Thursday' },
      { question: "Is it currently AM or PM?", answer: now.getHours() >= 12 ? 'PM' : 'AM', placeholder: 'AM or PM' },
      { question: "What is the current year?", answer: now.getFullYear().toString(), placeholder: 'YYYY' },
      { question: "What was the day yesterday?", answer: new Date(Date.now() - 86400000).toLocaleDateString('en-US', { weekday: 'long' }) },
      { question: "Type the word 'COFFEE' in all caps", answer: 'COFFEE' },
      { question: "Type the word 'ALARM' backwards", answer: 'MRALA' },
      { question: "Type the name of this app", answer: 'FocusWake' },
      { question: "Type 'READYREADYREADY'", answer: 'READYREADYREADY' },
      { question: "What is the third letter in 'STUDENT'?", answer: 'U' },
      { question: "Type the first five letters of the alphabet", answer: 'ABCDE' },
      { question: "What is 5 + 5?", answer: '10' },
      { question: "What is 10 minus 3?", answer: '7' },
      { question: "What is 2 x 3?", answer: '6' },
      { question: "How many hours are in a full day?", answer: '24' },
      { question: "How many letters are in the word 'HELLO'?", answer: '5' },
      { question: "Type 'STOP' to confirm", answer: 'STOP' },
      { question: "Type 'I AM AWAKE'", answer: 'I AM AWAKE' },
      { question: "What is 15 + 15?", answer: '30' },
      { question: "Type 'WAKE UP' three times", answer: 'WAKE UP WAKE UP WAKE UP' }
    ];
  };

  useEffect(() => {
    const shuffled = getFullQuestionBank().sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQuestions.length === 0 || error) return;

    const currentQuestion = activeQuestions[0]; // Always look at the first in queue
    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = currentQuestion.answer.toLowerCase().trim();

    if (userAnswer === correctAnswer) {
      const updatedQuestions = [...activeQuestions];
      updatedQuestions.shift(); // Remove the first question
      setActiveQuestions(updatedQuestions);
      setCompletedCount(prev => prev + 1); // Progress the stepper
      setAnswer('');
      setError('');

      if (updatedQuestions.length === 0) {
        const completionTime = Math.floor((Date.now() - startTime) / 1000);
        onComplete(completionTime);
      }
    } else {
      setError('Incorrect! Moving to the end...');
      
      // We give the user 1.5 seconds to read the error before shifting the UI
      setTimeout(() => {
        const updatedQuestions = [...activeQuestions];
        const missedQuestion = updatedQuestions.shift()!;
        updatedQuestions.push(missedQuestion); // Move to end of queue
        
        setActiveQuestions(updatedQuestions);
        setAnswer('');
        setError('');
      }, 1500);
    }
  };

  if (activeQuestions.length === 0) return null;

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-[#e5e5e5] flex flex-col items-center justify-center p-8 font-mono">
      <div className="w-full max-w-3xl">
        <div className="mb-16">
          {/* ProgressStepper now uses completedCount to show real progress */}
          <ProgressStepper currentStep={completedCount} totalSteps={5} />
        </div>

        <div className="text-center space-y-8">
          <h1 className="text-5xl text-[#e5e5e5] leading-tight min-h-[120px]">
            {activeQuestions[0].question}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={activeQuestions[0].placeholder || "Type answer..."}
              className={`w-full px-6 py-4 bg-[#141419] border-2 rounded-lg text-2xl text-[#e5e5e5] focus:outline-none transition-all ${
                error ? 'border-red-500 animate-pulse' : 'border-[var(--electric-blue)]'
              }`}
              autoFocus
              disabled={!!error} // Prevent typing during the "moving to back" animation
            />
            <button
              type="submit"
              disabled={!!error}
              className={`px-12 py-4 bg-[var(--electric-blue)] text-[#1a1a1f] rounded-lg text-xl font-bold w-full md:w-auto transition-all ${
                error ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00b8e6] active:scale-95'
              }`}
            >
              Verify [Enter]
            </button>
          </form>

          <div className="text-[#888899] text-sm tracking-widest uppercase">
            {completedCount} of 5 Completed
          </div>
        </div>
      </div>
    </div>
  );
}