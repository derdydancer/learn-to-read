import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AnalyzedWord, LetterData } from './types';
import { generateWordList } from './services/geminiService';
import { analyzeWord } from './utils/phonics';
import { ALL_SOUNDS } from './utils/soundDefinitions';
import { saveRecording, getRecording, deleteRecording } from './utils/audioStorage';
import { playBlob, playWordSequence } from './utils/audioPlayer';
import WordViewer from './components/WordViewer';
import SoundTest from './components/SoundTest';

// Hardcoded initial words with GROUPED letters for special sounds
const INITIAL_WORDS: AnalyzedWord[] = [
    {
        id: 'init-1',
        text: 'katt',
        emoji: '🐱',
        letters: [
            { char: 'k', originalIndex: 0, soundCategory: 'consonant', soundId: 'c7', isSilent: false, influencers: [], pronunciationRule: 'Hårt K före hård vokal' },
            { char: 'a', originalIndex: 1, soundCategory: 'vowel', soundId: 'v_a_short', isSilent: false, influencers: [], pronunciationRule: 'Kort A före dubbelkonsonant' },
            { char: 'tt', originalIndex: 2, soundCategory: 'consonant', soundId: 'c15', isSilent: false, influencers: [], pronunciationRule: 'Dubbelteckning låter som ett ljud' }
        ]
    },
    {
        id: 'init-2',
        text: 'sju',
        emoji: '7️⃣',
        letters: [
            { char: 'sj', originalIndex: 0, soundCategory: 'digraph', soundId: 'sp1', isSilent: false, influencers: [], pronunciationRule: 'SJ bildar ett sje-ljud' },
            { char: 'u', originalIndex: 2, soundCategory: 'vowel', soundId: 'v_u_long', isSilent: false, influencers: [], pronunciationRule: '' }
        ]
    },
    {
        id: 'init-3',
        text: 'apa',
        emoji: '🐵',
        letters: [
            { char: 'a', originalIndex: 0, soundCategory: 'vowel', soundId: 'v_a_long', isSilent: false, influencers: [], pronunciationRule: 'Långt A i början' },
            { char: 'p', originalIndex: 1, soundCategory: 'consonant', soundId: 'c11', isSilent: false, influencers: [] },
            { char: 'a', originalIndex: 2, soundCategory: 'vowel', soundId: 'v_a_short', isSilent: false, influencers: [], pronunciationRule: 'Kort A i slutet' }
        ]
    }
];

const ExpertEditor: React.FC<{ words: AnalyzedWord[]; onSave: (words: AnalyzedWord[]) => void; onClose: () => void }> = ({ words, onSave, onClose }) => {
    const [localWords, setLocalWords] = useState<AnalyzedWord[]>(JSON.parse(JSON.stringify(words)));
    const [selectedId, setSelectedId] = useState<string>(localWords[0]?.id || '');
    const [newWordText, setNewWordText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [hasCustomAudio, setHasCustomAudio] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const currentWord = localWords.find(w => w.id === selectedId);

    // Check if current word has custom audio on load/select
    useEffect(() => {
        if(currentWord && currentWord.customRecordingId) {
             getRecording(currentWord.customRecordingId).then(blob => setHasCustomAudio(!!blob));
        } else {
            setHasCustomAudio(false);
        }
    }, [currentWord]);

    const handleUpdateLetter = (wordId: string, letterIndex: number, field: keyof LetterData, value: any) => {
        setLocalWords(prev => prev.map(w => {
            if (w.id !== wordId) return w;
            const newLetters = [...w.letters];
            newLetters[letterIndex] = { ...newLetters[letterIndex], [field]: value };
            return { ...w, letters: newLetters };
        }));
    };

    const handleDeleteWord = (id: string) => {
        if (confirm("Är du säker?")) {
            setLocalWords(prev => prev.filter(w => w.id !== id));
            if (selectedId === id) setSelectedId('');
        }
    };

    const handleAddWord = () => {
        if (!newWordText.trim()) return;
        // Use the smart analyzer to generate defaults
        const newWord = analyzeWord(newWordText.trim());
        setLocalWords(prev => [...prev, newWord]);
        setSelectedId(newWord.id);
        setNewWordText('');
    };

    const handleAddSoundBlock = (wordId: string) => {
        setLocalWords(prev => prev.map(w => {
            if (w.id !== wordId) return w;
            return {
                ...w,
                letters: [...w.letters, {
                    char: '?',
                    soundCategory: 'consonant',
                    originalIndex: w.letters.length,
                    influencers: [],
                    isSilent: false
                }]
            };
        }));
    };
    
    const handleRemoveSoundBlock = (wordId: string, idx: number) => {
         setLocalWords(prev => prev.map(w => {
            if (w.id !== wordId) return w;
            const newLetters = [...w.letters];
            newLetters.splice(idx, 1);
            return { ...w, letters: newLetters };
        }));
    };

    // --- Custom Recording Logic ---
    
    const startRecording = async () => {
        if (!currentWord) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
                // Save using word ID as the recording ID
                await saveRecording(currentWord.id, blob);
                setHasCustomAudio(true);
                
                // Update local word to point to this recording
                setLocalWords(prev => prev.map(w => w.id === currentWord.id ? {...w, customRecordingId: currentWord.id} : w));
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            alert("Kunde inte starta mikrofonen.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const playCustomRecording = async () => {
        if (!currentWord || !currentWord.customRecordingId) return;
        const blob = await getRecording(currentWord.customRecordingId);
        if (blob) playBlob(blob);
    };
    
    const playGenerated = async () => {
        if (!currentWord) return;
        // Force playWordSequence to ignore custom recording for this preview
        const tempWord = { ...currentWord, customRecordingId: undefined };
        await playWordSequence(tempWord);
    };

    const deleteCustomRecording = async () => {
        if (!currentWord || !currentWord.customRecordingId) return;
        if(confirm("Ta bort inspelning?")) {
            await deleteRecording(currentWord.customRecordingId);
            setHasCustomAudio(false);
            setLocalWords(prev => prev.map(w => w.id === currentWord.id ? {...w, customRecordingId: undefined} : w));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-700">⚙️ Expertredigerare</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: List */}
                    <div className="w-1/3 border-r bg-slate-50 flex flex-col">
                        <div className="p-4 border-b">
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Lägg till nytt ord</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 border rounded px-2 py-1 text-sm"
                                    placeholder="t.ex. banan"
                                    value={newWordText}
                                    onChange={e => setNewWordText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddWord()}
                                />
                                <button onClick={handleAddWord} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">+</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                             {localWords.map(w => (
                                 <div 
                                    key={w.id} 
                                    onClick={() => setSelectedId(w.id)}
                                    className={`p-3 mb-1 rounded cursor-pointer flex justify-between items-center group ${w.id === selectedId ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-white'}`}
                                 >
                                     <span className="font-medium">{w.text}</span>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.id); }}
                                        className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                     >🗑</button>
                                 </div>
                             ))}
                        </div>
                    </div>

                    {/* Right Panel: Detail Editor */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white">
                        {currentWord ? (
                            <div>
                                <div className="mb-6 border-b pb-6">
                                    <div className="flex justify-between items-end gap-4 mb-4">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold uppercase text-slate-400">Ordtext</label>
                                            <input 
                                                value={currentWord.text} 
                                                onChange={(e) => setLocalWords(prev => prev.map(w => w.id === currentWord.id ? {...w, text: e.target.value} : w))}
                                                className="text-3xl font-bold text-slate-800 border-b-2 border-slate-200 focus:border-blue-500 outline-none w-full bg-transparent" 
                                            />
                                        </div>
                                        <div className="w-20">
                                            <label className="text-xs font-bold uppercase text-slate-400">Emoji</label>
                                            <input 
                                                value={currentWord.emoji || ''} 
                                                onChange={(e) => setLocalWords(prev => prev.map(w => w.id === currentWord.id ? {...w, emoji: e.target.value} : w))}
                                                className="text-3xl font-bold text-slate-800 border-b-2 border-slate-200 focus:border-blue-500 outline-none w-full bg-transparent text-center" 
                                                placeholder="🙂"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Audio Recording Section */}
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                                        <div className="text-sm">
                                            <h4 className="font-bold text-blue-900">Manuellt Ljud (Hela ordet)</h4>
                                            <p className="text-blue-600 text-xs">Spela in hur ordet låter. Detta spelas upp istället för de ihopklippta bokstäverna.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={playGenerated} className="px-3 py-1 bg-white border rounded text-xs text-slate-600 hover:bg-slate-50">
                                                🔊 Lyssna (Genererat)
                                            </button>
                                            
                                            <button
                                                onMouseDown={startRecording}
                                                onMouseUp={stopRecording}
                                                onTouchStart={startRecording}
                                                onTouchEnd={stopRecording}
                                                className={`p-3 rounded-full transition-all active:scale-95 shadow-sm border ${isRecording ? 'bg-red-600 text-white border-red-700 scale-110' : 'bg-white text-red-500 border-red-100 hover:bg-red-50'}`}
                                            >
                                                {isRecording ? <div className="w-4 h-4 bg-white animate-pulse rounded-sm"/> : <div className="w-4 h-4 bg-red-500 rounded-full"/>}
                                            </button>

                                            {hasCustomAudio && (
                                                <>
                                                    <button onClick={playCustomRecording} className="p-3 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
                                                        ▶️
                                                    </button>
                                                    <button onClick={deleteCustomRecording} className="p-3 rounded-full bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50">
                                                        🗑
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                     <h4 className="text-sm font-bold uppercase text-slate-400">Ljudblock</h4>
                                     <button onClick={() => handleAddSoundBlock(currentWord.id)} className="text-sm text-blue-600 hover:underline">+ Lägg till ljudblock</button>
                                </div>

                                <div className="space-y-4">
                                    {currentWord.letters.map((letter, idx) => (
                                        <div key={idx} className="flex gap-4 items-start p-4 border rounded-xl bg-slate-50 relative group">
                                            <div className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-full absolute -left-4 top-4 text-xs font-bold text-slate-500">
                                                {idx + 1}
                                            </div>
                                            
                                            {/* Char Input */}
                                            <div className="flex flex-col w-20">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Bokstäver</label>
                                                <input 
                                                    value={letter.char} 
                                                    onChange={(e) => handleUpdateLetter(currentWord.id, idx, 'char', e.target.value)}
                                                    className="font-comic font-bold text-xl border rounded p-2 text-center"
                                                />
                                            </div>

                                            {/* Sound Selector */}
                                            <div className="flex flex-col flex-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Ljud (ID)</label>
                                                <select 
                                                    value={letter.soundId || ''} 
                                                    onChange={(e) => handleUpdateLetter(currentWord.id, idx, 'soundId', e.target.value)}
                                                    className="border rounded p-2 text-sm bg-white"
                                                >
                                                    <option value="">-- Välj ljud --</option>
                                                    {ALL_SOUNDS.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.label} ({s.id}) - ex: {s.example}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="mt-2 text-xs text-slate-500">
                                                    Kategori: 
                                                    <select 
                                                        value={letter.soundCategory}
                                                        onChange={(e) => handleUpdateLetter(currentWord.id, idx, 'soundCategory', e.target.value)}
                                                        className="ml-2 border rounded p-1 text-xs"
                                                    >
                                                        <option value="vowel">Vokal</option>
                                                        <option value="consonant">Konsonant</option>
                                                        <option value="digraph">Digraf/Grupp</option>
                                                        <option value="separator">Mellanslag/Tyst</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Rule Input */}
                                            <div className="flex flex-col flex-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Förklaring/Regel</label>
                                                <input 
                                                    value={letter.pronunciationRule || ''} 
                                                    onChange={(e) => handleUpdateLetter(currentWord.id, idx, 'pronunciationRule', e.target.value)}
                                                    placeholder="T.ex. Mjukt K..." 
                                                    className="border rounded p-2 text-sm w-full"
                                                />
                                            </div>

                                            <button 
                                                onClick={() => handleRemoveSoundBlock(currentWord.id, idx)}
                                                className="text-red-400 hover:text-red-600 p-2"
                                                title="Ta bort block"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Välj ett ord till vänster eller skapa ett nytt.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-3 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Avbryt</button>
                    <button onClick={() => { onSave(localWords); onClose(); }} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg">Spara Ändringar</button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [allWords, setAllWords] = useState<AnalyzedWord[]>(INITIAL_WORDS);
  const [currentWordId, setCurrentWordId] = useState<string>(INITIAL_WORDS[0].id);
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [mode, setMode] = useState<'words' | 'sentences'>('words');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [view, setView] = useState<'app' | 'test'>('app');
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [expertMode, setExpertMode] = useState(false);

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (apiKeyMissing) {
        alert("API Key missing. Using standard word list.");
        return;
    }
    setAppState(AppState.LOADING);
    try {
      const existingTexts = allWords.map(w => w.text);
      const newWords = await generateWordList(5, mode === 'words' ? 'simple' : 'medium', existingTexts);
      setAllWords(prev => [...prev, ...newWords]);
      if(newWords.length > 0) {
          setCurrentWordId(newWords[0].id);
      }
      setAppState(AppState.PLAYING);
    } catch (e) {
      console.error(e);
      setAppState(AppState.ERROR);
    }
  }, [mode, apiKeyMissing, allWords]);

  const handleWordComplete = () => {
      setCompletedWordIds(prev => new Set(prev).add(currentWordId));
  };

  const exportWords = () => {
      const blob = new Blob([JSON.stringify(allWords, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lasresan-ordlista-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const importWords = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const parsed = JSON.parse(ev.target?.result as string);
              if(Array.isArray(parsed)) {
                  setAllWords(prev => {
                      // Avoid duplicates based on ID
                      const existingIds = new Set(prev.map(w => w.id));
                      const uniqueNew = parsed.filter((w: AnalyzedWord) => !existingIds.has(w.id));
                      return [...prev, ...uniqueNew];
                  });
                  alert(`Importerade ${parsed.length} ord.`);
              } else {
                  alert("Ogiltigt format.");
              }
          } catch(err) {
              alert("Kunde inte läsa filen.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset
  }

  const currentWordData = allWords.find(w => w.id === currentWordId);
  const sortedWords = [...allWords].sort((a, b) => a.text.localeCompare(b.text, 'sv'));

  if (view === 'test') {
      return <SoundTest onClose={() => setView('app')} />;
  }

  return (
    <div className="min-h-screen bg-soft-blue flex flex-col font-sans h-screen overflow-hidden">
      
      {expertMode && (
          <ExpertEditor 
            words={allWords} 
            onSave={(newWords) => setAllWords(newWords)} 
            onClose={() => setExpertMode(false)} 
          />
      )}

      {/* Hidden Import Input */}
      <input type="file" id="import-words" className="hidden" accept=".json" onChange={importWords} />

      {/* Header */}
      <header className="w-full p-4 bg-white/90 backdrop-blur-sm border-b border-blue-100 flex justify-between items-center z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-md hidden sm:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-700 tracking-tight hidden xs:block">Läsresan</h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           <button 
              onClick={() => setView('test')}
              className="text-sm font-medium text-slate-500 hover:text-blue-600 px-3 py-1 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
           >
              🛠️ Testa ljud
           </button>
           
           {/* Expert Dropdown/Button */}
           <div className="relative group">
               <button className="text-sm font-medium text-slate-500 px-3 py-1 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-lg border border-slate-200 transition-colors">
                   ⚙️ Expert
               </button>
               <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 hidden group-hover:block z-50 overflow-hidden">
                   <button onClick={exportWords} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm">📥 Exportera Ordlista</button>
                   <button onClick={() => document.getElementById('import-words')?.click()} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm">📤 Importera Lista</button>
                   <div className="h-px bg-slate-100 my-1"></div>
                   <button onClick={() => setExpertMode(true)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-blue-600 font-bold">✏️ Redigera Ord</button>
               </div>
           </div>

           <div className="bg-slate-100 p-1 rounded-lg flex text-xs md:text-sm font-medium">
             <button 
               onClick={() => setMode('words')}
               className={`px-2 md:px-3 py-1.5 rounded-md transition-all ${mode === 'words' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Ord
             </button>
             <button 
               onClick={() => setMode('sentences')}
               className={`px-2 md:px-3 py-1.5 rounded-md transition-all ${mode === 'sentences' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Meningar
             </button>
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
          
          {/* Sidebar */}
          <aside className={`
            absolute md:relative z-40 h-full w-64 bg-white border-r border-slate-200 shadow-xl md:shadow-none transition-transform duration-300 transform 
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                 <h2 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Mina Ord ({sortedWords.length})</h2>
                 <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400">✕</button>
             </div>
             
             <div className="overflow-y-auto h-full pb-20 p-2 space-y-1">
                 {sortedWords.map(word => {
                     const isCompleted = completedWordIds.has(word.id);
                     const isSelected = word.id === currentWordId;
                     return (
                         <button 
                            key={word.id}
                            onClick={() => {
                                setCurrentWordId(word.id);
                                setSidebarOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors
                                ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}
                            `}
                         >
                             <span className={`font-comic font-medium truncate ${isCompleted ? 'text-green-700' : 'text-slate-400'}`}>
                                 {word.text}
                             </span>
                             {isCompleted && <span className="text-green-500 text-xs font-bold">✓</span>}
                         </button>
                     )
                 })}
             </div>
             
             {/* Generate Button in Sidebar for easy access */}
             <div className="absolute bottom-0 left-0 w-full p-4 bg-white/90 border-t backdrop-blur-sm">
                 <button 
                    onClick={handleGenerate}
                    disabled={appState === AppState.LOADING}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                 >
                     {appState === AppState.LOADING ? 'Laddar...' : '✨ Hämta nya'}
                 </button>
             </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-y-auto bg-soft-blue w-full">
            
            {/* Decorative BG */}
            <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob pointer-events-none"></div>
            <div className="absolute top-40 right-10 w-32 h-32 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-5xl z-10 flex flex-col items-center">
                
                {currentWordData ? (
                    <div className="w-full">
                        <div className="bg-white/50 backdrop-blur-md rounded-[3rem] shadow-2xl p-4 md:p-12 border border-white min-h-[500px] flex flex-col justify-center relative items-center">
                            <WordViewer 
                                wordData={currentWordData} 
                                onComplete={handleWordComplete}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-400">
                        Inga ord laddade.
                    </div>
                )}

            </div>
          </main>
      </div>
    </div>
  );
};

export default App;