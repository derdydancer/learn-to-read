import { AnalyzedWord } from '../types';

// Store words in IndexedDB as a single JSON blob (same approach as audio)
// This ensures persistence across app restarts on Android

const DB_NAME = 'LasresanStorageDB';
const WORDS_STORE_NAME = 'app_data';
const WORDS_KEY = 'words_backup';
const DB_VERSION = 1;

interface AppDataRecord {
  id: string;
  data: string; // JSON string
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    console.log(`Opening IndexedDB for words: ${DB_NAME}, version: ${DB_VERSION}`);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error(`IndexedDB open error for ${DB_NAME}:`, request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log(`IndexedDB ${DB_NAME} opened successfully`);
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log(`IndexedDB ${DB_NAME} upgrade needed`);
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WORDS_STORE_NAME)) {
        console.log(`Creating object store: ${WORDS_STORE_NAME}`);
        db.createObjectStore(WORDS_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onblocked = () => {
      console.warn(`IndexedDB ${DB_NAME} open request blocked`);
    };
  });
};

// Save words as JSON blob to IndexedDB
export const saveWordsToFile = async (words: AnalyzedWord[]): Promise<void> => {
  try {
    console.log(`Saving ${words.length} words to IndexedDB file...`);
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(WORDS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WORDS_STORE_NAME);

      const data = JSON.stringify({
        version: 4,
        type: 'lasresan_full_backup',
        timestamp: Date.now(),
        words: words,
        // Note: audio and visemeConfig are not included in auto-save
        // to keep file size small and focused on words only
      }, null, 2);

      const record: AppDataRecord = {
        id: WORDS_KEY,
        data,
        timestamp: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        console.log(`Successfully saved ${words.length} words to IndexedDB file`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save words to IndexedDB:', request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        console.log('Words save transaction completed');
      };
    });
  } catch (error) {
    console.error('Error in saveWordsToFile:', error);
    throw error;
  }
};

// Load words from JSON blob in IndexedDB
export const loadWordsFromFile = async (): Promise<AnalyzedWord[]> => {
  try {
    console.log('Loading words from IndexedDB file...');
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(WORDS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(WORDS_STORE_NAME);
      const request = store.get(WORDS_KEY);

      request.onsuccess = () => {
        const record = request.result as AppDataRecord | undefined;
        if (!record) {
          console.log('No words file found in IndexedDB');
          resolve([]);
          return;
        }

        try {
          const parsed = JSON.parse(record.data);
          // Handle both formats: array of words OR object with words property
          if (Array.isArray(parsed)) {
            console.log(`Loaded ${parsed.length} words from IndexedDB file (array format)`);
            resolve(parsed as AnalyzedWord[]);
          } else if (parsed.words && Array.isArray(parsed.words)) {
            console.log(`Loaded ${parsed.words.length} words from IndexedDB file (object format)`);
            resolve(parsed.words as AnalyzedWord[]);
          } else {
            console.warn('Invalid words file format in IndexedDB');
            resolve([]);
          }
        } catch (parseError) {
          console.error('Failed to parse words data from IndexedDB:', parseError);
          resolve([]);
        }
      };

      request.onerror = () => {
        console.error('Failed to load words from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in loadWordsFromFile:', error);
    return [];
  }
};

// Clear words file from IndexedDB
export const clearWordsFile = async (): Promise<void> => {
  try {
    console.log('Clearing words file from IndexedDB...');
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(WORDS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WORDS_STORE_NAME);
      const request = store.delete(WORDS_KEY);

      request.onsuccess = () => {
        console.log('Successfully cleared words file from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear words file from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in clearWordsFile:', error);
  }
};

// Check if words file exists in IndexedDB
export const hasWordsFile = async (): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(WORDS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(WORDS_STORE_NAME);
      const request = store.get(WORDS_KEY);

      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };

      request.onerror = () => {
        console.error('Failed to check words file in IndexedDB:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error in hasWordsFile:', error);
    return false;
  }
};