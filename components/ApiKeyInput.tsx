import React, { useState, useEffect } from 'react';

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string) => void;
  onClose: () => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySet, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Check if we already have an API key in localStorage
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setIsValid(true);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      onApiKeySet(apiKey.trim());
      onClose();
    }
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsValid(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    setIsValid(value.trim().length > 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
            🔑 Gemini API Key
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            Ange din Gemini API-nyckel för att generera nya ord och meningar.
            Nyckeln sparas lokalt i din webbläsare.
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={handleChange}
                placeholder="Ange din Gemini API-nyckel..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && isValid && handleSave()}
              />
              <p className="text-xs text-slate-500 mt-2">
                Hämta din API-nyckel från{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">
                💡 Så här får du din API-nyckel:
              </h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Gå till <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                <li>Logga in med ditt Google-konto</li>
                <li>Klicka på "Create API Key"</li>
                <li>Kopiera nyckeln och klistra in här</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-between gap-3">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300"
          >
            Rensa
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className={`px-6 py-2 rounded-lg font-bold ${
                isValid
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              Spara
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyInput;