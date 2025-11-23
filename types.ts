export interface LetterData {
  char: string;
  originalIndex: number; // Position in the original word string
  soundCategory: 'vowel' | 'consonant' | 'digraph' | 'separator';
  pronunciationRule?: string; // Description of the rule (e.g., "Soft K before soft vowel")
  influencers: number[]; // Indices of letters that affect this letter's sound
  isSilent: boolean;
  phoneme?: string; // IPA or approximate representation
  vowelDuration?: 'long' | 'short'; // Kept for reference
  soundId?: string; // The exact sound ID chosen by AI
}

export interface AnalyzedWord {
  id: string;
  text: string;
  emoji?: string;
  letters: LetterData[];
  customRecordingId?: string; // ID of a manual recording for the whole word
}

export interface ContentResponse {
  words: AnalyzedWord[];
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR',
}