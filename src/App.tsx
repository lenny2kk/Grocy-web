import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout';
import { Refrigerator, Loader2 } from 'lucide-react';

function App() {
  const { user, loading } = useAuth();

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px]" />
        
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-3xl bg-white border border-slate-200 text-indigo-600 shadow-xl shadow-slate-200/50">
            <Refrigerator className="w-10 h-10 animate-bounce" />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-650" />
            Wczytywanie profilu...
          </div>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Auth screen
  if (!user) {
    return <AuthPage />;
  }

  // Logged in -> Show App panels layout
  return <AuthenticatedLayout />;
}

export default App;
