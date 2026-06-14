import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { PantryDashboard } from './components/pantry/PantryDashboard';
import { ShoppingListContainer } from './components/shopping/ShoppingListContainer';
import { RecipeListContainer } from './components/recipes/RecipeListContainer';
import { SettingsContainer } from './components/settings/SettingsContainer';
import { 
  LogOut, 
  Loader2, 
  Refrigerator,
  ShoppingCart,
  BookOpen,
  Settings
} from 'lucide-react';

type Tab = 'pantry' | 'shopping' | 'recipes' | 'settings';

function App() {
  const { user, loading, signOutUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pantry');

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

  // Not logged in -> Show Auth screens
  if (!user) {
    return (
      <>
        {isRegister ? (
          <AuthLayout 
            title="Utwórz nowe konto" 
            subtitle="Zorganizuj swoją spiżarnię i listy zakupów już dziś"
          >
            <RegisterForm onSwitchToLogin={() => setIsRegister(false)} />
          </AuthLayout>
        ) : (
          <AuthLayout 
            title="Zaloguj się do spiżarni" 
            subtitle="Twój domowy organizer zakupów w czasie rzeczywistym"
          >
            <LoginForm onSwitchToRegister={() => setIsRegister(true)} />
          </AuthLayout>
        )}
      </>
    );
  }

  // Render current tab component
  const renderContent = () => {
    switch (activeTab) {
      case 'pantry':
        return <PantryDashboard />;
      case 'shopping':
        return <ShoppingListContainer />;
      case 'recipes':
        return <RecipeListContainer />;
      case 'settings':
        return <SettingsContainer />;
      default:
        return <PantryDashboard />;
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-24 sm:pb-0 overflow-x-hidden">
      {/* Background lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="z-50 border-b border-slate-200/60 bg-white/95 backdrop-blur-md sticky top-0 px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Refrigerator className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
              GrocyWeb
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-slate-100 border border-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('pantry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pantry' ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Refrigerator className="w-4 h-4" />
              Spiżarnia
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'shopping' ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Zakupy
            </button>
            <button
              onClick={() => setActiveTab('recipes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'recipes' ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Przepisy
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              Ustawienia
            </button>
          </nav>

          <button
            onClick={() => signOutUser()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="z-10 flex-grow max-w-5xl w-full mx-auto px-4 py-6 sm:py-8">
        {renderContent()}
      </main>

      {/* Mobile Sticky Tab Bar (mobile-first layout for Safari iPhone with safe area inset) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 px-4 py-2.5 flex items-center justify-around pb-[calc(1.2rem+env(safe-area-inset-bottom,0px))]">
        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'pantry' ? 'text-indigo-650 font-bold scale-[1.03]' : 'text-slate-400'
          }`}
        >
          <Refrigerator className="w-5.5 h-5.5" />
          <span className="text-[10px]">Spiżarnia</span>
        </button>

        <button
          onClick={() => setActiveTab('shopping')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'shopping' ? 'text-indigo-650 font-bold scale-[1.03]' : 'text-slate-400'
          }`}
        >
          <ShoppingCart className="w-5.5 h-5.5" />
          <span className="text-[10px]">Zakupy</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'recipes' ? 'text-indigo-650 font-bold scale-[1.03]' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-5.5 h-5.5" />
          <span className="text-[10px]">Przepisy</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'settings' ? 'text-indigo-650 font-bold scale-[1.03]' : 'text-slate-400'
          }`}
        >
          <Settings className="w-5.5 h-5.5" />
          <span className="text-[10px]">Ustawienia</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="hidden sm:block z-10 border-t border-slate-200 bg-slate-100 py-4 text-center text-[10px] text-slate-500">
        &copy; 2026 GrocyWeb. Stworzone z pasją do organizacji.
      </footer>
    </div>
  );
}

export default App;
