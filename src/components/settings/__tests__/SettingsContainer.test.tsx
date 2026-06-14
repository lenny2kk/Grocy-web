import { render, screen, act, fireEvent } from '@testing-library/react';
import { SettingsContainer } from '../SettingsContainer';
import { useAuth } from '../../../contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('SettingsContainer', () => {
  let mocks: any;
  const mockUserProfile = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User',
    currentFamilyId: 'family123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = (globalThis as any).firebaseMocks;

    // Default useAuth mock
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user123' } as any,
      userProfile: mockUserProfile,
      loading: false,
      profileError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOutUser: vi.fn(),
    });

    // Mock clipboard writeText
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders settings details and allows copying user ID', async () => {
    render(<SettingsContainer />);

    // Trigger snapshot for family members list
    await act(async () => {
      (globalThis as any).triggerSnapshot([]);
    });

    expect(screen.getByText('Ustawienia & Profil')).toBeInTheDocument();
    expect(screen.getByText('user123')).toBeInTheDocument();

    const copyBtn = screen.getByTitle('Kopiuj ID Użytkownika');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('user123');
  });

  it('allows joining a family group successfully', async () => {
    mocks.updateDoc.mockResolvedValueOnce(undefined);

    render(<SettingsContainer />);

    // Load family members list
    await act(async () => {
      (globalThis as any).triggerSnapshot([]);
    });

    const joinInput = screen.getByPlaceholderText('Wklej ID innego użytkownika');
    const joinBtn = screen.getByText('Dołącz');

    fireEvent.change(joinInput, { target: { value: 'host-family-456' } });
    
    await act(async () => {
      fireEvent.click(joinBtn);
    });

    // Verify updateDoc changes currentFamilyId on user doc
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user123' }),
      { currentFamilyId: 'host-family-456' }
    );
  });

  it('allows leaving a family group successfully', async () => {
    mocks.updateDoc.mockResolvedValueOnce(undefined);

    render(<SettingsContainer />);

    // Load family members list
    await act(async () => {
      (globalThis as any).triggerSnapshot([]);
    });

    const leaveBtn = screen.getByText('Opuść rodzinę i wróć do bazy prywatnej');

    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    // Verify updateDoc reverts currentFamilyId back to user's uid
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user123' }),
      { currentFamilyId: 'user123' }
    );
  });

  it('renders family members list in real-time', async () => {
    // Override useAuth to set currentFamilyId matching user's UID (user123)
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user123' } as any,
      userProfile: {
        ...mockUserProfile,
        currentFamilyId: 'user123',
      },
      loading: false,
      profileError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOutUser: vi.fn(),
    });

    render(<SettingsContainer />);

    // Simulate onSnapshot update with two members: host (user123) and another member
    await act(async () => {
      (globalThis as any).triggerSnapshot([
        {
          id: 'user123',
          data: () => ({
            displayName: 'Gospodarz User',
            email: 'host@example.com',
            currentFamilyId: 'user123',
          }),
        },
        {
          id: 'another-user',
          data: () => ({
            displayName: 'Pomocnik User',
            email: 'helper@example.com',
            currentFamilyId: 'user123',
          }),
        },
      ]);
    });

    expect(screen.getByText('Członkowie Rodziny')).toBeInTheDocument();
    expect(screen.getByText('2 osoby')).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === 'Gospodarz User (Ty)')).toBeInTheDocument();
    expect(screen.getByText('Pomocnik User')).toBeInTheDocument();
    expect(screen.getByText('Gospodarz')).toBeInTheDocument();
    expect(screen.getByText('Członek')).toBeInTheDocument();
  });
});
