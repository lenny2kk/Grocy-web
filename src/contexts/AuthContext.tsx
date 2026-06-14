import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  currentFamilyId: string;
  createdAt: FieldValue | Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Unsubscribe from previous profile listener if exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(currentUser);
      setProfileError(null);

      if (currentUser) {
        setLoading(true);
        const userDocRef = doc(db, 'users', currentUser.uid);

        try {
          // 1. Automatyczny Fallback / Samonaprawa profilu (Zrzut ekranu 2026-06-14 o 17.50.11.jpg)
          const docSnap = await getDoc(userDocRef);
          
          if (!docSnap.exists()) {
            console.log('Profil nie istnieje w bazie Firestore dla użytkownika, automatyczna naprawa:', currentUser.uid);
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Użytkownik',
              currentFamilyId: currentUser.uid, // Domyślnie własne ID jako rodzina prywatna
              createdAt: serverTimestamp(),
            });
            console.log('Profil został pomyślnie utworzony w tle dla użytkownika:', currentUser.uid);
          }

          // 2. Rejestracja subskrypcji w czasie rzeczywistym
          unsubscribeProfile = onSnapshot(userDocRef, (profileSnap) => {
            if (profileSnap.exists()) {
              setUserProfile(profileSnap.data() as UserProfile);
              setProfileError(null);
            } else {
              setUserProfile(null);
              setProfileError('Profil użytkownika nie istnieje w bazie Firestore.');
            }
            setLoading(false);
          }, (error) => {
            console.error('Error listening to user profile changes:', error);
            setProfileError(`Błąd pobierania profilu z Firestore (Permission Denied / Security Rules). Szczegóły: ${error.message}`);
            setLoading(false);
          });
        } catch (error: any) {
          console.error('Error in user profile verification/creation flow:', error);
          setProfileError(`Błąd weryfikacji lub tworzenia profilu w Firestore: ${error.message}`);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setProfileError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setProfileError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Create a profile in Firestore, setting currentFamilyId to uid (private by default)
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        uid,
        email,
        displayName,
        currentFamilyId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setProfileError(null);
    try {
      await signOut(auth);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    profileError,
    signIn,
    signUp,
    signOutUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
