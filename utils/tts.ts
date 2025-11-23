
/**
 * Speaks text using the browser's SpeechSynthesis API.
 * Optimized for Swedish phonetics and fallback handling.
 */

// Cache for voices
let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Loads and filters voices.
 */
const loadVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return voices;
};

// Initialize voices listeners
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Attempts to find the best available Swedish voice.
 * Prioritizes "Google Svenska" if available as it often has better phonetics.
 */
export const getSwedishVoice = (): SpeechSynthesisVoice | undefined => {
  const voices = cachedVoices.length > 0 ? cachedVoices : loadVoices();
  
  // 1. Specific Google Swedish voice (usually better quality on Chrome/Android)
  const googleVoice = voices.find(v => v.lang === 'sv-SE' && v.name.includes('Google'));
  if (googleVoice) return googleVoice;

  // 2. Any voice explicitly marked as Swedish (Sweden)
  const swedenVoice = voices.find(v => v.lang === 'sv-SE');
  if (swedenVoice) return swedenVoice;

  // 3. Fallback to any generic Swedish voice
  return voices.find(v => v.lang.startsWith('sv'));
};

const PHONEME_MAP: Record<string, string> = {
    'ɧ': 'sje', // Approximation for TTS
    'ɕ': 'tje', // Approximation for TTS
    'g': 'g',
    'j': 'j',
    'k': 'k',
    'ŋ': 'äng',
    '/gn/': 'gn',
    '/ŋn/': 'ngn'
};

export const speakText = (text: string, rate: number = 0.8, pitch: number = 1.0) => {
  if (!('speechSynthesis' in window)) return;

  // We explicitly DO NOT cancel here if we want to allow overlapping sounds or sequences,
  // but for a reading app, cancelling previous sound is usually better UI.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'sv-SE';
  utterance.rate = rate; 
  utterance.pitch = pitch; 

  const svVoice = getSwedishVoice();
  if (svVoice) {
    utterance.voice = svVoice;
  } else {
      // If no voice found yet, try one last check (race condition fix)
      const freshVoices = window.speechSynthesis.getVoices();
      const freshSv = freshVoices.find(v => v.lang.startsWith('sv'));
      if (freshSv) utterance.voice = freshSv;
  }

  window.speechSynthesis.speak(utterance);
};

/**
 * Speaks a single letter/phoneme.
 */
export const speakLetter = (letter: string, phonemeHint?: string) => {
    // Retry loading voices if empty (common Chrome issue on first load)
    if (cachedVoices.length === 0) {
        loadVoices();
    }

    // Determine what to actually speak
    let textToSpeak = letter.toLowerCase();

    if (phonemeHint) {
        // If we have a map for this IPA symbol, use it
        if (PHONEME_MAP[phonemeHint]) {
            textToSpeak = PHONEME_MAP[phonemeHint];
        } else {
            // Fallback: try to speak the hint, or just the letter
            textToSpeak = phonemeHint; // e.g. if hint is 'j' for 'g'
        }
    } else {
        // Hacks to make letters sound more like sounds (phonemes) than names
        // This is imperfect with standard TTS.
        switch (letter.toLowerCase()) {
            case 'r': textToSpeak = 'rr'; break;
            case 's': textToSpeak = 'ss'; break;
            case 'm': textToSpeak = 'mm'; break;
            case 'n': textToSpeak = 'nn'; break;
            case 'l': textToSpeak = 'll'; break;
            case 'f': textToSpeak = 'ff'; break;
            case 'a': textToSpeak = 'a'; break; // Short vowel often better
            // Add more tweaks as needed
        }
    }

    speakText(textToSpeak, 0.9, 1.0);
};
