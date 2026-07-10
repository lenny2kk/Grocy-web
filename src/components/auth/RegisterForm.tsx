import React, { useState } from 'react';
import { Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName || !email || !password || !confirmPassword) {
      setError('Proszę wypełnić wszystkie pola.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Podane hasła nie są identyczne.');
      return;
    }

    if (password.length < 6) {
      setError('Hasło must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password, displayName);
    } catch (err) {
      console.error('Registration error:', err);
      const firebaseError = err as { code?: string; message?: string };
      switch (firebaseError.code) {
        case 'auth/email-already-in-use':
          setError('Ten adres e-mail jest już zajęty.');
          break;
        case 'auth/invalid-email':
          setError('Niepoprawny format adresu e-mail.');
          break;
        case 'auth/operation-not-allowed':
          setError('Rejestracja jest wyłączona.');
          break;
        case 'auth/weak-password':
          setError('Hasło jest za słabe.');
          break;
        default:
          setError(err.message || 'Wystąpił błąd podczas rejestracji.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="displayName" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          Imię / Nazwa
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <User className="w-5 h-5" />
          </span>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading}
            placeholder="np. Jan Kowalski"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all disabled:opacity-50"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          E-mail
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Mail className="w-5 h-5" />
          </span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="twoj@email.com"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all disabled:opacity-50"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          Hasło
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Lock className="w-5 h-5" />
          </span>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Min. 6 znaków"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all disabled:opacity-50"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          Powtórz hasło
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Lock className="w-5 h-5" />
          </span>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Powtórz hasło"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all disabled:opacity-50"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3.5 px-4 flex justify-center items-center font-bold text-sm text-white rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all shadow-md shadow-indigo-500/10 disabled:opacity-50 cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Tworzenie konta...
          </>
        ) : (
          'Zarejestruj się'
        )}
      </button>

      <div className="text-center pt-2">
        <span className="text-xs text-slate-400">Masz już konto?</span>{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          disabled={isLoading}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer"
        >
          Zaloguj się
        </button>
      </div>
    </form>
  );
};
