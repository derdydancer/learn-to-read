import { LetterData, AnalyzedWord } from '../types';
import { getSoundIdForLetter, ALL_SOUNDS, SPECIALS } from './soundDefinitions';

const VOWELS = ['a', 'o', 'u', 'å', 'e', 'i', 'y', 'ä', 'ö'];

/**
 * Smart parser for Swedish text.
 * Detects vowels, consonants, and common digraphs (sj, tj, ng, etc.)
 * Assigns default Sound IDs to help manual word creation.
 */
export const analyzeWord = (text: string): AnalyzedWord => {
  const lowerText = text.toLowerCase();
  const letters: LetterData[] = [];
  const chars = lowerText.split('');

  let i = 0;
  while (i < chars.length) {
    const char = chars[i];
    
    // 1. Handle Separators
    if (char === ' ' || char === '.' || char === '!' || char === '?') {
        letters.push({
            char: char,
            originalIndex: i,
            soundCategory: 'separator',
            influencers: [],
            isSilent: true,
            soundId: undefined
        });
        i++;
        continue;
    }

    // 2. Look ahead for Digraphs/Special sounds
    // We check if the next 1 or 2 characters combine with current to form a known special sound
    
    // Check 3-char sequences first (if any exist in definitions, e.g. skj)
    if (i + 2 < chars.length) {
        const threeChars = char + chars[i+1] + chars[i+2];
        const special = SPECIALS.find(s => s.char === threeChars);
        if (special) {
            letters.push(createLetterData(threeChars, i, 'digraph', special.id, special.label));
            i += 3;
            continue;
        }
    }

    // Check 2-char sequences (sj, tj, ng, tt, ll...)
    if (i + 1 < chars.length) {
        const twoChars = char + chars[i+1];
        
        // Check explicit specials (sj, ng...)
        const special = SPECIALS.find(s => s.char === twoChars);
        if (special) {
            letters.push(createLetterData(twoChars, i, 'digraph', special.id, special.label));
            i += 2;
            continue;
        }

        // Check double consonants (tt, ss, mm) -> treat as one sound block
        if (char === chars[i+1] && !VOWELS.includes(char)) {
             // Find the sound ID for the single char, but store as double char
             const soundId = getSoundIdForLetter(char);
             letters.push(createLetterData(twoChars, i, 'consonant', soundId, 'Dubbelteckning'));
             i += 2;
             continue;
        }
    }

    // 3. Single Character
    const isVowel = VOWELS.includes(char);
    let soundId = getSoundIdForLetter(char);
    let vowelDuration: 'long' | 'short' | undefined = undefined;

    // Simple heuristic for default vowel length
    if (isVowel) {
        // Look ahead: if followed by 2 consonants (or double consonant), usually short.
        // This is a rough guess for the editor defaults.
        let consCount = 0;
        for(let j = 1; j <= 2; j++) {
            if (i + j < chars.length) {
                const next = chars[i+j];
                if (!VOWELS.includes(next) && next !== ' ') consCount++;
            }
        }
        
        vowelDuration = consCount >= 2 ? 'short' : 'long';
        // Re-fetch sound ID with duration preference
        soundId = getSoundIdForLetter(char, undefined, vowelDuration);
    }

    letters.push({
      char: text[i], 
      originalIndex: i,
      soundCategory: isVowel ? 'vowel' : 'consonant',
      influencers: [],
      isSilent: false,
      soundId: soundId,
      vowelDuration: vowelDuration
    });

    i++;
  }

  return {
    id: crypto.randomUUID(),
    text,
    letters,
    emoji: '' // Default to empty emoji for manual words
  };
};

const createLetterData = (char: string, index: number, cat: any, id?: string, rule?: string): LetterData => ({
    char,
    originalIndex: index,
    soundCategory: cat,
    influencers: [],
    isSilent: false,
    soundId: id,
    pronunciationRule: rule
});