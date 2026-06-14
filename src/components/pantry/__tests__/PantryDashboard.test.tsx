import { render, screen, act, fireEvent } from '@testing-library/react';
import { PantryDashboard } from '../PantryDashboard';
import { useAuth } from '../../../contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('PantryDashboard', () => {
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
    
    // Default mock of useAuth to return logged in user
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user123' } as any,
      userProfile: mockUserProfile,
      loading: false,
      profileError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOutUser: vi.fn(),
    });
  });

  it('renders loading state initially and listens to pantry changes', async () => {
    render(<PantryDashboard />);

    expect(screen.getByText('Ładowanie spiżarni...')).toBeInTheDocument();

    // Simulate snapshot update with items
    await act(async () => {
      (globalThis as any).triggerSnapshot([
        {
          id: 'item1',
          data: () => ({
            name: 'Mleko',
            quantity: 3,
            unit: 'szt.',
            minQuantity: 1,
          }),
        },
      ]);
    });

    expect(screen.queryByText('Ładowanie spiżarni...')).not.toBeInTheDocument();
    expect(screen.getByText('Mleko')).toBeInTheDocument();
    expect(screen.getByText(/Stan:/)).toHaveTextContent('3 szt.');
  });

  it('displays error if snapshot listening fails', async () => {
    render(<PantryDashboard />);

    await act(async () => {
      (globalThis as any).triggerSnapshotError(new Error('Permission Denied'));
    });

    expect(screen.getByText(/Błąd pobierania danych ze spiżarni \(Firestore\): Permission Denied/)).toBeInTheDocument();
  });

  it('allows adding a new product successfully', async () => {
    mocks.addDoc.mockResolvedValueOnce({ id: 'new-product-id' });

    render(<PantryDashboard />);

    // Trigger initial snapshot (empty list)
    await act(async () => {
      (globalThis as any).triggerSnapshot([]);
    });

    // Fill the add product form
    const nameInput = screen.getByPlaceholderText('np. Mleko, Ryż');
    const quantityInput = screen.getByPlaceholderText('1');
    const unitSelect = screen.getByRole('combobox');
    const submitButton = screen.getByText('Dodaj do spiżarni');

    fireEvent.change(nameInput, { target: { value: 'Chleb' } });
    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.change(unitSelect, { target: { value: 'opak.' } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Verify addDoc call
    expect(mocks.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/pantry' }),
      expect.objectContaining({
        name: 'Chleb',
        quantity: 2,
        unit: 'opak.',
        minQuantity: 0,
      })
    );

    // Inputs are reset
    expect(nameInput).toHaveValue('');
  });

  it('handles addition error robustly inside try-catch-finally resetting loading', async () => {
    // Force addDoc to throw an error
    const firebaseError = new Error('Firestore write forbidden');
    mocks.addDoc.mockRejectedValueOnce(firebaseError);

    render(<PantryDashboard />);

    // Trigger initial empty list snapshot
    await act(async () => {
      (globalThis as any).triggerSnapshot([]);
    });

    const nameInput = screen.getByPlaceholderText('np. Mleko, Ryż');
    const submitButton = screen.getByText('Dodaj do spiżarni');

    fireEvent.change(nameInput, { target: { value: 'Chleb' } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Check if error is caught and displayed
    expect(screen.getByText(/Wystąpił błąd podczas dodawania do spiżarni: Firestore write forbidden/)).toBeInTheDocument();
    
    // Check if loader is reset (the button is enabled and loader is not shown)
    expect(submitButton).not.toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument(); // Loader icon should not be active
  });

  it('blocks product addition and displays error when currentFamilyId is missing', async () => {
    // Modify profile to have no family ID
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user123' } as any,
      userProfile: { ...mockUserProfile, currentFamilyId: '' },
      loading: false,
      profileError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOutUser: vi.fn(),
    });

    render(<PantryDashboard />);

    const nameInput = screen.getByPlaceholderText('np. Mleko, Ryż');
    const submitButton = screen.getByText('Dodaj do spiżarni');

    fireEvent.change(nameInput, { target: { value: 'Chleb' } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Verify error is shown and Firestore addDoc was blocked
    expect(screen.getAllByText(/Brak przypisanego identyfikatora rodziny/)[0]).toBeInTheDocument();
    expect(mocks.addDoc).not.toHaveBeenCalled();
  });

  it('updates quantity and deletes item correctly', async () => {
    mocks.updateDoc.mockResolvedValueOnce(undefined);
    mocks.deleteDoc.mockResolvedValueOnce(undefined);

    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PantryDashboard />);

    // Load list with one item
    await act(async () => {
      (globalThis as any).triggerSnapshot([
        {
          id: 'item-to-edit',
          data: () => ({
            name: 'Mleko',
            quantity: 3,
            unit: 'szt.',
            minQuantity: 1,
          }),
        },
      ]);
    });

    // Plus and minus buttons are present
    const plusButton = screen.getByTitle('Zwiększ');
    const minusButton = screen.getByTitle('Zmniejsz');
    const deleteButton = screen.getByTitle('Usuń');

    // Test increase qty
    await act(async () => {
      fireEvent.click(plusButton);
    });
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/pantry/item-to-edit' }),
      { quantity: 4 }
    );

    // Test decrease qty
    await act(async () => {
      fireEvent.click(minusButton);
    });
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/pantry/item-to-edit' }),
      { quantity: 2 }
    );

    // Test deletion
    await act(async () => {
      fireEvent.click(deleteButton);
    });
    expect(mocks.deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/pantry/item-to-edit' })
    );
  });
});
