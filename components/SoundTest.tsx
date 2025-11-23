import React, { useState, useEffect, useRef } from 'react';
import { speakLetter, speakText, getSwedishVoice } from '../utils/tts';
import { saveRecording, getRecording, deleteRecording, getAllRecordingIds, exportRecordingsToJSON, importRecordingsFromJSON } from '../utils/audioStorage';
import { playBlob } from '../utils/audioPlayer';
import { SoundItem, VOWELS, CONSONANTS, SPECIALS } from '../utils/soundDefinitions';

const SoundCard: React.FC<{ item: SoundItem; hasRecording: boolean; onUpdate: () => void }> = ({ item, hasRecording, onUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
        await saveRecording(item.id, blob);
        onUpdate();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing mic:", err);
      alert("Kunde inte starta mikrofonen. Kontrollera behörigheter.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playCustom = async () => {
      const blob = await getRecording(item.id);
      if (blob) playBlob(blob);
  };

  const deleteCustom = async () => {
      if(confirm(`Vill du ta bort din inspelning för "${item.label}"?`)) {
          await deleteRecording(item.id);
          onUpdate();
      }
  }

  return (
    <div className={`p-4 rounded-xl shadow-sm transition-all flex flex-col gap-3 relative border-2 ${hasRecording ? 'bg-white border-green-200' : 'bg-white border-transparent'}`}>
      
      {/* Status Indicator */}
      {hasRecording && (
          <div className="absolute top-2 right-2 flex gap-1">
             <span className="w-2 h-2 rounded-full bg-green-500" title="Inspelat ljud finns"></span>
          </div>
      )}

      <div className="flex justify-between items-center">
        <span className="font-bold text-xl text-slate-700 font-comic">{item.label}</span>
      </div>

      {/* Recording Controls */}
      <div className="flex items-center gap-2 mt-2">
         {/* Play Button */}
         <button 
           onClick={() => hasRecording ? playCustom() : speakLetter(item.char, item.phoneme)}
           className={`p-3 rounded-full transition-colors active:scale-90 flex-1 flex justify-center items-center ${hasRecording ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
           title={hasRecording ? "Spela din inspelning" : "Spela TTS-ljud"}
         >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
         </button>

         {/* Record Button */}
         <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`p-3 rounded-full transition-all active:scale-95 shadow-sm border ${isRecording ? 'bg-red-600 text-white border-red-700 scale-110' : 'bg-white text-red-500 border-red-100 hover:bg-red-50'}`}
            title="Håll inne för att spela in"
         >
            {isRecording ? (
                <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-sm animate-pulse"></div>
                </div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            )}
         </button>

         {/* Delete Button */}
         {hasRecording && (
             <button 
                onClick={deleteCustom}
                className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Radera inspelning"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
             </button>
         )}
      </div>

      <div className="text-sm text-slate-500 border-t pt-2 mt-1 flex justify-between items-center">
             <span>Ex: <strong>{item.example}</strong></span>
      </div>
    </div>
  );
}

const SoundSection: React.FC<{ title: string; items: SoundItem[]; color: string; recordedIds: string[]; onUpdate: () => void }> = ({ title, items, color, recordedIds, onUpdate }) => (
  <div className={`mb-8 p-6 rounded-2xl ${color} border border-white shadow-sm`}>
    <h3 className="text-xl font-bold mb-4 text-slate-700">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <SoundCard 
            key={item.id} 
            item={item} 
            hasRecording={recordedIds.includes(item.id)}
            onUpdate={onUpdate}
        />
      ))}
    </div>
  </div>
);

const SoundTest: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [recordedIds, setRecordedIds] = useState<string[]>([]);
  const [voiceName, setVoiceName] = useState<string>('Laddar röst...');

  const refreshRecordings = async () => {
      try {
          const ids = await getAllRecordingIds();
          setRecordedIds(ids);
      } catch (e) {
          console.error("Could not fetch recordings", e);
      }
  };

  useEffect(() => {
    refreshRecordings();
    
    const checkVoice = () => {
      const v = getSwedishVoice();
      setVoiceName(v ? `${v.name} (${v.lang})` : 'Ingen svensk röst hittades (använder systemstandard)');
    };
    
    checkVoice();
    const interval = setInterval(checkVoice, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = async () => {
      try {
          const json = await exportRecordingsToJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lasresan-ljud-${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          alert("Kunde inte exportera ljud.");
      }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const content = ev.target?.result as string;
              const count = await importRecordingsFromJSON(content);
              await refreshRecordings();
              alert(`${count} ljudfiler importerades!`);
          } catch (err) {
              alert("Fel vid import av fil. Kontrollera formatet.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  return (
    <div className="bg-slate-50 min-h-full pb-20 pt-4">
      <input type="file" id="import-file" className="hidden" accept=".json" onChange={handleImportFile} />

      <div className="sticky top-0 bg-white/95 backdrop-blur border-b p-4 mb-6 z-10 flex flex-wrap gap-4 justify-between items-center shadow-sm mx-4 rounded-xl">
        <h2 className="text-2xl font-bold text-slate-800">🛠️ Ljudstudio</h2>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => document.getElementById('import-file')?.click()}
                className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
            >
                📥 Importera
            </button>
            <button 
                onClick={handleExport}
                className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
            >
                📤 Exportera
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button 
            onClick={onClose}
            className="text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Klar
            </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-8 text-sm text-blue-800 flex items-start gap-3 shadow-sm">
           <span className="text-2xl">🎙️</span>
           <div className="flex-1">
             <strong>Spela in dina egna ljud!</strong>
             <p className="mb-1">Nu kan du spela in olika varianter för vokaler (Lång och Kort). Exempelvis låter ett långt 'A' som i "Apa", medan ett kort 'A' låter som i "Katt".</p>
             <p className="text-xs text-blue-600 mt-2">
                 Antal egna inspelningar: <strong>{recordedIds.length}</strong>
             </p>
           </div>
        </div>

        <SoundSection title="Vokaler (Långa & Korta)" items={VOWELS} color="bg-red-50" recordedIds={recordedIds} onUpdate={refreshRecordings} />
        <SoundSection title="Konsonanter" items={CONSONANTS} color="bg-blue-50" recordedIds={recordedIds} onUpdate={refreshRecordings} />
        <SoundSection title="Specialljud & Regler" items={SPECIALS} color="bg-purple-50" recordedIds={recordedIds} onUpdate={refreshRecordings} />
      </div>
    </div>
  );
};

export default SoundTest;