
import { AnalyzedWord } from '../types';

// Handles storage of audio blobs and app metadata in IndexedDB.
// Browser's localStorage is too small for audio files, and IndexedDB is more reliable for Cordova.

const DB_NAME = 'LasresanAudioDB';
const STORE_NAME = 'recordings';
const DATA_STORE = 'appData'; // New store for word lists and progress
const DB_VERSION = 2; // Increment version for new store

interface AudioRecord {
  id: string; // The SoundItem ID or Word ID
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
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
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

// --- App Data Persistence (Words, Progress) ---

export const saveAppData = async (key: string, value: any): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DATA_STORE, 'readwrite');
        const store = transaction.objectStore(DATA_STORE);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAppData = async <T>(key: string): Promise<T | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DATA_STORE, 'readonly');
        const store = transaction.objectStore(DATA_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

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

// Fix: Added encodeWAV utility function for exporting recorded audio as WAV blobs.
export const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
};
