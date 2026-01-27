import { AnalyzedWord } from '../types';

// Handles storage of words in IndexedDB.
// Using IndexedDB instead of localStorage for better persistence across app restarts

const DB_NAME = 'LasresanWordDB';
const STORE_NAME = 'words';
const DB_VERSION = 1;

interface WordRecord {
  id: string;
  word: AnalyzedWord;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    console.log(`Opening IndexedDB: ${DB_NAME}, version: ${DB_VERSION}`);
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
      console.log(`IndexedDB ${DB_NAME} upgrade needed, old version: ${event.oldVersion}, new version: ${event.newVersion}`);
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log(`Creating object store: ${STORE_NAME}`);
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onblocked = () => {
      console.warn(`IndexedDB ${DB_NAME} open request blocked`);
    };
  });
};

export const saveWord = async (word: AnalyzedWord): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const record: WordRecord = {
      id: word.id,
      word,
      timestamp: Date.now(),
    };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveAllWords = async (words: AnalyzedWord[]): Promise<void> => {
  console.log(`saveAllWords: Saving ${words.length} words to IndexedDB`);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing words first
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      console.log('saveAllWords: Cleared existing words');
      // Add all new words
      let completed = 0;
      let hasError = false;

      if (words.length === 0) {
        console.log('saveAllWords: No words to save, resolving');
        resolve();
        return;
      }

      console.log(`saveAllWords: Starting to save ${words.length} words`);
      words.forEach((word, index) => {
        const record: WordRecord = {
          id: word.id,
          word,
          timestamp: Date.now(),
        };
        const request = store.put(record);

        request.onsuccess = () => {
          completed++;
          if (completed === words.length && !hasError) {
            console.log(`saveAllWords: Successfully saved all ${words.length} words`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error(`saveAllWords: Error saving word ${word.id} (${word.text})`, request.error);
          hasError = true;
          reject(request.error);
        };
      });
    };

    clearRequest.onerror = (event) => {
      console.error('saveAllWords: Error clearing store', clearRequest.error);
      reject(clearRequest.error);
    };

    transaction.oncomplete = () => {
      console.log('saveAllWords: Transaction completed');
    };

    transaction.onerror = (event) => {
      console.error('saveAllWords: Transaction error', transaction.error);
    };
  });
};

export const getWord = async (id: string): Promise<AnalyzedWord | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const record = request.result as WordRecord | undefined;
      resolve(record ? record.word : null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllWords = async (): Promise<AnalyzedWord[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as WordRecord[] || [];
        const words = records.map(record => record.word);
        console.log(`IndexedDB getAll: found ${records.length} records, ${words.length} words`);
        resolve(words);
      };
      request.onerror = (event) => {
        console.error('IndexedDB getAll error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in getAllWords:', error);
    throw error;
  }
};

export const deleteWord = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearAllWords = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Helper to sync React state with IndexedDB
export const syncWordsToStorage = async (words: AnalyzedWord[]): Promise<void> => {
  await saveAllWords(words);
};

// Load words from storage on app startup
export const loadWordsFromStorage = async (): Promise<AnalyzedWord[]> => {
  try {
    console.log('Loading words from IndexedDB...');
    const words = await getAllWords();
    console.log(`Loaded ${words.length} words from storage`);
    return words;
  } catch (error) {
    console.error('Failed to load words from storage:', error);
    return [];
  }
};