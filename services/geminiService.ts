
import { GoogleGenAI, Type } from "@google/genai";
import { AnalyzedWord } from "../types";
import { analyzeWord as fallbackAnalyze } from "../utils/phonics";
import { getSoundListForPrompt } from "../utils/soundDefinitions";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateWordList = async (count: number = 5, complexity: 'simple' | 'medium' = 'simple', excludeWords: string[] = []): Promise<AnalyzedWord[]> => {
  // Fix: Use 'gemini-3-flash-preview' for text tasks as per guidelines.
  const model = 'gemini-3-flash-preview';
  
  const soundList = getSoundListForPrompt();

  const prompt = `
    Du är en expertpedagog inom svensk läsinlärning för barn.
    Uppgift: Generera ${count} olika svenska ord eller korta meningar som passar barn som lär sig läsa.
    Svårighetsgrad: ${complexity}.
    
    EXKLUDERINGS-LISTA: Generera INTE dessa ord/meningar: ${excludeWords.join(", ")}.
    
    VIKTIGT OM LJUDANALYS:
    Du MÅSTE bryta ner varje ord i bokstäver eller bokstavsgrupper (digrafer) som bildar ett ljud.
    
    Här är listan på ALLA tillgängliga ljud du får välja mellan:
    ${soundList}
    
    INSTRUKTIONER:
    1. GRUPPERING AV LJUD (VIKTIGT): 
       - Om flera bokstäver bildar ett gemensamt ljud (t.ex. "sj", "sk", "tj", "ng", "tt", "ll"), SKA de ligga i SAMMA objekt i listan 'letters'.
       - Exempel "Sju": 
          { char: "sj", soundId: "sp1", ... }, 
          { char: "u", soundId: "v_u_long", ... }
       - Exempel "Katt":
          { char: "k", soundId: "c7", ... },
          { char: "a", soundId: "v_a_short", ... },
          { char: "tt", soundId: "c15", ... } (Dubbelteckning grupperas)
    
    2. För VOKALER (a, o, u, å, e, i, y, ä, ö): Du måste välja om ljudet är långt (t.ex. v_a_long) eller kort (t.ex. v_a_short).
    
    3. För KONSONANTER: Välj rätt ID.
       - Var noga med "G" och "K" (hårda vs mjuka).
    
    4. MENINGAR: Mellanslag ska markeras som soundCategory='separator'.
    
    5. pronunciationRule: 
       - Ange ENDAST en förklaring om uttalet skiljer sig från bokstavens normala/vanligaste ljud eller om det är en speciell regel (t.ex. mjukt K, digrafer som 'sj').
       - Om bokstaven låter exakt som den brukar (t.ex. 's' i 'sol', 'm' i 'mat'), LÄMNA TOMT sträng ("").

    6. EMOJI:
       - Generera en passande emoji som representerar ordet visuellt.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    emoji: { type: Type.STRING, description: "En emoji som representerar ordet" },
                    letters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                char: { type: Type.STRING, description: "Bokstav eller bokstavsgrupp (t.ex. 's', 'sj', 'tt')" },
                                soundCategory: { type: Type.STRING, enum: ['vowel', 'consonant', 'digraph', 'separator'] },
                                soundId: { type: Type.STRING, description: "MÅSTE vara ett ID från listan." },
                                pronunciationRule: { type: Type.STRING, description: "Kort förklaring på svenska, endast vid undantag/regler." },
                                influencers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                                isSilent: { type: Type.BOOLEAN }
                            },
                            required: ['char', 'soundCategory', 'soundId']
                        }
                    }
                },
                required: ['text', 'letters']
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");

    const data = JSON.parse(jsonText);
    
    const processed: AnalyzedWord[] = data.words.map((w: any) => ({
        id: crypto.randomUUID(),
        text: w.text,
        emoji: w.emoji,
        letters: w.letters.map((l: any, idx: number) => ({
            ...l,
            originalIndex: idx, 
            influencers: l.influencers || [],
            isSilent: !!l.isSilent
        }))
    }));

    return processed;

  } catch (error) {
    console.error("Gemini API Error:", error);
    const listToUse = ["hej"];
    return listToUse.map(w => fallbackAnalyze(w));
  }
};
