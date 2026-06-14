import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

// Test consumer component
const TestConsumer: React.FC = () => {
  const { user, userProfile, loading, profileError, signIn, signUp, signOutUser } = useAuth();
  
  if (loading) return <div>Wczytywanie...</div>;
  
  return (
    <div>
      <div data-testid="user-email">{user?.email || 'brak'}</div>
      <div data-testid="profile-family">{userProfile?.currentFamilyId || 'brak'}</div>
      <div data-testid="profile-error">{profileError || 'brak'}</div>
      <button onClick={() => signIn('test@example.com', 'password')}>Zaloguj</button>
      <button onClick={() => signUp('test@example.com', 'password', 'Test User')}>Rejestruj</button>
      <button onClick={() => signOutUser()}>Wyloguj</button>
    </div>
  );
};

describe('AuthContext', () => {
  let mocks: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = (globalThis as any).firebaseMocks;
  });

  it('renders loading state initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText('Wczytywanie...')).toBeInTheDocument();
  });

  it('handles auth state changes and loads existing profile', async () => {
    // Mock getDoc to return an existing profile document
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        currentFamilyId: 'family123',
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Trigger onAuthStateChanged with a logged-in user
    await act(async () => {
      (globalThis as any).triggerAuthStateChange({
        uid: 'user123',
        email: 'test@example.com',
      });
    });

    // Trigger onSnapshot mock to simulate profile data loading
    await act(async () => {
      (globalThis as any).triggerSnapshot({
        exists: () => true,
        data: () => ({
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          currentFamilyId: 'family123',
        }),
      });
    });

    expect(screen.queryByText('Wczytywanie...')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('profile-family')).toHaveTextContent('family123');
  });

  it('performs profile self-repair when profile does not exist in Firestore', async () => {
    // Mock getDoc to return false (profile doesn't exist)
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
    });

    // Mock setDoc to succeed
    mocks.setDoc.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Trigger auth state change to logged-in
    await act(async () => {
      (globalThis as any).triggerAuthStateChange({
        uid: 'user123',
        email: 'test@example.com',
      });
    });

    // Verify self-repair was triggered
    expect(mocks.getDoc).toHaveBeenCalled();
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user123' }),
      expect.objectContaining({
        uid: 'user123',
        email: 'test@example.com',
        currentFamilyId: 'user123',
      })
    );

    // Trigger the real-time profile snapshot (simulating Firestore trigger after setDoc finishes)
    await act(async () => {
      (globalThis as any).triggerSnapshot({
        exists: () => true,
        data: () => ({
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'test',
          currentFamilyId: 'user123',
        }),
      });
    });

    expect(screen.queryByText('Wczytywanie...')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-family')).toHaveTextContent('user123');
  });

  it('handles sign in correctly', async () => {
    // Mock signInWithEmailAndPassword to succeed
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as any);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Set authLoading to false initially (user is logged out)
    await act(async () => {
      (globalThis as any).triggerAuthStateChange(null);
    });

    const signInButton = screen.getByText('Zaloguj');
    await act(async () => {
      signInButton.click();
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.any(Object),
      'test@example.com',
      'password'
    );
  });

  it('handles registration correctly and creates profile', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: {
        uid: 'user456',
        email: 'test@example.com',
      },
    } as any);
    mocks.setDoc.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Set logged out initially
    await act(async () => {
      (globalThis as any).triggerAuthStateChange(null);
    });

    const registerButton = screen.getByText('Rejestruj');
    await act(async () => {
      registerButton.click();
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.any(Object),
      'test@example.com',
      'password'
    );
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user456' }),
      expect.objectContaining({
        uid: 'user456',
        email: 'test@example.com',
        displayName: 'Test User',
        currentFamilyId: 'user456',
      })
    );
  });

  it('handles sign out correctly', async () => {
    vi.mocked(signOut).mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Simulate logged in first
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
    });
    await act(async () => {
      (globalThis as any).triggerAuthStateChange({
        uid: 'user123',
        email: 'test@example.com',
      });
    });

    // Trigger snapshot so loading becomes false and UI renders TestConsumer properly
    await act(async () => {
      (globalThis as any).triggerSnapshot({
        exists: () => true,
        data: () => ({
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          currentFamilyId: 'family123',
        }),
      });
    });

    const signOutButton = screen.getByText('Wyloguj');
    await act(async () => {
      signOutButton.click();
    });

    expect(signOut).toHaveBeenCalled();
  });
});
