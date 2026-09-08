import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import AccessGate, { isAccessGranted } from "./components/AccessGate";

function NavBar() {
  const { pathname } = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navLink = (to: string, label: string) => {
    const href = `${base}${to}`;
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        to={to}
        className={`text-sm font-medium transition-colors ${
          active ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="border-b border-gray-200 bg-white px-4 md:px-6 py-3 flex items-center gap-6 shrink-0">
      <Link to="/" className="font-bold text-gray-900 text-sm md:text-base">
        TOPIK Practice
      </Link>
      {navLink("/reading", "Reading")}
      {navLink("/listening", "Listening")}
      {navLink("/writing", "Writing")}
      {navLink("/progress", "Progress")}
    </nav>
  );
}

export function App() {
  const [accessGranted, setAccessGranted] = useState(() => isAccessGranted());

  if (!accessGranted) {
    return <AccessGate onGranted={() => setAccessGranted(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
