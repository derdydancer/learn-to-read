import { speakLetter as ttsSpeakLetter, speakText as ttsSpeakText } from './tts';
import { getRecording } from './audioStorage';
import { getSoundIdForLetter } from './soundDefinitions';
import { AnalyzedWord, LetterData } from '../types';

let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Trims silence from the beginning and end of an AudioBuffer.
 */
const trimSilence = (buffer: AudioBuffer, ctx: AudioContext): AudioBuffer => {
  const channelData = buffer.getChannelData(0); // Analyze first channel
  const threshold = 0.02; // Silence threshold (0.0 to 1.0)

  let start = 0;
  let end = buffer.length;

  // Find start
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(channelData[i]) > threshold) {
      start = i;
      break;
    }
  }

  // Find end
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (Math.abs(channelData[i]) > threshold) {
      end = i + 1;
      break;
    }
  }
  
  const padding = Math.floor(buffer.sampleRate * 0.05);
  start = Math.max(0, start - padding);
  end = Math.min(buffer.length, end + padding);

  if (end <= start) return buffer;

  const newLength = end - start;
  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const oldData = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      newData[i] = oldData[start + i];
    }
  }

  return newBuffer;
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
        const trimmed = trimSilence(audioBuffer, ctx);
        playBuffer(trimmed, ctx);
        return;
      }
    } catch (e) {
      console.error("Failed to play recording", e);
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
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const startTime = when > ctx.currentTime ? when : ctx.currentTime;
    source.start(startTime);
    return startTime + buffer.duration;
}

export interface PlaybackTiming {
    index: number;
    startTime: number;
    duration: number;
}

/**
 * "Stitches" the word together by playing recorded sounds in sequence.
 * Returns timing information for animation synchronization.
 * 
 * @param word The word to play
 * @param forceStitched If true, ignores custom recording and plays phonetic stitch (used for ball animation)
 */
export const playWordSequence = async (word: AnalyzedWord, forceStitched: boolean = false): Promise<PlaybackTiming[]> => {
  const ctx = getAudioContext();
  
  // Check for custom whole-word recording (unless forced to stitch)
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

  // 1. Gather all required audio buffers for letters (needed for timing regardless of custom audio)
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
     
     let targetId = letter.soundId;
     if (!targetId) {
        targetId = getSoundIdForLetter(letter.char, letter.phoneme, letter.vowelDuration);
     }

     let buffer: AudioBuffer | null = null;
     let duration = 0.3; // Fallback duration

     if (targetId) {
        const blob = await getRecording(targetId);
        if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const rawBuffer = await ctx.decodeAudioData(arrayBuffer);
            buffer = trimSilence(rawBuffer, ctx);
            duration = buffer.duration;
        }
     }
     
     // Reduce duration slightly for overlap calculation simulation
     const overlap = 0.02; 
     const effectiveDuration = Math.max(0.1, duration - overlap);
     
     audioQueue.push({ buffer, letter, index: i, estimatedDuration: effectiveDuration });
     totalStitchedDuration += effectiveDuration;
  }

  const timings: PlaybackTiming[] = [];
  const startTime = ctx.currentTime + 0.1;

  if (customBuffer) {
      // --- PLAY CUSTOM RECORDING ---
      playBuffer(customBuffer, ctx, startTime);

      // --- CALCULATE SCALED TIMINGS ---
      // We map the theoretical stitched duration to the actual custom duration
      // to make the ball bounce in sync with the custom audio speed.
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
      // --- PLAY STITCHED SEQUENCE ---
      let nextStartTime = startTime;
      
      for (const item of audioQueue) {
          if (item.letter.soundCategory === 'separator') {
              timings.push({
                  index: item.index,
                  startTime: nextStartTime,
                  duration: 0.4
              });
              nextStartTime += 0.4;
              continue;
          }

          if (item.buffer) {
            playBuffer(item.buffer, ctx, nextStartTime);
            
            timings.push({
                index: item.index,
                startTime: nextStartTime,
                duration: item.buffer.duration
            });

            const overlap = 0.02; 
            nextStartTime += Math.max(0, item.buffer.duration - overlap); 
          } else {
              // Missing recording fallback (simulate time)
               timings.push({
                  index: item.index,
                  startTime: nextStartTime,
                  duration: 0.3
              });
              nextStartTime += 0.3;
          }
      }
  }

  return timings;
};