

// Shared definitions for sound IDs to ensure mapping consistency between
// the recording UI and the word playback engine.

export interface SoundItem {
  id: string;
  label: string;
  char: string; // The primary character to match
  phoneme?: string; // IPA or specific phoneme representation from analysis
  example: string;
  variant?: 'long' | 'short'; // Metadata for UI
}

// Split vowels into Long (ending in vowel or single consonant) and Short (before double consonant)
export const VOWELS: SoundItem[] = [
  // A
  { id: 'v_a_long', label: 'A (Lång)', char: 'a', variant: 'long', example: 'Apa, Glas' },
  { id: 'v_a_short', label: 'A (Kort)', char: 'a', variant: 'short', example: 'Katt, Hand' },
  // O
  { id: 'v_o_long', label: 'O (Lång)', char: 'o', variant: 'long', example: 'Sol, Oas' },
  { id: 'v_o_short', label: 'O (Kort)', char: 'o', variant: 'short', example: 'Ostadig, Boll' }, 
  // U
  { id: 'v_u_long', label: 'U (Lång)', char: 'u', variant: 'long', example: 'Hus, Mus' },
  { id: 'v_u_short', label: 'U (Kort)', char: 'u', variant: 'short', example: 'Buss, Hund' },
  // Å
  { id: 'v_aa_long', label: 'Å (Lång)', char: 'å', variant: 'long', example: 'Åka, Tå' },
  { id: 'v_aa_short', label: 'Å (Kort)', char: 'å', variant: 'short', example: 'Åtta, Gåva' },
  // E
  { id: 'v_e_long', label: 'E (Lång)', char: 'e', variant: 'long', example: 'Ek, Se' },
  { id: 'v_e_short', label: 'E (Kort)', char: 'e', variant: 'short', example: 'Fest, Penna' },
  // I
  { id: 'v_i_long', label: 'I (Lång)', char: 'i', variant: 'long', example: 'Is, Bil' },
  { id: 'v_i_short', label: 'I (Kort)', char: 'i', variant: 'short', example: 'Sill, Vinte' },
  // Y
  { id: 'v_y_long', label: 'Y (Lång)', char: 'y', variant: 'long', example: 'Yta, Syl' },
  { id: 'v_y_short', label: 'Y (Kort)', char: 'y', variant: 'short', example: 'Hylla, Mygg' },
  // Ä
  { id: 'v_ae_long', label: 'Ä (Lång)', char: 'ä', variant: 'long', example: 'Äta, Säker' },
  { id: 'v_ae_short', label: 'Ä (Kort)', char: 'ä', variant: 'short', example: 'Äpple, Bäst' },
  // Ö
  { id: 'v_oe_long', label: 'Ö (Lång)', char: 'ö', variant: 'long', example: 'Öga, Snö' },
  { id: 'v_oe_short', label: 'Ö (Kort)', char: 'ö', variant: 'short', example: 'Öppna, Höst' },
];

export const CONSONANTS: SoundItem[] = [
  { id: 'c1', label: 'B', char: 'b', example: 'Boll' }, 
  { id: 'c_c', label: 'C (k-ljud)', char: 'c', phoneme: 'k', example: 'Clown' },
  { id: 'c2', label: 'D', char: 'd', example: 'Dörr' }, 
  { id: 'c3', label: 'F', char: 'f', example: 'Fisk' }, 
  { id: 'c4', label: 'G (Hårt)', char: 'g', phoneme: 'g', example: 'Gata' },
  { id: 'c5', label: 'H', char: 'h', example: 'Hus' },
  { id: 'c6', label: 'J', char: 'j', example: 'Jord' }, 
  { id: 'c7', label: 'K (Hårt)', char: 'k', phoneme: 'k', example: 'Katt' },
  { id: 'c8', label: 'L', char: 'l', example: 'Lampa' }, 
  { id: 'c9', label: 'M', char: 'm', example: 'Mamma' },
  { id: 'c10', label: 'N', char: 'n', example: 'Nos' },
  { id: 'c11', label: 'P', char: 'p', example: 'Pappa' },
  { id: 'c12', label: 'Q', char: 'q', example: 'Quiz' },
  { id: 'c13', label: 'R', char: 'r', example: 'Räv' },
  { id: 'c14', label: 'S', char: 's', example: 'Sol' }, 
  { id: 'c15', label: 'T', char: 't', example: 'Tak' },
  { id: 'c16', label: 'V', char: 'v', example: 'Vas' },
  { id: 'c17', label: 'W', char: 'w', example: 'Webb' },
  { id: 'c18', label: 'X', char: 'x', example: 'Xylofon' },
  { id: 'c19', label: 'Z', char: 'z', example: 'Zebra' },
];

export const SPECIALS: SoundItem[] = [
  { id: 'sp1', label: 'Sje-ljud (sj)', char: 'sj', phoneme: 'ɧ', example: 'Sju' }, 
  { id: 'sp2', label: 'Sje-ljud (sk)', char: 'sk', phoneme: 'ɧ', example: 'Sked' }, 
  { id: 'sp3', label: 'Tje-ljud (tj)', char: 'tj', phoneme: 'ɕ', example: 'Tjugo' }, 
  { id: 'sp4', label: 'Tje-ljud (kj)', char: 'kj', phoneme: 'ɕ', example: 'Kjol' },
  { id: 'sp5', label: 'Ng-ljud', char: 'ng', phoneme: 'ng', example: 'Ung' }, 
  { id: 'sp6', label: 'Mjukt G (/j/)', char: 'g', phoneme: 'j', example: 'Gick' },
  { id: 'sp7', label: 'Mjukt K (/ɕ/)', char: 'k', phoneme: 'ɕ', example: 'Kyla' },
  { id: 'sp8', label: 'Mjukt C (/s/)', char: 'c', phoneme: 's', example: 'Citron' },
];

export const INSTRUCTIONS: SoundItem[] = [
    { id: 'inst_start', label: 'Starta Träning', char: '', example: '"Du har startat träningen..."' },
    { id: 'inst_intro', label: 'Intro ord', char: '', example: '"Tryck på bokstäverna..."' },
    { id: 'inst_verify', label: 'Verifiera ord', char: '', example: '"Kunde du säga ordet?"' },
    { id: 'inst_choose_next', label: 'Välj nytt ord', char: '', example: '"Vill du välja ett nytt ord? Tryck på något av dessa..."' },
    { id: 'inst_prog_1', label: 'Klarat 1 ord', char: '', example: '"Bra jobbat! Du har klarat ett ord..."' },
    { id: 'inst_prog_2', label: 'Klarat 2 ord', char: '', example: '"Bra jobbat! Du har klarat två ord..."' },
    { id: 'inst_prog_3', label: 'Klarat 3 ord', char: '', example: '"Bra jobbat! Du har klarat tre ord..."' },
    { id: 'inst_prog_4', label: 'Klarat 4 ord', char: '', example: '"Bra jobbat! Du har klarat fyra ord..."' },
    { id: 'inst_prog_final', label: 'Klarat alla', char: '', example: '"Bra jobbat! Alla fem ord..."' },
];

export const ALL_SOUNDS = [...VOWELS, ...CONSONANTS, ...SPECIALS, ...INSTRUCTIONS];

/**
 * Helper to find the Recording ID based on a character, phoneme context, AND vowel duration.
 */
export const getSoundIdForLetter = (char: string, phoneme?: string, vowelDuration?: 'long' | 'short'): string | undefined => {
  const c = char.toLowerCase();
  
  // 1. Check for specific vowel variant (Long/Short)
  if (vowelDuration) {
      const vowelMatch = VOWELS.find(v => v.char === c && v.variant === vowelDuration);
      if (vowelMatch) return vowelMatch.id;
  }

  // 2. Try to match Exact Phoneme Special Cases
  if (phoneme) {
    const special = SPECIALS.find(s => s.phoneme === phoneme && (s.char === c || s.char.includes(c)));
    if (special) return special.id;

    const consonant = CONSONANTS.find(s => s.char === c && s.phoneme === phoneme);
    if (consonant) return consonant.id;
  }

  // 3. Fallback: If no duration specified but it is a vowel, default to long (usually clearer for learning letters)
  const genericVowel = VOWELS.find(v => v.char === c && v.variant === 'long');
  if (genericVowel) return genericVowel.id;

  // 4. Exact consonant match
  const exact = ALL_SOUNDS.find(s => s.char === c && !s.phoneme && !s.variant); 
  if (exact) return exact.id;

  // 5. Rough match
  const rough = ALL_SOUNDS.find(s => s.char === c);
  if (rough) return rough.id;

  return undefined;
};

/**
 * Generates a string list of all available sounds for the AI prompt.
 */
export const getSoundListForPrompt = (): string => {
    return ALL_SOUNDS.filter(s => !s.id.startsWith('inst_')).map(s => `- ID: "${s.id}" | Ljud: ${s.label} | Exempel: ${s.example}`).join('\n');
};