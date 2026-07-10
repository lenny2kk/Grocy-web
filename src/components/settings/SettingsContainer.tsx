/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Copy, 
  Check, 
  Users, 
  User, 
  Mail, 
  LogOut, 
  Share2,
  AlertCircle,
  Loader2,
  Smile
} from 'lucide-react';

interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  currentFamilyId: string;
}

export const SettingsContainer: React.FC = () => {
  const { user, userProfile, profileError, signOutUser } = useAuth();
  const [copiedType, setCopiedType] = useState<'userId' | 'familyId' | null>(null);
  const [familyInputId, setFamilyInputId] = useState('');
  
  // Local operation states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Members list states
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Query family members real-time from Firestore /users
  useEffect(() => {
    if (!user || !userProfile?.currentFamilyId) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    setMembersError(null);

    const q = query(
      collection(db, 'users'),
      where('currentFamilyId', '==', userProfile.currentFamilyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FamilyMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          uid: docSnap.id,
          displayName: data.displayName || '',
          email: data.email || '',
          currentFamilyId: data.currentFamilyId || ''
        });
      });
      setMembers(list);
      setLoadingMembers(false);
    }, (err) => {
      console.error('Error fetching family members:', err);
      setMembersError(`Błąd pobierania członków rodziny z Firestore: ${err.message}. Sprawdź reguły zabezpieczeń.`);
      setLoadingMembers(false);
    });

    return () => unsubscribe();
  }, [user, userProfile?.currentFamilyId]);

  // Handle loading and errors for the userProfile state
  if (!user) return null;

  if (profileError) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Ustawienia & Profil</h2>
          <p className="text-xs text-slate-500 mt-1">Błąd konfiguracji</p>
        </div>
        
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-rose-200 rounded-3xl shadow-sm text-center space-y-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Nie udało się załadować profilu</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Firestore zablokował odczyt dokumentu użytkownika. Upewnij się, że w konsoli Firebase włączyłeś bazę Firestore oraz skonfigurowałeś reguły zabezpieczeń na odczyt/zapis.
            </p>
          </div>
          <div className="text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl text-rose-600 break-all max-w-md">
            {profileError}
          </div>
          <button
            onClick={() => signOutUser()}
            className="px-4 py-2 font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Wyloguj się
          </button>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Ustawienia & Profil</h2>
          <p className="text-xs text-slate-500 mt-1">Wczytywanie informacji...</p>
        </div>
        
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200/60 rounded-3xl shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium text-slate-500">Pobieranie profilu użytkownika z bazy danych...</p>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string, type: 'userId' | 'familyId') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const targetFamilyId = familyInputId.trim();

    if (!targetFamilyId) {
      setError('Wpisz ID rodziny.');
      return;
    }

    if (targetFamilyId === userProfile.currentFamilyId) {
      setError('Należysz już do tej rodziny.');
      return;
    }

    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        currentFamilyId: targetFamilyId
      });
      setSuccess(`Pomyślnie dołączono do rodziny o ID: ${targetFamilyId}`);
      setFamilyInputId('');
    } catch (err) {
      console.error('Error joining family:', err);
      const message = err instanceof Error ? err.message : 'Wystąpił błąd podczas dołączania do rodziny.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveFamily = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        currentFamilyId: user.uid
      });
      setSuccess('Powrócono do prywatnego konta.');
    } catch (err) {
      console.error('Error leaving family:', err);
      setError('Wystąpił błąd podczas opuszczania rodziny.');
    } finally {
      setIsLoading(false);
    }
  };

  const isPrivateAccount = userProfile.currentFamilyId === user.uid;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Ustawienia & Profil</h2>
        <p className="text-xs text-slate-500 mt-1">Zarządzaj swoim profilem oraz współdzieleniem bazy danych</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm shadow-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-650">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{userProfile.displayName}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Mail className="w-3.5 h-3.5" /> {userProfile.email}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Tryb Aplikacji:</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isPrivateAccount 
              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {isPrivateAccount ? 'Konto Prywatne' : 'Konto Współdzielone'}
          </span>
        </div>
      </div>

      {/* Copy IDs Box */}
      <div className="space-y-3">
        {/* User ID */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-250 shadow-sm shadow-slate-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-555 uppercase tracking-wider">Mój Numer ID Użytkownika</p>
            <p className="text-xs font-mono text-indigo-650 truncate mt-1">{userProfile.uid}</p>
          </div>
          <button
            onClick={() => handleCopy(userProfile.uid, 'userId')}
            className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border border-slate-100 cursor-pointer"
            title="Kopiuj ID Użytkownika"
          >
            {copiedType === 'userId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Family ID */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-250 shadow-sm shadow-slate-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-555 uppercase tracking-wider">Aktualny ID Rodziny</p>
            <p className="text-xs font-mono text-emerald-650 truncate mt-1">{userProfile.currentFamilyId}</p>
          </div>
          <button
            onClick={() => handleCopy(userProfile.currentFamilyId, 'familyId')}
            className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border border-slate-100 cursor-pointer"
            title="Kopiuj ID Rodziny"
          >
            {copiedType === 'familyId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Family Operations */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm shadow-slate-100">
        <div className="flex items-center gap-2 text-indigo-650">
          <Users className="w-5 h-5" />
          <h3 className="text-sm font-bold text-slate-800">Grupa Rodzinna</h3>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Join Family Form */}
        <form onSubmit={handleJoinFamily} className="space-y-3">
          <p className="text-xs text-slate-500">
            Aby połączyć się z kimś w rodzinę, poproś tę osobę o podanie jej numeru ID i wklej go poniżej:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={familyInputId}
              onChange={(e) => setFamilyInputId(e.target.value)}
              placeholder="Wklej ID innego użytkownika"
              disabled={isLoading}
              className="flex-grow pl-3 pr-3 py-2 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all disabled:opacity-50"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 font-bold text-xs text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              Dołącz
            </button>
          </div>
        </form>

        {/* Leave Family Action */}
        {!isPrivateAccount && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 mb-3">
              Jesteś podłączony do innej rodziny. W każdej chwili możesz ją opuścić i wrócić do bazy prywatnej.
            </p>
            <button
              type="button"
              onClick={handleLeaveFamily}
              disabled={isLoading}
              className="w-full py-2.5 font-bold text-xs text-rose-600 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            >
              {isLoading ? 'Opuszczanie...' : 'Opuść rodzinę i wróć do bazy prywatnej'}
            </button>
          </div>
        )}
      </div>

      {/* Family Members List Card */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <Smile className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800">Członkowie Rodziny</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {members.length} {members.length === 1 ? 'osoba' : 'osoby'}
          </span>
        </div>

        {membersError ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{membersError}</span>
          </div>
        ) : loadingMembers ? (
          <div className="flex items-center justify-center py-4 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 mr-2" />
            Wczytywanie członków rodziny...
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const isMe = m.uid === user.uid;
              const isHost = m.uid === userProfile.currentFamilyId;
              return (
                <div key={m.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-55 border border-slate-200/40">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {m.displayName} {isMe && <span className="text-indigo-650 font-bold">(Ty)</span>}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{m.email}</p>
                  </div>
                  <div className="shrink-0 pl-2">
                    {isHost ? (
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Gospodarz
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-650 border border-slate-200 px-2 py-0.5 rounded-full">
                        Członek
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logout button */}
      <div className="pt-2">
        <button
          onClick={() => signOutUser()}
          className="w-full py-3 px-4 flex justify-center items-center gap-2 font-bold text-slate-700 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-sm shadow-sm"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          Wyloguj się
        </button>
      </div>
    </div>
  );
};
