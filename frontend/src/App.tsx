import { isAccessGranted } from "./components/AccessGate";
import AccessGate from "./components/AccessGate";
import { useState } from "react";

export default function App() {
  const [accessGranted, setAccessGranted] = useState(() => isAccessGranted());

  if (!accessGranted) {
    return <AccessGate onGranted={() => setAccessGranted(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold text-gray-900">TOPIK Practice</h1>
      <p className="text-gray-500 mt-2">Reading · Listening · Writing</p>
    </div>
  );
}
