
// A collection of 50 distinct mouth shapes (paths) for the Avatar.
// Each path assumes a 100x110 viewbox context, centered around y=82.
// Ranges from closed/neutral to wide open, with variations for teeth and tongue.

export const VISEMES: string[] = [
  // 0-9: Neutral / Closed / Slight Smile (Resting, M, P, B)
  "M 40 82 Q 50 84 60 82", // 0: Flat line
  "M 40 82 Q 50 85 60 82", // 1: Slight curve down
  "M 40 82 Q 50 80 60 82", // 2: Slight curve up (smile)
  "M 42 82 Q 50 83 58 82 M 42 82 Q 50 81 58 82", // 3: Pursed lips
  "M 38 82 Q 50 86 62 82", // 4: Wider neutral
  "M 40 82 Q 50 84 60 82 Q 50 80 40 82", // 5: Small almond
  "M 45 82 Q 50 83 55 82", // 6: Very small (oo)
  "M 35 80 Q 50 85 65 80", // 7: Smirk
  "M 40 82 L 60 82", // 8: Robot line
  "M 42 81 Q 50 85 58 81 Z", // 9: Tiny open

  // 10-19: Small Openings / Teeth (S, T, D, N, C, Z)
  "M 40 81 Q 50 85 60 81 Q 50 77 40 81 Z", // 10: Thin oval
  "M 38 80 Q 50 86 62 80 Q 50 78 38 80 Z", // 11: Wider thin oval
  "M 40 80 Q 50 85 60 80 Q 50 80 40 80 M 41 81 L 59 81", // 12: Teeth clench
  "M 38 80 Q 50 88 62 80 Q 50 79 38 80 M 42 81 L 58 81", // 13: Teeth visible top
  "M 40 81 Q 50 84 60 81 Q 50 81 40 81 M 42 84 Q 50 86 58 84", // 14: Bottom lip focus
  "M 38 80 L 62 80 L 60 83 L 40 83 Z", // 15: Boxy small
  "M 38 81 Q 50 75 62 81 Q 50 87 38 81 M 40 81 L 60 81", // 16: Grin with teeth
  "M 40 81 Q 50 85 60 81 Z M 45 81 L 55 81", // 17: Small teeth peek
  "M 35 80 Q 50 82 65 80 Q 50 78 35 80", // 18: Wide thin smile
  "M 40 80 Q 50 85 60 80 Z M 48 80 L 52 83", // 19: Tongue touch top

  // 20-29: Medium Open / Vowels (E, I, Ä, Ö)
  "M 38 80 Q 50 90 62 80 Q 50 75 38 80 Z", // 20: Medium oval (E)
  "M 35 78 Q 50 90 65 78 Q 50 70 35 78 Z", // 21: Wide oval (Ä)
  "M 40 80 Q 50 90 60 80 Q 50 78 40 80 Z", // 22: Tall oval (I)
  "M 35 80 Q 50 92 65 80 Q 50 80 35 80 Z M 38 81 L 62 81", // 23: Wide with top teeth (A/E)
  "M 38 80 Q 50 95 62 80 Q 50 75 38 80 Z", // 24: Taller oval
  "M 42 80 Q 50 90 58 80 Q 50 75 42 80 Z", // 25: Narrow tall (U/Y)
  "M 35 78 Q 50 85 65 78 Q 50 70 35 78 Z M 40 85 Q 50 80 60 85", // 26: Tongue bottom
  "M 38 80 Q 50 92 62 80 Q 50 78 38 80 Z M 40 81 L 60 81 M 42 90 Q 50 85 58 90", // 27: Teeth and tongue
  "M 35 75 L 65 75 L 60 88 L 40 88 Z", // 28: Trapezoid open
  "M 38 80 Q 50 70 62 80 Q 50 95 38 80", // 29: Inverted curve

  // 30-39: Large Open / Round (A, O, Å, U)
  "M 35 75 Q 50 100 65 75 Q 50 65 35 75 Z", // 30: Big A
  "M 40 75 Q 50 100 60 75 Q 50 65 40 75 Z", // 31: Tall O
  "M 42 78 Q 50 95 58 78 Q 50 70 42 78 Z", // 32: Tight O (U/O)
  "M 35 75 Q 50 105 65 75 Q 50 70 35 75 Z", // 33: Deep A
  "M 30 78 Q 50 95 70 78 Q 50 70 30 78 Z", // 34: Wide A
  "M 44 78 Q 50 90 56 78 Q 50 72 44 78 Z", // 35: Small whistle O
  "M 38 75 Q 50 100 62 75 Q 50 75 38 75 Z M 42 98 Q 50 90 58 98", // 36: Big open with tongue
  "M 35 78 Q 50 100 65 78 Q 50 68 35 78 Z M 38 79 L 62 79", // 37: Big open with teeth
  "M 40 75 A 10 12 0 0 0 60 75 A 10 12 0 0 0 40 75", // 38: Perfect Circle O
  "M 35 75 Q 25 85 35 95 Q 50 100 65 95 Q 75 85 65 75 Q 50 70 35 75", // 39: Blobby open

  // 40-49: Special / Expressive / F / V / R
  "M 38 80 Q 50 85 62 80 M 42 84 Q 50 88 58 84", // 40: F/V (Top teeth on bottom lip)
  "M 40 81 Q 50 88 60 81 M 42 82 L 58 82", // 41: Biting lip
  "M 35 80 Q 50 75 65 80 Q 50 85 35 80 Z", // 42: Wide smirk
  "M 38 78 Q 50 82 62 78 Q 60 90 50 90 Q 40 90 38 78", // 43: Droopy open
  "M 45 80 Q 50 75 55 80 Q 50 95 45 80", // 44: Small vertical slit
  "M 30 82 Q 50 75 70 82 Q 50 100 30 82", // 45: Wide grin open
  "M 35 80 L 45 75 L 55 75 L 65 80 L 50 95 Z", // 46: Diamond
  "M 38 82 Q 50 90 62 82 M 50 82 L 50 88", // 47: Tongue out center
  "M 38 82 Q 50 80 62 82 M 40 82 Q 50 95 60 82", // 48: Happy shout
  "M 35 82 Q 50 82 65 82", // 49: Straight line
];

// Heuristics for default assignments
export const getDefaultVisemeForSound = (id: string, char: string): number => {
    const c = char.toLowerCase();
    if (['a', 'ä'].includes(c)) return 30;
    if (['o', 'å'].includes(c)) return 31;
    if (['u', 'y'].includes(c)) return 32;
    if (['e', 'i', 'ö'].includes(c)) return 20;
    if (['m', 'p', 'b'].includes(c)) return 0;
    if (['f', 'v'].includes(c)) return 40;
    if (['s', 'z', 'c'].includes(c)) return 12;
    if (['l', 'n', 't', 'd'].includes(c)) return 13;
    if (['r'].includes(c)) return 19;
    if (['j', 'g', 'k'].includes(c)) return 24;
    return 4; // Generic neutral
};
