
import { AnalyzedWord } from '../types';

// Handles storage of audio blobs in IndexedDB.
// Browser's localStorage is too small for audio files.

const DB_NAME = 'LasresanAudioDB';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

interface AudioRecord {
  id: string; // The SoundItem ID (e.g., 'h1', 'c5') or Word ID
  blob: Blob;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveRecording = async (id: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const record: AudioRecord = {
      id,
      blob,
      timestamp: Date.now(),
    };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getRecording = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const record = request.result as AudioRecord | undefined;
      resolve(record ? record.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteRecording = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllRecordingIds = async (): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
    });
}

// --- Import / Export Helpers ---

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64);
  return res.blob();
};

export const exportRecordingsToJSON = async (): Promise<string> => {
    const ids = await getAllRecordingIds();
    const exportData: Record<string, string> = {}; 

    for (const id of ids) {
        const blob = await getRecording(id);
        if (blob) {
            exportData[id] = await blobToBase64(blob);
        }
    }

    return JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        description: "Läsresan Sound Backup",
        recordings: exportData
    }, null, 2);
};

export const importRecordingsFromJSON = async (jsonString: string): Promise<number> => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.recordings) throw new Error("Invalid file format: missing recordings");
        
        const recordings = data.recordings as Record<string, string>;
        let count = 0;
        
        for (const [id, dataUrl] of Object.entries(recordings)) {
            const blob = await base64ToBlob(dataUrl);
            await saveRecording(id, blob);
            count++;
        }
        return count;
    } catch (e) {
        console.error("Import failed", e);
        throw e;
    }
}

// --- WAV ENCODING (For Trimming/Saving) ---

export const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  };

  floatTo16BitPCM(view, 44, samples);
  return new Blob([view], { type: 'audio/wav' });
};

// --- CONFIG STORAGE (Visemes) ---
const CONFIG_KEY = 'lasresan_viseme_config';

export const saveVisemeConfig = (config: Record<string, number>) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
};

export const getVisemeConfig = (): Record<string, number> => {
    if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (raw) {
            try { return JSON.parse(raw); } catch (e) {}
        }
    }
    return {};
};


// --- FULL PROJECT BACKUP (Words + All Sounds + Config) ---

export const exportFullBackup = async (words: AnalyzedWord[]): Promise<string> => {
    const allIds = await getAllRecordingIds();
    const audioData: Record<string, string> = {};

    for (const id of allIds) {
        const blob = await getRecording(id);
        if (blob) {
            audioData[id] = await blobToBase64(blob);
        }
    }
    
    return JSON.stringify({
        version: 4,
        type: 'lasresan_full_backup',
        timestamp: Date.now(),
        words: words,
        audio: audioData,
        visemeConfig: getVisemeConfig()
    }, null, 2);
};

export const importFullBackup = async (jsonString: string): Promise<AnalyzedWord[]> => {
    try {
        const data = JSON.parse(jsonString);
        if (Array.isArray(data)) return data; 
        
        if (data.audio) {
            const entries = Object.entries(data.audio);
            for (const [id, base64] of entries) {
                 const blob = await base64ToBlob(base64 as string);
                 await saveRecording(id, blob);
            }
        }
        
        if (data.visemeConfig) {
            saveVisemeConfig(data.visemeConfig);
        }
        
        return (data.words || []) as AnalyzedWord[];
    } catch (e) {
        console.error("Backup import failed", e);
        throw e;
    }
};
