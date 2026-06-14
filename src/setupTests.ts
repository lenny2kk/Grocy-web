import '@testing-library/jest-dom';
import { vi } from 'vitest';

// --- FIREBASE AUTH MOCKS ---
const mockAuth = {
  currentUser: null,
};

const mockOnAuthStateChanged = vi.fn((_authInstance, callback) => {
  // Save callback to call it manually in tests if needed
  (globalThis as any).triggerAuthStateChange = callback;
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
const snapshotListeners = new Map<string, any>();

const mockOnSnapshot = vi.fn((q, onNext, onError) => {
  const path = q?.path || '';
  if (path) {
    snapshotListeners.set(path, onNext);
  }

  (globalThis as any).triggerSnapshot = (pathOrData: any, data?: any) => {
    if (data === undefined) {
      const allListeners = Array.from(snapshotListeners.values());
      if (allListeners.length > 0) {
        allListeners[allListeners.length - 1](pathOrData);
      }
      return;
    }
    
    const pathQuery = pathOrData;
    for (const [key, value] of snapshotListeners.entries()) {
      if (key.includes(pathQuery)) {
        value(data);
        return;
      }
    }
  };

  (globalThis as any).triggerSnapshotError = (err: any) => {
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
(globalThis as any).firebaseMocks = {
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
