import { useState } from "react";

const ACCESS_CODE = "아현아 사랑해";
const SESSION_KEY = "topik-access-granted";

// eslint-disable-next-line react-refresh/only-export-components
export function isAccessGranted(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

interface AccessGateProps {
  onGranted: () => void;
}

export default function AccessGate({ onGranted }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onGranted();
    } else {
      setError(true);
      setCode("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">TOPIK Vocab</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the access code to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(false); }}
            placeholder="Access code"
            autoFocus
            className={`w-full rounded-lg border px-4 py-2.5 text-gray-900 text-sm outline-none transition-colors ${
              error
                ? "border-red-400 focus:border-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
          />
          {error && (
            <p className="text-xs text-red-500">Incorrect code. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
