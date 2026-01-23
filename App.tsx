
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AnalyzedWord, LetterData } from './types';
import { generateWordList } from './services/geminiService';
import { analyzeWord } from './utils/phonics';
import { ALL_SOUNDS } from './utils/soundDefinitions';
import { getDefaultVisemeForSound } from './utils/visemePaths';
import { saveRecording, getRecording, deleteRecording, exportFullBackup, importFullBackup, encodeWAV, saveVisemeConfig, getVisemeConfig, saveAppData, getAppData } from './utils/audioStorage';
import { playBlob, playWordSequence, getAudioContext } from './utils/audioPlayer';
import WordViewer from './components/WordViewer';
import SoundTest from './components/SoundTest';
import { Avatar } from './components/Avatar';

const trimAudioBuffer = (buffer: AudioBuffer, ctx: AudioContext): AudioBuffer => {
  const channelData = buffer.getChannelData(0);
  const threshold = 0.02; 
  let start = 0;
  let end = buffer.length;
  for (let i = 0; i < buffer.length; i++) { if (Math.abs(channelData[i]) > threshold) { start = i; break; } }
  for (let i = buffer.length - 1; i >= 0; i--) { if (Math.abs(channelData[i]) > threshold) { end = i + 1; break; } }
  const padding = Math.floor(buffer.sampleRate * 0.1);
  start = Math.max(0, start - padding);
  end = Math.min(buffer.length, end + padding);
  if (end <= start) return buffer;
  const newLength = end - start;
  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const old = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    for (let i = 0; i < newLength; i++) { newData[i] = old[start + i]; }
  }
  return newBuffer;
};

// Fix: Added missing PasscodeModal component for parent control.
const PasscodeModal: React.FC<{ onClose: () => void; onUnlock: () => void }> = ({ onClose, onUnlock }) => {
    const [code, setCode] = useState('');
    const handleCheck = () => {
        if (code === '1234') {
            onUnlock();
            onClose();
        } else {
            alert('Fel kod');
        }
    };
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Föräldrakontroll</h2>
                <p className="text-sm text-slate-500 mb-4">Ange lösenord för att ändra inställningar (Standard: 1234)</p>
                <input 
                    type="password" 
                    className="w-full border p-3 rounded-lg mb-4 text-center text-2xl tracking-widest" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 bg-slate-100 py-3 rounded-lg font-bold">Avbryt</button>
                    <button onClick={handleCheck} className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-bold">Lås upp</button>
                </div>
            </div>
        </div>
    );
};

// Fix: Added missing ExpertEditor component for direct word data manipulation.
const ExpertEditor: React.FC<{ words: AnalyzedWord[]; onSave: (words: AnalyzedWord[]) => void; onClose: () => void }> = ({ words, onSave, onClose }) => {
    const [json, setJson] = useState(JSON.stringify(words, null, 2));
    const handleSave = () => {
        try {
            const parsed = JSON.parse(json);
            onSave(parsed);
            onClose();
        } catch (e) {
            alert("Ogiltigt JSON-format");
        }
    };
    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Expert-editor (JSON)</h2>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg">Stäng</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold">Spara</button>
                </div>
            </div>
            <textarea 
                className="flex-1 font-mono text-xs border p-4 rounded-lg bg-slate-50" 
                value={json} 
                onChange={(e) => setJson(e.target.value)} 
            />
        </div>
    );
};

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

const App: React.FC = () => {
  const [allWords, setAllWords] = useState<AnalyzedWord[]>(INITIAL_WORDS);
  const [currentWordId, setCurrentWordId] = useState<string>(INITIAL_WORDS[0].id);
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [sessionMode, setSessionMode] = useState<'explore' | 'training'>('explore');
  const [trainingQueue, setTrainingQueue] = useState<AnalyzedWord[]>([]);
  const [trainingIndex, setTrainingIndex] = useState(0);

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [mode, setMode] = useState<'words' | 'sentences'>('words');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [view, setView] = useState<'app' | 'test'>('app');
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [expertMode, setExpertMode] = useState(false);
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [nextSuggestions, setNextSuggestions] = useState<AnalyzedWord[]>([]);
  const [suggestionHighlightIndex, setSuggestionHighlightIndex] = useState(0);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [globalAvatarTalking, setGlobalAvatarTalking] = useState(false);
  const [visemeConfig, setVisemeConfig] = useState<Record<string, number>>({});

  // 1. Initial Data Loading
  useEffect(() => {
    const loadPersistedData = async () => {
        try {
            const savedWords = await getAppData<AnalyzedWord[]>('allWords');
            const savedCompleted = await getAppData<string[]>('completedWordIds');
            
            if (savedWords && savedWords.length > 0) {
                setAllWords(savedWords);
                setCurrentWordId(savedWords[0].id);
            }
            if (savedCompleted) {
                setCompletedWordIds(new Set(savedCompleted));
            }
        } catch (e) {
            console.error("Failed to load persistent data", e);
        } finally {
            setDataLoaded(true);
        }
    };

    loadPersistedData();

    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }

    const loadedConfig = getVisemeConfig();
    const newConfig = { ...loadedConfig };
    let changed = false;
    ALL_SOUNDS.forEach(sound => {
        if (newConfig[sound.id] === undefined) {
            newConfig[sound.id] = getDefaultVisemeForSound(sound.id, sound.char);
            changed = true;
        }
    });
    if (changed) {
        saveVisemeConfig(newConfig);
    }
    setVisemeConfig(newConfig);

    const unlockAudio = () => {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(e => console.error("Auto-resume failed", e));
        }
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // 2. Continuous Saving
  useEffect(() => {
    if (dataLoaded) {
        saveAppData('allWords', allWords);
        saveAppData('completedWordIds', Array.from(completedWordIds));
    }
  }, [allWords, completedWordIds, dataLoaded]);

  useEffect(() => {
    if (nextSuggestions.length > 0) {
        const interval = setInterval(() => {
            setSuggestionHighlightIndex(prev => (prev + 1) % nextSuggestions.length);
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [nextSuggestions.length]);

  const handleSaveVisemeConfig = (newConfig: Record<string, number>) => {
      setVisemeConfig(newConfig);
      saveVisemeConfig(newConfig);
  };

  const handleQuickAdd = () => {
      if(!quickAddText.trim()) return;
      const newWord = analyzeWord(quickAddText.trim());
      setAllWords(prev => [...prev, newWord]);
      setQuickAddText('');
      setCurrentWordId(newWord.id);
      setSessionMode('explore');
      setNextSuggestions([]);
      if(window.innerWidth < 768) setSidebarOpen(false);
  };

  const startTraining = async () => {
      const blob = await getRecording('inst_start');
      let waitTime = 0;
      if (blob) {
          setGlobalAvatarTalking(true);
          const endTime = await playBlob(blob);
          const ctx = getAudioContext();
          waitTime = Math.max(0, (endTime - ctx.currentTime) * 1000);
          setTimeout(() => setGlobalAvatarTalking(false), waitTime);
      }

      const neverPracticed = allWords.filter(w => !w.lastPracticed);
      const oldPracticed = allWords
          .filter(w => w.lastPracticed)
          .sort((a, b) => (a.lastPracticed || 0) - (b.lastPracticed || 0));

      const queue = [...neverPracticed];
      if (queue.length < 5) {
          const needed = 5 - queue.length;
          queue.push(...oldPracticed.slice(0, needed));
      }
      
      const finalQueue = queue.slice(0, 5);
      if (finalQueue.length === 0) {
          alert("Inga ord finns att träna på.");
          setGlobalAvatarTalking(false);
          return;
      }

      setTimeout(() => {
          setTrainingQueue(finalQueue);
          setTrainingIndex(0);
          setCurrentWordId(finalQueue[0].id);
          setSessionMode('training');
          setNextSuggestions([]);
          setSidebarOpen(false); 
      }, waitTime);
  };

  const handleGenerate = useCallback(async () => {
    if (apiKeyMissing) { alert("API Key missing."); return; }
    setAppState(AppState.LOADING);
    try {
      const existingTexts = allWords.map(w => w.text);
      const newWords = await generateWordList(5, mode === 'words' ? 'simple' : 'medium', existingTexts);
      setAllWords(prev => [...prev, ...newWords]);
      if(newWords.length > 0 && sessionMode === 'explore') {
          setCurrentWordId(newWords[0].id);
          setNextSuggestions([]);
      }
      setAppState(AppState.PLAYING);
    } catch (e) {
      console.error(e);
      setAppState(AppState.ERROR);
    }
  }, [mode, apiKeyMissing, allWords, sessionMode]);

  const handleWordComplete = async () => {
      setCompletedWordIds(prev => new Set(prev).add(currentWordId));
      setAllWords(prev => prev.map(w => w.id === currentWordId ? { ...w, lastPracticed: Date.now() } : w));
      if (sessionMode === 'training' && trainingIndex === trainingQueue.length - 1) {
          setSessionMode('explore');
          setTrainingQueue([]);
      }
  };

  const handleFeedbackDone = async () => {
      if (sessionMode === 'explore') {
          const available = allWords.filter(w => w.id !== currentWordId);
          const shuffled = [...available].sort(() => 0.5 - Math.random());
          const suggestions = shuffled.slice(0, 3);
          
          if (suggestions.length > 0) {
              setNextSuggestions(suggestions);
              const blob = await getRecording('inst_choose_next');
              if (blob) {
                  setGlobalAvatarTalking(true);
                  const end = await playBlob(blob);
                  setTimeout(() => setGlobalAvatarTalking(false), (end - getAudioContext().currentTime) * 1000);
              }
              setTimeout(() => {
                  if (mainScrollRef.current) {
                      mainScrollRef.current.scrollTo({ top: mainScrollRef.current.scrollHeight, behavior: 'smooth' });
                  }
              }, 100);
          }
      }
  };

  const handleNextTrainingWord = async () => {
      const nextIdx = trainingIndex + 1;
      if (nextIdx < trainingQueue.length) {
          setTrainingIndex(nextIdx);
          setCurrentWordId(trainingQueue[nextIdx].id);
      } else {
          setSessionMode('explore');
          setTrainingQueue([]);
      }
  };

  const handleSuggestionClick = (wordId: string) => {
      setNextSuggestions([]);
      setCurrentWordId(wordId);
      setSessionMode('explore');
      setTrainingQueue([]);
      setTimeout(() => {
          if (mainScrollRef.current) {
               mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
      }, 50);
  }

  const exportWords = async () => {
      try {
          const json = await exportFullBackup(allWords);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lasresan-backup-${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) { alert("Fel vid export."); }
  };

  const importWords = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const content = ev.target?.result as string;
              const importedWords = await importFullBackup(content);
              const newVisemeConfig = getVisemeConfig();
              setVisemeConfig(newVisemeConfig);
              setAllWords(prev => {
                  const combinedMap = new Map(prev.map(w => [w.id, w]));
                  importedWords.forEach(w => {
                      combinedMap.set(w.id, w);
                  });
                  return Array.from(combinedMap.values());
              });
              alert(`Backup återställd! ${importedWords.length} ord laddade.`);
          } catch(err) { alert("Fel vid import."); }
      };
      reader.readAsText(file);
      e.target.value = ''; 
  }

  const currentWordData = allWords.find(w => w.id === currentWordId);
  const sortedWords = [...allWords].sort((a, b) => a.text.localeCompare(b.text, 'sv'));

  const currentInstructionId = sessionMode === 'training' 
      ? (trainingIndex + 1 === 5 ? 'inst_prog_final' : `inst_prog_${trainingIndex + 1}`)
      : undefined;

  if (!dataLoaded) {
      return <div className="min-h-screen bg-soft-blue flex items-center justify-center font-bold text-slate-500">Laddar...</div>;
  }

  if (view === 'test') { return <SoundTest onClose={() => setView('app')} visemeConfig={visemeConfig} onSaveVisemeConfig={handleSaveVisemeConfig} />; }

  return (
    <div className="min-h-screen bg-soft-blue flex flex-col font-sans h-screen overflow-hidden">
      {passcodeModalOpen && (
          <PasscodeModal onClose={() => setPasscodeModalOpen(false)} onUnlock={() => setSettingsUnlocked(true)} />
      )}
      {expertMode && (
          <ExpertEditor words={allWords} onSave={(newWords) => setAllWords(newWords)} onClose={() => setExpertMode(false)} />
      )}
      <input type="file" id="import-words" className="hidden" accept=".json" onChange={importWords} />
      <header className="w-full p-2 bg-white/90 backdrop-blur-sm border-b border-blue-100 flex justify-between items-center z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {settingsUnlocked && (
             <button className="md:hidden p-2 text-slate-600" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
          )}
          <h1 className="text-lg md:text-xl font-bold text-slate-700 tracking-tight ml-2">Läsresan</h1>
        </div>
        {settingsUnlocked ? (
            <div className="flex items-center gap-2">
               <button onClick={() => setView('test')} className="text-sm font-medium text-slate-500 bg-slate-50 border px-3 py-1.5 rounded-lg">🛠️ Ljud</button>
               <button onClick={() => document.getElementById('import-words')?.click()} className="text-sm font-medium text-slate-500 bg-slate-50 border px-3 py-1.5 rounded-lg">📥</button>
               <button onClick={exportWords} className="text-sm font-medium text-slate-500 bg-slate-50 border px-3 py-1.5 rounded-lg">📤</button>
               <button onClick={() => setExpertMode(true)} className="text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg font-bold">⚙️</button>
               <button onClick={() => setSettingsUnlocked(false)} className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-slate-300">
                  <span>Göm</span>
               </button>
            </div>
        ) : (
            <button onClick={() => setPasscodeModalOpen(true)} className="text-slate-300 hover:text-slate-400 p-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            </button>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden relative">
          {settingsUnlocked && (
              <aside className={`absolute md:relative z-40 h-full w-64 bg-white border-r border-slate-200 shadow-xl md:shadow-none transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col`}>
                 <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                     <h2 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Mina Ord</h2>
                     <button onClick={() => setSidebarOpen(false)} className="md:hidden">✕</button>
                 </div>
                 <div className="p-2 border-b bg-slate-50/50">
                     <div className="flex gap-1">
                         <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Lägg till ord..." value={quickAddText} onChange={(e) => setQuickAddText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()} />
                         <button onClick={handleQuickAdd} className="bg-blue-500 text-white px-2 rounded font-bold hover:bg-blue-600">+</button>
                     </div>
                 </div>
                 <div className="overflow-y-auto flex-1 p-2 space-y-1">
                     {sortedWords.map(word => {
                         const isCompleted = completedWordIds.has(word.id) || !!word.lastPracticed;
                         return (
                             <button key={word.id} onClick={() => { setCurrentWordId(word.id); setSessionMode('explore'); setNextSuggestions([]); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${word.id === currentWordId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
                                 <span className={`font-medium text-sm truncate ${isCompleted ? 'text-green-700' : 'text-slate-600'}`}>{word.text}</span>
                                 {isCompleted && <span className="text-green-500 text-xs">✓</span>}
                             </button>
                         )
                     })}
                 </div>
                 <div className="p-3 bg-white border-t">
                     <button onClick={handleGenerate} disabled={appState === AppState.LOADING} className="w-full bg-blue-500 text-white py-2 rounded-lg font-bold text-sm shadow">
                         {appState === AppState.LOADING ? '...' : '✨ Nya ord (AI)'}
                     </button>
                 </div>
              </aside>
          )}
          <main ref={mainScrollRef} className="flex-1 flex flex-col items-center p-2 md:p-4 bg-soft-blue w-full relative overflow-y-auto">
            {sessionMode !== 'training' && (
               <div className="w-full flex justify-center mb-4 mt-2">
                   <button onClick={startTraining} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg flex items-center gap-2 transform hover:scale-105 transition-all">🚀 Starta Träning</button>
               </div>
            )}
            <div className="w-full max-w-4xl z-10 flex flex-col items-center flex-1 justify-start">
                {currentWordData ? (
                    <div className="w-full flex flex-col items-center pb-20">
                        {sessionMode === 'training' && (
                            <div className="w-full max-w-md mb-2 px-4">
                                <div className="flex justify-between text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">
                                    <span>Träning</span>
                                    <span>{trainingIndex + 1} / {trainingQueue.length}</span>
                                </div>
                                <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner border border-blue-100">
                                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${((trainingIndex + 0.5) / trainingQueue.length) * 100}%` }}></div>
                                </div>
                            </div>
                        )}
                        <WordViewer key={currentWordId} wordData={currentWordData} onComplete={handleWordComplete} onFeedbackDone={handleFeedbackDone} onNext={sessionMode === 'training' ? handleNextTrainingWord : undefined} completionInstructionId={currentInstructionId} visemeConfig={visemeConfig} globalAvatarTalking={globalAvatarTalking} />
                        {nextSuggestions.length > 0 && (
                            <div className="mt-8 w-full max-w-2xl animate-fade-in-up pb-10">
                                <div className="text-center mb-6"><h3 className="text-xl font-bold text-slate-600">Välj ett nytt ord:</h3></div>
                                <div className="grid grid-cols-3 gap-4">
                                    {nextSuggestions.map((word, idx) => {
                                        const isHighlighted = idx === suggestionHighlightIndex;
                                        return (
                                            <button key={word.id} onClick={() => handleSuggestionClick(word.id)} className={`relative bg-white rounded-xl shadow-md border-2 p-4 flex flex-col items-center justify-center transition-all duration-300 h-32 md:h-40 ${isHighlighted ? 'scale-110 border-blue-400 ring-4 ring-blue-100 z-10' : 'border-slate-100 hover:border-blue-200'}`}>
                                                {isHighlighted && (<div className="absolute -top-12 left-1/2 -translate-x-[90%] text-4xl animate-bounce filter drop-shadow-sm w-12 text-center pointer-events-none z-50">👇</div>)}
                                                <div className="text-4xl md:text-5xl mb-2 opacity-50">❓</div>
                                                <div className="font-bold text-lg md:text-xl text-slate-700 capitalize">{word.text}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-slate-400 mt-10">Inga ord.</div>
                )}
            </div>
          </main>
      </div>
    </div>
  );
};

export default App;
