import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { User } from 'firebase/auth';

declare global {
  var triggerAuthStateChange: ((user: User | null) => void) | undefined;
  var triggerSnapshot: ((pathOrData: unknown, data?: unknown) => void) | undefined;
  var triggerSnapshotError: ((err: unknown) => void) | undefined;
  var firebaseMocks: {
    auth: { currentUser: User | null };
    onAuthStateChanged: ReturnType<typeof vi.fn>;
    doc: ReturnType<typeof vi.fn>;
    collection: ReturnType<typeof vi.fn>;
    getDoc: ReturnType<typeof vi.fn>;
    getDocs: ReturnType<typeof vi.fn>;
    setDoc: ReturnType<typeof vi.fn>;
    addDoc: ReturnType<typeof vi.fn>;
    updateDoc: ReturnType<typeof vi.fn>;
    deleteDoc: ReturnType<typeof vi.fn>;
    onSnapshot: ReturnType<typeof vi.fn>;
    writeBatch: ReturnType<typeof vi.fn>;
  };
}

// --- FIREBASE AUTH MOCKS ---
const mockAuth = {
  currentUser: null,
};

const mockOnAuthStateChanged = vi.fn((_authInstance, callback) => {
  // Save callback to call it manually in tests if needed
  globalThis.triggerAuthStateChange = callback;
  return () => {};
});

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(() => mockAuth),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: mockOnAuthStateChanged,
  };
});

// --- FIREBASE FIRESTORE MOCKS ---
const mockDb = {};

// Mock functions
const mockDoc = vi.fn((_database, collectionPath, ...segments) => {
  return {
    type: 'document',
    path: [collectionPath, ...segments].join('/'),
    id: segments[segments.length - 1] || 'mock-doc-id',
  };
});

const mockCollection = vi.fn((_database, ...segments) => {
  return {
    type: 'collection',
    path: segments.join('/'),
  };
});

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const snapshotListeners = new Map<string, (data: any) => void>(); // eslint-disable-line @typescript-eslint/no-explicit-any

const mockOnSnapshot = vi.fn((q, onNext, onError) => {
  const path = q?.path || '';
  if (path) {
    snapshotListeners.set(path, onNext);
  }

  globalThis.triggerSnapshot = (pathOrData: unknown, data?: unknown) => {
    if (data === undefined) {
      const allListeners = Array.from(snapshotListeners.values());
      if (allListeners.length > 0) {
        allListeners[allListeners.length - 1](pathOrData);
      }
      return;
    }
    
    const pathQuery = pathOrData as string;
    for (const [key, value] of snapshotListeners.entries()) {
      if (key.includes(pathQuery)) {
        value(data);
        return;
      }
    }
  };

  globalThis.triggerSnapshotError = (err: unknown) => {
    if (onError) onError(err);
  };

  return () => {
    if (path) {
      snapshotListeners.delete(path);
    }
  };
});

const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => mockDb),
    doc: mockDoc,
    collection: mockCollection,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    setDoc: mockSetDoc,
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    onSnapshot: mockOnSnapshot,
    query: vi.fn((ref, ..._constraints) => ref),
    orderBy: vi.fn(),
    where: vi.fn(),
    writeBatch: mockWriteBatch,
    serverTimestamp: vi.fn(() => new Date()),
  };
});

// Export mock references for easy access/manipulation in tests
globalThis.firebaseMocks = {
  auth: mockAuth,
  onAuthStateChanged: mockOnAuthStateChanged,
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  onSnapshot: mockOnSnapshot,
  writeBatch: mockWriteBatch,
};
