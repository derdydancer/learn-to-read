
import React, { useState, useEffect, useRef } from 'react';
import { speakLetter as ttsSpeakLetter, speakText as ttsSpeakText, getSwedishVoice } from '../utils/tts';
// Fix: Updated imports to match utils/audioStorage exports. Removed non-existent exportRecordingsToJSON and importRecordingsFromJSON.
import { saveRecording, getRecording, deleteRecording, getAllRecordingIds, exportFullBackup, importFullBackup, encodeWAV } from '../utils/audioStorage';
import { playBlob, getAudioContext } from '../utils/audioPlayer';
import { SoundItem, VOWELS, CONSONANTS, SPECIALS, INSTRUCTIONS } from '../utils/soundDefinitions';
import { VISEMES } from '../utils/visemePaths';

// Helper to trim silence
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

const VisemeSelector: React.FC<{ 
    selected: number; 
    onSelect: (id: number) => void;
    onClose: () => void 
}> = ({ selected, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold">Välj munform</h3>
                    <button onClick={onClose} className="text-xl">✕</button>
                </div>
                <div className="p-4 overflow-y-auto grid grid-cols-5 sm:grid-cols-8 gap-2">
                    {VISEMES.map((path, idx) => (
                        <button 
                            key={idx}
                            onClick={() => onSelect(idx)}
                            className={`aspect-square rounded border flex items-center justify-center hover:bg-blue-50 relative ${selected === idx ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}`}
                        >
                            <svg viewBox="0 0 100 110" className="w-full h-full">
                                <path d={path} fill="#3E2723" />
                            </svg>
                            <span className="absolute top-0 right-1 text-[8px] text-slate-400">{idx}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
};

const SoundCard: React.FC<{ 
    item: SoundItem; 
    hasRecording: boolean; 
    visemeId: number;
    onUpdate: () => void;
    onVisemeChange: (id: string, viseme: number) => void;
}> = ({ item, hasRecording, visemeId, onUpdate, onVisemeChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showVisemeSelector, setShowVisemeSelector] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
      if (isRecording) {
          if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            mediaRecorderRef.current.onstop = async () => {
                const rawBlob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
                const ctx = getAudioContext();
                const arrayBuffer = await rawBlob.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                const trimmedBuffer = trimAudioBuffer(audioBuffer, ctx);
                const wavBlob = encodeWAV(trimmedBuffer.getChannelData(0), trimmedBuffer.sampleRate);
                await saveRecording(item.id, wavBlob);
                onUpdate();
                stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) { alert("Kunde inte starta mikrofonen."); }
      }
  };

  const playCustom = async () => {
      const blob = await getRecording(item.id);
      if (blob) playBlob(blob);
  };

  const deleteCustom = async () => {
      if(confirm(`Radera?`)) {
          await deleteRecording(item.id);
          onUpdate();
      }
  }

  return (
    <div className={`p-3 rounded-lg shadow-sm transition-all flex flex-col gap-2 relative border ${hasRecording ? 'bg-white border-green-200' : 'bg-white border-slate-100'}`}>
      {hasRecording && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500"></div>}

      <div className="flex justify-between items-start">
        <span className="font-bold text-sm text-slate-700">{item.label}</span>
      </div>

      <div className="flex items-center gap-2 mt-1">
         <button 
           onClick={() => hasRecording ? playCustom() : ttsSpeakLetter(item.char, item.phoneme)}
           className={`p-2 rounded-md flex-1 flex justify-center items-center text-xs font-bold ${hasRecording ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
         >
            {hasRecording ? '▶ Spela' : 'TTS'}
         </button>

         <button
            onClick={toggleRecording}
            className={`p-2 rounded-md transition-all border w-10 flex justify-center ${isRecording ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-500 border-red-100'}`}
         >
            {isRecording ? <div className="w-3 h-3 bg-white rounded-sm"></div> : <div className="w-3 h-3 bg-red-500 rounded-full"></div>}
         </button>

         {hasRecording && (
             <button onClick={deleteCustom} className="p-2 text-slate-400 hover:text-red-500">✕</button>
         )}
      </div>
      
      {/* Mouth Selection Trigger */}
      <button 
        onClick={() => setShowVisemeSelector(true)}
        className="flex items-center gap-2 bg-slate-50 border rounded p-1 hover:bg-blue-50"
        title="Välj munform"
      >
          <div className="w-6 h-6 relative bg-white border rounded-full overflow-hidden">
               <svg viewBox="0 0 100 110" className="w-full h-full">
                    <path d={VISEMES[visemeId]} fill="#3E2723" />
               </svg>
          </div>
          <span className="text-[10px] text-slate-500">Mun: {visemeId}</span>
      </button>

      {showVisemeSelector && (
          <VisemeSelector 
            selected={visemeId} 
            onSelect={(id) => { onVisemeChange(item.id, id); setShowVisemeSelector(false); }}
            onClose={() => setShowVisemeSelector(false)}
          />
      )}

      <div className="text-[10px] text-slate-400 truncate">{item.example}</div>
    </div>
  );
}

const SoundSection: React.FC<{ 
    title: string; 
    items: SoundItem[]; 
    color: string; 
    recordedIds: string[]; 
    visemeConfig: Record<string, number>;
    onUpdate: () => void;
    onVisemeChange: (id: string, v: number) => void;
}> = ({ title, items, color, recordedIds, visemeConfig, onUpdate, onVisemeChange }) => (
  <div className={`mb-6 p-4 rounded-xl ${color} border border-white shadow-sm`}>
    <h3 className="text-lg font-bold mb-3 text-slate-700">{title}</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <SoundCard 
            key={item.id} 
            item={item} 
            hasRecording={recordedIds.includes(item.id)}
            visemeId={visemeConfig[item.id] ?? 0}
            onUpdate={onUpdate}
            onVisemeChange={onVisemeChange}
        />
      ))}
    </div>
  </div>
);

interface SoundTestProps {
    onClose: () => void;
    visemeConfig: Record<string, number>;
    onSaveVisemeConfig: (config: Record<string, number>) => void;
}

const SoundTest: React.FC<SoundTestProps> = ({ onClose, visemeConfig, onSaveVisemeConfig }) => {
  const [recordedIds, setRecordedIds] = useState<string[]>([]);
  
  const refreshData = async () => {
      try {
          const ids = await getAllRecordingIds();
          setRecordedIds(ids);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleVisemeChange = (soundId: string, visemeId: number) => {
      const newConfig = { ...visemeConfig, [soundId]: visemeId };
      onSaveVisemeConfig(newConfig);
  };

  return (
    <div className="bg-slate-50 min-h-full pb-20 pt-4">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b p-3 mb-4 z-10 flex justify-between items-center shadow-sm mx-2 rounded-xl">
        <h2 className="text-xl font-bold text-slate-800">🛠️ Ljudstudio</h2>
        <button onClick={onClose} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Klar</button>
      </div>

      <div className="max-w-5xl mx-auto px-2">
        <SoundSection title="🗣️ Röstinstruktioner" items={INSTRUCTIONS} color="bg-yellow-50" recordedIds={recordedIds} visemeConfig={visemeConfig} onUpdate={refreshData} onVisemeChange={handleVisemeChange} />
        <SoundSection title="Vokaler" items={VOWELS} color="bg-red-50" recordedIds={recordedIds} visemeConfig={visemeConfig} onUpdate={refreshData} onVisemeChange={handleVisemeChange} />
        <SoundSection title="Konsonanter" items={CONSONANTS} color="bg-blue-50" recordedIds={recordedIds} visemeConfig={visemeConfig} onUpdate={refreshData} onVisemeChange={handleVisemeChange} />
        <SoundSection title="Specialljud" items={SPECIALS} color="bg-purple-50" recordedIds={recordedIds} visemeConfig={visemeConfig} onUpdate={refreshData} onVisemeChange={handleVisemeChange} />
      </div>
    </div>
  );
};

export default SoundTest;
