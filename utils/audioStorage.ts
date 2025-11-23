
// Handles storage of audio blobs in IndexedDB.
// Browser's localStorage is too small for audio files.

const DB_NAME = 'LasresanAudioDB';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

interface AudioRecord {
  id: string; // The SoundItem ID (e.g., 'h1', 'c5')
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

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64);
  return res.blob();
};

export const exportRecordingsToJSON = async (): Promise<string> => {
    // Get all keys
    const ids = await getAllRecordingIds();
    const exportData: Record<string, string> = {}; // id -> dataURL

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
