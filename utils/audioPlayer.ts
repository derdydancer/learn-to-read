
import { speakLetter as ttsSpeakLetter, speakText as ttsSpeakText } from './tts';
import { getRecording } from './audioStorage';
import { getSoundIdForLetter } from './soundDefinitions';
import { AnalyzedWord, LetterData } from '../types';

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let amplitudeListeners: ((level: number) => void)[] = [];
let animationFrameId: number | null = null;
let activeSources: AudioBufferSourceNode[] = [];

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Setup Analyser for Lip Sync
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512; 
    analyser.smoothingTimeConstant = 0.5; // Smoother transitions
    
    startAmplitudeLoop();
  }
  return audioContext;
};

// Stops all currently playing sounds
export const stopAudio = () => {
    activeSources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    activeSources = [];
    if(typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

// Helper to check if we are playing real audio (vs TTS)
export const isPlayingAudioContext = () => activeSources.length > 0;

// Internal loop to broadcast volume levels
const startAmplitudeLoop = () => {
    if (animationFrameId) return;

    const loop = () => {
        if (analyser && amplitudeListeners.length > 0) {
            const bufferLength = analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            
            // Get data
            analyser.getByteTimeDomainData(dataArray);

            // Calculate RMS (Root Mean Square) for volume
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
                const x = (dataArray[i] - 128) / 128.0;
                sum += x * x;
            }
            const rms = Math.sqrt(sum / bufferLength);
            
            amplitudeListeners.forEach(cb => cb(rms));
        }
        animationFrameId = requestAnimationFrame(loop);
    };
    loop();
};

export const registerAmplitudeListener = (callback: (level: number) => void) => {
    amplitudeListeners.push(callback);
    return () => {
        amplitudeListeners = amplitudeListeners.filter(cb => cb !== callback);
    };
};

export const playSound = async (char: string, phoneme?: string, vowelDuration?: 'long'|'short', soundId?: string, preferTTS = false) => {
  if (char === ' ' || char === '.' || char === '!' || char === '?') return;

  if (preferTTS) {
    ttsSpeakLetter(char, phoneme);
    return;
  }

  let targetId = soundId;
  if (!targetId) {
    targetId = getSoundIdForLetter(char, phoneme, vowelDuration);
  }
  
  if (targetId) {
    try {
      const blob = await getRecording(targetId);
      if (blob) {
        const ctx = getAudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        // Direct playback without trimming to ensure sound isn't lost
        playBuffer(audioBuffer, ctx);
        return;
      }
    } catch (e) {
      // Quietly fail to TTS
    }
  }

  ttsSpeakLetter(char, phoneme);
};

export const playBlob = async (blob: Blob, when: number = 0): Promise<number> => {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return playBuffer(audioBuffer, ctx, when);
};

export const playCustomWordRecording = async (recordingId: string): Promise<void> => {
    try {
        const blob = await getRecording(recordingId);
        if (blob) {
            await playBlob(blob);
        }
    } catch (e) {
        console.error("Failed to play custom recording", e);
    }
};

const playBuffer = (buffer: AudioBuffer, ctx: AudioContext, when: number = 0): number => {
    // Force Resume
    if (ctx.state === 'suspended') {
        ctx.resume().catch(e => console.error("Audio resume failed", e));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // CRITICAL: Connect to Destination FIRST (Speakers)
    source.connect(ctx.destination);
    
    // Connect to Analyser separately for visuals (if fails, audio still works)
    if (analyser) {
        try {
            source.connect(analyser);
        } catch(e) { console.error("Analyser connect failed", e); }
    }
    
    activeSources.push(source);
    source.onended = () => {
        activeSources = activeSources.filter(s => s !== source);
    };
    
    const startTime = when > ctx.currentTime ? when : ctx.currentTime;
    source.start(startTime);
    return startTime + buffer.duration;
}

export interface PlaybackTiming {
    index: number;
    startTime: number;
    duration: number;
}

export const playWordSequence = async (word: AnalyzedWord, forceStitched: boolean = false): Promise<PlaybackTiming[]> => {
  const ctx = getAudioContext();
  
  let customBuffer: AudioBuffer | null = null;
  if (!forceStitched && word.customRecordingId) {
      try {
          const blob = await getRecording(word.customRecordingId);
          if (blob) {
              const ab = await blob.arrayBuffer();
              customBuffer = await ctx.decodeAudioData(ab);
          }
      } catch (e) {
          console.error("Failed to load custom word recording", e);
      }
  }

  // Gather buffers
  const audioQueue: { buffer: AudioBuffer | null; letter: LetterData; index: number; estimatedDuration: number }[] = [];
  let totalStitchedDuration = 0;
  
  for (let i = 0; i < word.letters.length; i++) {
     const letter = word.letters[i];
     if (letter.soundCategory === 'separator') {
         audioQueue.push({ buffer: null, letter, index: i, estimatedDuration: 0.4 });
         totalStitchedDuration += 0.4;
         continue;
     }
     if (letter.isSilent) continue; 
     
     let targetId = letter.soundId || getSoundIdForLetter(letter.char, letter.phoneme, letter.vowelDuration);

     let buffer: AudioBuffer | null = null;
     let duration = 0.3; 

     if (targetId) {
        const blob = await getRecording(targetId);
        if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            buffer = await ctx.decodeAudioData(arrayBuffer);
            duration = buffer.duration;
        }
     }
     
     const overlap = 0.02; 
     const effectiveDuration = Math.max(0.1, duration - overlap);
     
     audioQueue.push({ buffer, letter, index: i, estimatedDuration: effectiveDuration });
     totalStitchedDuration += effectiveDuration;
  }

  const timings: PlaybackTiming[] = [];
  const startTime = ctx.currentTime + 0.1;

  if (customBuffer) {
      playBuffer(customBuffer, ctx, startTime);
      const ratio = customBuffer.duration / (totalStitchedDuration || 1);
      
      let currentRelTime = 0;
      for (const item of audioQueue) {
          const scaledDuration = item.estimatedDuration * ratio;
          timings.push({
              index: item.index,
              startTime: startTime + currentRelTime,
              duration: scaledDuration
          });
          currentRelTime += scaledDuration;
      }
  } else {
      let nextStartTime = startTime;
      for (const item of audioQueue) {
          if (item.letter.soundCategory === 'separator') {
              timings.push({ index: item.index, startTime: nextStartTime, duration: 0.4 });
              nextStartTime += 0.4;
              continue;
          }

          if (item.buffer) {
            playBuffer(item.buffer, ctx, nextStartTime);
            timings.push({ index: item.index, startTime: nextStartTime, duration: item.buffer.duration });
            const overlap = 0.02; 
            nextStartTime += Math.max(0, item.buffer.duration - overlap); 
          } else {
               timings.push({ index: item.index, startTime: nextStartTime, duration: 0.3 });
              nextStartTime += 0.3;
          }
      }
  }

  return timings;
};
