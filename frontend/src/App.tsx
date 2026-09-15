import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import AccessGate from "./components/AccessGate";
import { checkAuthSession } from "./services/api";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}`;

function NavBar() {
  return (
    <nav className="border-b border-gray-200 bg-white px-4 md:px-6 py-3 flex items-center gap-6 shrink-0">
      <Link to="/" className="font-bold text-gray-900 text-sm md:text-base">
        TOPIK Practice
      </Link>
      <NavLink to="/" end className={navClass}>쓰기</NavLink>
      <NavLink to="/progress" className={navClass}>Progress</NavLink>
    </nav>
  );
}

export function App() {
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAuthSession().then((authenticated) => {
      if (!cancelled) setAccessGranted(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (accessGranted === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        로그인 확인 중…
      </div>
    );
  }

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
