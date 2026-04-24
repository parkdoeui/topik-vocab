import { useState } from "react";

interface HeaderProps {
  basketCount: number;
  onBasketClick: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  showTranslation: boolean;
  onToggleTranslation: () => void;
}

export default function Header({
  basketCount,
  onBasketClick,
  apiKey,
  onApiKeyChange,
  showTranslation,
  onToggleTranslation,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    onApiKeyChange(trimmed);
    localStorage.setItem("krdict-api-key", trimmed);
    setSettingsOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-gray-900">TOPIK 어휘</span>
        <span className="text-sm text-gray-400 hidden sm:inline">Vocab Reader</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Settings button */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                krdict API Key
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Optional. Without a key, the app uses the bundled kengdic dictionary.{" "}
                <a
                  href="https://krdict.korean.go.kr/openApi/openApiInfo"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 underline"
                >
                  Get a free key
                </a>
              </p>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste API key here…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveKey}
                  className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 text-sm py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {apiKey && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ API key set — using krdict
                </p>
              )}
            </div>
          )}
        </div>

        {/* Basket button — mobile only */}
        <button
          onClick={onBasketClick}
          className="md:hidden flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          aria-label={`Open word basket (${basketCount} words)`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM15.5 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
          {basketCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
              {basketCount}
            </span>
          )}
          <span>Basket</span>
        </button>

        {/* Desktop: basket count text */}
        <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM15.5 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
          <span>
            {basketCount === 0
              ? "No saved words"
              : `${basketCount} saved word${basketCount === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
    </header>
  );
}
