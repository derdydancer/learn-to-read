import React, { useState, useEffect, useRef } from 'react';
import { AnalyzedWord, LetterData } from '../types';
import { playSound, playWordSequence, getAudioContext, PlaybackTiming, playCustomWordRecording } from '../utils/audioPlayer';

interface WordViewerProps {
  wordData: AnalyzedWord;
  onComplete: () => void;
}

const WordViewer: React.FC<WordViewerProps> = ({ wordData, onComplete }) => {
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([]);
  const [wordComplete, setWordComplete] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Animation refs
  const letterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ballStyle, setBallStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    setProgressIndex(0);
    setHighlightedIndices([]);
    setWordComplete(false);
    setIsPlaying(false);
    setBallStyle({ opacity: 0 });
    letterRefs.current = letterRefs.current.slice(0, wordData.letters.length);
  }, [wordData]);

  // Auto-skip separators
  useEffect(() => {
      if (wordComplete) return;
      const currentLetter = wordData.letters[progressIndex];
      if (currentLetter && currentLetter.soundCategory === 'separator') {
          const nextIndex = progressIndex + 1;
          // Just advance, do not trigger finish automatically
          if (nextIndex <= wordData.letters.length) {
              setTimeout(() => setProgressIndex(nextIndex), 100);
          }
      }
  }, [progressIndex, wordData, wordComplete]);

  // Plays the phonetically stitched version for the ball animation
  const runKaraokeAnimation = async (): Promise<void> => {
      // FORCE stitched audio (true) to ensure the ball bounces on phonemes properly
      const timings = await playWordSequence(wordData, true);
      
      if (timings.length === 0) {
          return Promise.resolve();
      }

      setIsPlaying(true);
      const ctx = getAudioContext();
      
      const firstIndex = timings[0].index;
      const lastIndex = timings[timings.length - 1].index;
      
      const firstEl = letterRefs.current[firstIndex];
      const lastEl = letterRefs.current[lastIndex];
      const containerEl = containerRef.current;

      if (!firstEl || !lastEl || !containerEl) {
          setIsPlaying(false);
          return Promise.resolve();
      }

      const firstRect = firstEl.getBoundingClientRect();
      const lastRect = lastEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();

      const startX = firstRect.left - containerRect.left;
      const endX = lastRect.right - containerRect.left;
      const totalDistance = endX - startX;
      
      const seqStartTime = timings[0].startTime;
      const totalDuration = (timings[timings.length - 1].startTime + timings[timings.length - 1].duration) - seqStartTime;

      return new Promise<void>((resolve) => {
          const animate = () => {
              const now = ctx.currentTime;
              const elapsed = now - seqStartTime;
              
              if (elapsed < 0) {
                 animationFrameRef.current = requestAnimationFrame(animate);
                 return;
              }

              if (elapsed > totalDuration) {
                  setBallStyle({ opacity: 0 });
                  cancelAnimationFrame(animationFrameRef.current);
                  setIsPlaying(false);
                  resolve();
                  return;
              }

              // X Position (Linear)
              const progress = elapsed / totalDuration;
              const currentX = startX + (totalDistance * progress);

              // Y Position (Bounce)
              let activeTiming = timings.find(t => now >= t.startTime && now < (t.startTime + t.duration));
              if (!activeTiming) {
                 activeTiming = timings.find(t => t.startTime > now);
              }

              let bounceY = 0;
              if (activeTiming) {
                  const localP = (now - activeTiming.startTime) / activeTiming.duration;
                  if (localP >= 0 && localP <= 1) {
                      bounceY = Math.sin(localP * Math.PI) * 15;
                  }
              }

              let currentEl = activeTiming ? letterRefs.current[activeTiming.index] : firstEl;
              if (!currentEl) currentEl = firstEl;
              
              const currentElRect = currentEl!.getBoundingClientRect();
              const currentTop = currentElRect.top - containerRect.top;

              setBallStyle({
                  opacity: 1,
                  left: `${currentX}px`, 
                  top: `${currentTop - 10 - bounceY}px`,
                  transform: 'translate(0, -50%)',
                  transition: 'none'
              });

              animationFrameRef.current = requestAnimationFrame(animate);
          };
          
          animationFrameRef.current = requestAnimationFrame(animate);
      });
  };

  const handleLetterClick = (letter: LetterData, index: number) => {
    if (wordComplete) {
        // Reuse handleReadWord logic to replay full sequence
        handleReadWord();
        return;
    }
    
    // Ignore clicks if we are done with letters but haven't pressed "Say word" yet
    if (progressIndex >= wordData.letters.length) return;

    if (letter.soundCategory === 'separator') return;
    if (index !== progressIndex) return;

    playSound(letter.char, letter.phoneme, letter.vowelDuration, letter.soundId);

    if (letter.influencers && letter.influencers.length > 0) {
      setHighlightedIndices(letter.influencers);
      setTimeout(() => setHighlightedIndices([]), 1500);
    }

    const nextIndex = progressIndex + 1;
    setProgressIndex(nextIndex);
  };

  const handleReadWord = async () => {
      // 1. Play the stitched sound + animation
      await runKaraokeAnimation();
      
      // 2. Show Emoji
      setWordComplete(true);
      onComplete();

      // 3. Play the custom recording (if exists) as the "reward"
      if (wordData.customRecordingId) {
          playCustomWordRecording(wordData.customRecordingId);
      }
  };

  const handleRuleClick = (indices: number[]) => {
      setHighlightedIndices(indices);
      setTimeout(() => setHighlightedIndices([]), 3000);
  };

  const renderRow = (isUpperCase: boolean) => {
    return (
    <div ref={isUpperCase ? containerRef : undefined} className="flex flex-wrap justify-center items-end gap-2 md:gap-3 select-none py-4 px-2 relative min-h-[160px]">
        {/* Bouncing Ball */}
        {isUpperCase && (
            <div 
                className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg border-2 border-white z-50 pointer-events-none"
                style={ballStyle}
            />
        )}

        {wordData.letters.map((letter, idx) => {
          
          if (letter.soundCategory === 'separator') {
              return <div key={`sep-${idx}`} className="w-8 md:w-12 h-20"></div>;
          }

          const isCurrent = idx === progressIndex && !wordComplete; 
          const isDone = idx < progressIndex || wordComplete;
          const isInfluencer = highlightedIndices.includes(idx);
          
          const charDisplay = isUpperCase ? letter.char.toUpperCase() : letter.char.toLowerCase();

          const charCount = letter.char.length;
          const widthStyle = { 
              width: `${charCount * (isUpperCase ? 4 : 3.5)}rem`,
              minWidth: `${charCount * (isUpperCase ? 4 : 3.5)}rem`
          };

          const textSizeClass = isUpperCase 
                ? 'text-5xl md:text-7xl' 
                : 'text-4xl md:text-6xl';
          
          let containerClass = `relative flex items-center justify-center font-comic font-bold rounded-2xl transition-all duration-300 cursor-pointer shadow-sm border-b-4 px-1 mx-0.5`;
          let heightClass = isUpperCase 
            ? 'h-24 md:h-32' 
            : 'h-20 md:h-28';

          let stateClass = "bg-white text-slate-300 border-slate-100";

          if (isCurrent && !isDone) {
            stateClass = "bg-white text-blue-600 border-blue-200 transform -translate-y-2 shadow-xl z-10 animate-pulse ring-4 ring-blue-100 cursor-pointer";
          } else if (isDone) {
            stateClass = "bg-green-100 text-green-700 border-green-300 opacity-90";
          } else if (isInfluencer) {
            stateClass = "bg-yellow-100 text-orange-600 border-yellow-300 scale-105 shadow-lg ring-2 ring-yellow-400 z-10";
          }

          return (
            <div
              key={`${isUpperCase ? 'U' : 'L'}-${idx}`}
              ref={isUpperCase ? (el) => { letterRefs.current[idx] = el } : undefined}
              onClick={() => handleLetterClick(letter, idx)}
              className={`${containerClass} ${heightClass} ${textSizeClass} ${stateClass}`}
              style={widthStyle}
              role="button"
            >
              <span className="mb-1">{charDisplay}</span>
              
              {isUpperCase && isInfluencer && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm font-sans font-bold z-20 animate-bounce">
                  Påverkar!
                </div>
              )}
            </div>
          );
        })}
    </div>
  )};

  const lettersWithRules = wordData.letters.map((l, i) => ({...l, idx: i})).filter(l => l.pronunciationRule && l.pronunciationRule.trim() !== "");
  const readyToRead = progressIndex >= wordData.letters.length && !wordComplete;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto">
      
      {/* Emoji Reward - Only shown AFTER audio completes */}
      {wordData.emoji && wordComplete && (
          <div className="animate-bounce-in text-8xl mb-6 filter drop-shadow-xl transition-all duration-1000 ease-out">
              {wordData.emoji}
          </div>
      )}

      {/* Status Header */}
      <div className="text-xl font-bold text-slate-500 mb-4 h-8 text-center">
        {wordComplete 
          ? <span className="text-green-600 animate-bounce block text-2xl">Snyggt! 🎉</span> 
          : readyToRead
            ? <span className="text-blue-600 block text-2xl animate-pulse">Bra! Läs ordet nu 👇</span>
            : <span className="flex items-center gap-2 justify-center">
                Tryck på: 
                <span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 font-mono text-2xl">
                  {wordData.letters[progressIndex]?.char.toUpperCase()} {wordData.letters[progressIndex]?.char.toLowerCase()}
                </span>
              </span>
        }
      </div>

      <div className="flex flex-col gap-8 w-full items-center bg-white/60 backdrop-blur-sm p-4 md:p-8 rounded-[2.5rem] border border-white/50 shadow-xl ring-1 ring-blue-50">
        
        {/* Uppercase Section */}
        <div className="w-full relative bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
            <div className="absolute -top-3 left-4">
                 <span className="bg-white text-blue-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm border border-blue-50">
                    Versaler (Stora)
                 </span>
            </div>
            {renderRow(true)}
        </div>

        {/* Lowercase Section */}
        <div className="w-full relative bg-purple-50/50 rounded-2xl p-4 border border-purple-100/50">
            <div className="absolute -top-3 left-4">
                <span className="bg-white text-purple-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm border border-purple-50">
                    Gemener (Små)
                </span>
            </div>
            {renderRow(false)}
        </div>
      </div>

      {/* Explanation List (Bottom) */}
      {lettersWithRules.length > 0 && (
          <div className="mt-8 w-full max-w-3xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Uttalsregler i detta ord</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lettersWithRules.map((l, i) => (
                      <button 
                        key={i}
                        onMouseEnter={() => handleRuleClick([l.idx, ...(l.influencers || [])])}
                        onClick={() => handleRuleClick([l.idx, ...(l.influencers || [])])}
                        className="flex items-center gap-3 p-3 bg-white/80 rounded-xl shadow-sm border border-slate-100 hover:bg-yellow-50 hover:border-yellow-200 transition-all text-left group"
                      >
                          <span className="bg-slate-100 text-slate-600 font-mono font-bold px-2 py-1 rounded group-hover:bg-white group-hover:text-orange-500">
                              {l.char}
                          </span>
                          <span className="text-sm text-slate-700 leading-snug">
                              {l.pronunciationRule}
                          </span>
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 h-20 flex items-center justify-center">
        {readyToRead && !wordComplete && (
            <button
                onClick={handleReadWord}
                disabled={isPlaying}
                className="animate-bounce flex items-center gap-2 px-10 py-4 rounded-full font-bold text-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-110 transition-all ring-4 ring-green-200"
            >
                {isPlaying ? 'Lyssnar...' : '🗣️ Läs ordet'}
            </button>
        )}
        
        {wordComplete && (
            <button
                onClick={handleReadWord}
                disabled={isPlaying}
                className="animate-fade-in-up flex items-center gap-2 px-8 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all ring-4 ring-blue-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {isPlaying ? 'Lyssnar...' : 'Lyssna igen'}
            </button>
        )}
      </div>

    </div>
  );
};

export default WordViewer;