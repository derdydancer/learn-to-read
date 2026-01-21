
import React, { useState, useEffect, useRef } from 'react';
import { AnalyzedWord, LetterData } from '../types';
import { playSound, playWordSequence, getAudioContext, playBlob, stopAudio } from '../utils/audioPlayer';
import { getRecording } from '../utils/audioStorage';
import { Avatar } from './Avatar';
import { getSoundIdForLetter } from '../utils/soundDefinitions';

interface WordViewerProps {
  wordData: AnalyzedWord;
  onComplete: () => void;
  onNext?: () => void; 
  onFeedbackDone?: () => void;
  completionInstructionId?: string; 
  visemeConfig: Record<string, number>;
  globalAvatarTalking?: boolean;
}

const WordViewer: React.FC<WordViewerProps> = ({ wordData, onComplete, onNext, onFeedbackDone, completionInstructionId, visemeConfig, globalAvatarTalking = false }) => {
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([]);
  const [wordComplete, setWordComplete] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [activeVisemeId, setActiveVisemeId] = useState<number | null>(null);
  const avatarTimeoutRef = useRef<number | null>(null);
  const letterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ballStyle, setBallStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const animationFrameRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const audioTimeoutsRef = useRef<number[]>([]);

  const playInstructionBlob = async (blobId: string, delay: number = 0): Promise<number> => {
      if (!isMountedRef.current) return 0;
      const blob = await getRecording(blobId);
      if (!blob) return getAudioContext().currentTime + delay;
      const ctx = getAudioContext();
      const startTime = ctx.currentTime + delay;
      const t1 = window.setTimeout(() => {
          if (isMountedRef.current) setAvatarSpeaking(true);
      }, delay * 1000);
      audioTimeoutsRef.current.push(t1);
      const endTime = await playBlob(blob, startTime);
      const durationMs = (endTime - startTime) * 1000;
      const t2 = window.setTimeout(() => {
          if (isMountedRef.current) setAvatarSpeaking(false);
      }, delay * 1000 + durationMs + 500);
      audioTimeoutsRef.current.push(t2);
      return endTime;
  };

  useEffect(() => {
      const t = window.setTimeout(() => {
          if (isMountedRef.current) playInstructionBlob('inst_intro', 0.1);
      }, 200);
      audioTimeoutsRef.current.push(t);
  }, [wordData.id]);

  useEffect(() => {
    isMountedRef.current = true;
    setProgressIndex(0);
    setPlayingIndex(null);
    setHighlightedIndices([]);
    setWordComplete(false);
    setIsPlaying(false);
    setBallStyle({ opacity: 0 });
    setActiveVisemeId(null);
    letterRefs.current = letterRefs.current.slice(0, wordData.letters.length);
    return () => {
        isMountedRef.current = false;
        stopAudio();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        audioTimeoutsRef.current.forEach(clearTimeout);
        audioTimeoutsRef.current = [];
        if (avatarTimeoutRef.current) clearTimeout(avatarTimeoutRef.current);
        setAvatarSpeaking(false);
        setActiveVisemeId(null);
    };
  }, [wordData.id]); 

  const advanceProgress = (currentIndex: number) => {
      let nextIndex = currentIndex + 1;
      while (nextIndex < wordData.letters.length && wordData.letters[nextIndex].soundCategory === 'separator') {
          nextIndex++;
      }
      setProgressIndex(nextIndex);
  };

  const runKaraokeAnimation = async (): Promise<void> => {
      const timings = await playWordSequence(wordData, true);
      if (timings.length === 0) return Promise.resolve();
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
      const seqStartTime = timings[0].startTime;
      const totalDuration = (timings[timings.length - 1].startTime + timings[timings.length - 1].duration) - seqStartTime;

      return new Promise<void>((resolve) => {
          const animate = () => {
              if (!isMountedRef.current) return;
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
                  setActiveVisemeId(null);
                  setTimeout(() => {
                      if (isMountedRef.current) setAvatarSpeaking(false);
                      resolve();
                  }, 500);
                  return;
              }
              const currentContainerRect = containerEl.getBoundingClientRect();
              let activeTiming = timings.find(t => now >= t.startTime && now < (t.startTime + t.duration));
              let currentX = 0;
              let bounceY = 0;
              if (activeTiming) {
                  setAvatarSpeaking(true);
                  const letter = wordData.letters[activeTiming.index];
                  const soundId = letter.soundId || getSoundIdForLetter(letter.char, letter.phoneme, letter.vowelDuration);
                  if (soundId && visemeConfig[soundId] !== undefined) {
                      setActiveVisemeId(visemeConfig[soundId]);
                  } else {
                      setActiveVisemeId(null);
                  }
                  const el = letterRefs.current[activeTiming.index];
                  if (el) {
                      const elRect = el.getBoundingClientRect();
                      const elLeft = elRect.left - currentContainerRect.left;
                      const elWidth = elRect.width;
                      const localP = (now - activeTiming.startTime) / activeTiming.duration;
                      currentX = elLeft + (elWidth * localP);
                      bounceY = Math.sin(localP * Math.PI) * 10;
                  }
              } else {
                  setActiveVisemeId(null);
                  const fRect = firstEl.getBoundingClientRect();
                  const lRect = lastEl.getBoundingClientRect();
                  const startX = fRect.left - currentContainerRect.left;
                  const endX = lRect.right - currentContainerRect.left;
                  const totalDist = endX - startX;
                  const globalP = elapsed / totalDuration;
                  currentX = startX + (totalDist * globalP);
              }
              let currentEl = activeTiming ? letterRefs.current[activeTiming.index] : firstEl;
              if (!currentEl) currentEl = firstEl;
              const currentElRect = currentEl!.getBoundingClientRect();
              const currentTop = currentElRect.top - currentContainerRect.top;
              setBallStyle({
                  opacity: 1,
                  left: `${currentX}px`, 
                  top: `${currentTop - 8 - bounceY}px`,
                  transform: 'translate(0, -50%)',
                  transition: 'none'
              });
              animationFrameRef.current = requestAnimationFrame(animate);
          };
          animationFrameRef.current = requestAnimationFrame(animate);
      });
  };

  const handleLetterClick = async (letter: LetterData, index: number) => {
    if (wordComplete) { handleReadWord(); return; }
    if (progressIndex >= wordData.letters.length) return;
    if (letter.soundCategory === 'separator') return;
    if (index !== progressIndex) return;
    if (playingIndex !== null) return;
    setPlayingIndex(index);
    playSound(letter.char, letter.phoneme, letter.vowelDuration, letter.soundId);
    const soundId = letter.soundId || getSoundIdForLetter(letter.char, letter.phoneme, letter.vowelDuration);
    if (soundId && visemeConfig[soundId] !== undefined) setActiveVisemeId(visemeConfig[soundId]);
    setAvatarSpeaking(true);
    if (letter.influencers && letter.influencers.length > 0) setHighlightedIndices(letter.influencers);
    let duration = 800;
    if (soundId) {
        const blob = await getRecording(soundId);
        if (blob) {
            const ctx = getAudioContext();
            const ab = await blob.arrayBuffer();
            const buffer = await ctx.decodeAudioData(ab);
            duration = buffer.duration * 1000;
        }
    }
    avatarTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
            setAvatarSpeaking(false);
            setActiveVisemeId(null);
            setPlayingIndex(null);
            setHighlightedIndices([]);
            advanceProgress(index);
        }
        avatarTimeoutRef.current = null;
    }, duration + 500);
  };

  const playFullSequence = async (withInstructions: boolean) => {
      await runKaraokeAnimation();
      if (!isMountedRef.current) return;
      if (withInstructions) {
          setWordComplete(true);
          onComplete();
      }
      const ctx = getAudioContext();
      let nextStartTime = ctx.currentTime;
      if (wordData.customRecordingId) {
          const blob = await getRecording(wordData.customRecordingId);
          if (blob) {
              setAvatarSpeaking(true);
              nextStartTime = await playBlob(blob, nextStartTime);
              const dur = (nextStartTime - ctx.currentTime) * 1000;
              const t = window.setTimeout(() => { if (isMountedRef.current) setAvatarSpeaking(false); }, dur + 500);
              audioTimeoutsRef.current.push(t);
              nextStartTime += 0.5;
          }
      }
      if (!isMountedRef.current) return;
      if (!withInstructions) return;
      const verifyBlob = await getRecording('inst_verify');
      if (verifyBlob) {
           const delay = Math.max(0, nextStartTime - ctx.currentTime + 0.5);
           const t = window.setTimeout(() => { if (isMountedRef.current) setAvatarSpeaking(true); }, delay * 1000);
           audioTimeoutsRef.current.push(t);
           nextStartTime = await playBlob(verifyBlob, nextStartTime + 0.5);
           const t2 = window.setTimeout(() => { if (isMountedRef.current) setAvatarSpeaking(false); }, (nextStartTime - ctx.currentTime) * 1000 + 500);
           audioTimeoutsRef.current.push(t2);
           nextStartTime += 3.5; 
      }
      if (!isMountedRef.current) return;
      if (completionInstructionId) {
          const progBlob = await getRecording(completionInstructionId);
          if (progBlob) {
              const gap = 1.0;
              const delay = Math.max(0, nextStartTime - ctx.currentTime + gap);
              const t = window.setTimeout(() => { if (isMountedRef.current) setAvatarSpeaking(true); }, delay * 1000);
              audioTimeoutsRef.current.push(t);
              nextStartTime = await playBlob(progBlob, nextStartTime + gap);
              const t2 = window.setTimeout(() => { if (isMountedRef.current) setAvatarSpeaking(false); }, (nextStartTime - ctx.currentTime) * 1000 + 500);
              audioTimeoutsRef.current.push(t2);
          }
      }
      const timeRemaining = (nextStartTime - ctx.currentTime) * 1000;
      const doneTimer = window.setTimeout(() => { if (isMountedRef.current && onFeedbackDone) onFeedbackDone(); }, timeRemaining + 200);
      audioTimeoutsRef.current.push(doneTimer);
  };

  const handleReadWord = () => playFullSequence(true);
  const handleListenRepetition = () => playFullSequence(false);
  const handleRuleClick = (indices: number[]) => {
      setHighlightedIndices(indices);
      setTimeout(() => { if (isMountedRef.current) setHighlightedIndices([]); }, 3000);
  };

  const renderRow = (isUpperCase: boolean) => {
    return (
    <div ref={isUpperCase ? containerRef : undefined} className="flex flex-nowrap overflow-x-auto no-scrollbar justify-center items-end gap-1 select-none py-2 px-1 relative min-h-[100px] max-w-full">
        {isUpperCase && (<div className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 shadow-sm border-2 border-white z-50 pointer-events-none" style={ballStyle} />)}
        {wordData.letters.map((letter, idx) => {
          if (letter.soundCategory === 'separator') return <div key={`sep-${idx}`} className="w-4 h-12 flex-shrink-0"></div>;
          const isTarget = idx === progressIndex && !wordComplete && playingIndex === null;
          const isPlayingSound = idx === playingIndex;
          const isDone = idx < progressIndex || wordComplete;
          const isInfluencer = highlightedIndices.includes(idx);
          const charDisplay = isUpperCase ? letter.char.toUpperCase() : letter.char.toLowerCase();
          const charCount = letter.char.length;
          const baseUnit = isUpperCase ? 2.5 : 2;
          const widthStyle = { width: `${charCount * baseUnit}rem`, minWidth: `${charCount * baseUnit}rem` };
          const textSizeClass = isUpperCase ? 'text-3xl md:text-5xl' : 'text-2xl md:text-4xl';
          let stateClass = "bg-white text-slate-300 border-slate-200";
          if (isPlayingSound) stateClass = "bg-blue-50 text-blue-600 border-blue-400 transform -translate-y-1 shadow-md z-10 ring-2 ring-blue-200";
          else if (isTarget) stateClass = "bg-white text-slate-700 border-slate-300 cursor-pointer hover:bg-slate-50";
          else if (isDone) stateClass = "bg-green-50 text-green-700 border-green-200 opacity-90";
          else if (isInfluencer) stateClass = "bg-yellow-50 text-orange-600 border-yellow-200 shadow ring-1 ring-yellow-200 z-10";
          return (
            <div key={`${isUpperCase ? 'U' : 'L'}-${idx}`} ref={isUpperCase ? (el) => { letterRefs.current[idx] = el } : undefined} onClick={() => handleLetterClick(letter, idx)} className={`relative flex items-center justify-center font-sans font-bold rounded-lg transition-all duration-200 border-b-2 mx-0.5 flex-shrink-0 h-16 md:h-24 ${textSizeClass} ${stateClass}`} style={widthStyle}>
              {isUpperCase && isTarget && (<div className="absolute -top-10 left-1/2 -translate-x-[150%] text-3xl animate-bounce z-50 pointer-events-none filter drop-shadow-sm w-12 text-center">👇</div>)}
              <span className="mb-1">{charDisplay}</span>
              {isUpperCase && isInfluencer && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-200 text-yellow-900 text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm font-sans font-bold z-20">Påverkar!</div>)}
            </div>
          );
        })}
    </div>
  )};

  const lettersWithRules = wordData.letters.map((l, i) => ({...l, idx: i})).filter(l => l.pronunciationRule && l.pronunciationRule.trim() !== "");
  const readyToRead = progressIndex >= wordData.letters.length && !wordComplete;
  const isBigAvatar = (isPlaying || avatarSpeaking || globalAvatarTalking) && playingIndex === null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-2 relative mt-2">
      <div className="w-full flex justify-between items-end mb-2 h-20 md:h-0 relative">
          <div className="flex-1 text-lg font-bold text-slate-500 h-8 flex items-center justify-center md:justify-start pl-0 md:pl-4">
            {wordComplete 
              ? <span className="text-green-600 animate-bounce block text-xl">Snyggt! 🎉</span> 
              : readyToRead
                ? <span className="text-blue-600 block text-xl animate-pulse">Läs ordet 👇</span>
                : <span className="flex items-center gap-2">Tryck på: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono text-xl">{wordData.letters[progressIndex]?.char.toUpperCase()} {wordData.letters[progressIndex]?.char.toLowerCase()}</span></span>
            }
          </div>
          <div className={isBigAvatar ? "fixed top-10 left-1/2 transform -translate-x-1/2 w-[50vh] h-[50vh] z-[100] transition-all duration-1000 ease-in-out filter drop-shadow-2xl" : "absolute right-0 bottom-2 w-20 h-24 md:w-28 md:h-32 z-30 transition-all duration-1000 ease-in-out"}>
             <Avatar isTalking={avatarSpeaking || globalAvatarTalking} visemeId={activeVisemeId} className="w-full h-full" />
          </div>
      </div>
      {wordData.emoji && wordComplete && (<div className="animate-bounce-in text-6xl md:text-8xl mb-4 filter drop-shadow-lg transition-all duration-1000 ease-out">{wordData.emoji}</div>)}
      <div className={`flex flex-col gap-4 w-full items-center bg-white p-3 md:p-6 rounded-2xl border border-slate-100 shadow-md max-w-full overflow-hidden z-20 relative transition-all duration-1000 ease-in-out ${isBigAvatar ? 'translate-y-[25vh]' : ''}`}>
        <div className="w-full relative bg-blue-50/30 rounded-xl p-2 border border-blue-50 overflow-hidden"><div className="absolute top-0 left-2 z-20"><span className="text-blue-300 text-[9px] font-bold uppercase tracking-widest">Versaler</span></div>{renderRow(true)}</div>
        <div className="w-full relative bg-purple-50/30 rounded-xl p-2 border border-purple-50 overflow-hidden"><div className="absolute top-0 left-2 z-20"><span className="text-purple-300 text-[9px] font-bold uppercase tracking-widest">Gemener</span></div>{renderRow(false)}</div>
      </div>
      {lettersWithRules.length > 0 && (
          <div className="mt-4 w-full max-w-2xl"><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{lettersWithRules.map((l, i) => (<button key={i} onMouseEnter={() => handleRuleClick([l.idx, ...(l.influencers || [])])} onClick={() => handleRuleClick([l.idx, ...(l.influencers || [])])} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:bg-yellow-50 text-left shadow-sm"><span className="bg-slate-100 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded text-xs">{l.char}</span><span className="text-xs text-slate-600 leading-snug">{l.pronunciationRule}</span></button>))}</div></div>
      )}
      <div className="mt-6 h-16 flex items-center justify-center gap-3">
        {readyToRead && !wordComplete && !isPlaying && (<button onClick={handleReadWord} disabled={isPlaying} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-lg bg-green-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all">🗣️ Läs ordet</button>)}
        {wordComplete && (
            <>
                <button onClick={handleListenRepetition} disabled={isPlaying} className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100">{isPlaying ? '...' : '🔊 Lyssna'}</button>
                {onNext && (<button onClick={onNext} className="animate-pulse flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg bg-purple-600 text-white shadow-lg hover:scale-105 transition-all">Nästa ➜</button>)}
            </>
        )}
      </div>
    </div>
  );
};

export default WordViewer;
