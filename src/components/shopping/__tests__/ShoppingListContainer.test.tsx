import { render, screen, act, fireEvent } from '@testing-library/react';
import { ShoppingListContainer } from '../ShoppingListContainer';
import { useAuth } from '../../../contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('ShoppingListContainer', () => {
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

  it('renders and switches between Private and Family lists', async () => {
    render(<ShoppingListContainer />);

    // Load initial empty list
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', []);
    });
    await act(async () => {
      (globalThis as any).triggerSnapshot('private_shopping_list', []);
    });

    const privateTabBtn = screen.getByText('Prywatna');
    const familyTabBtn = screen.getByText('Rodzinna');

    expect(privateTabBtn).toHaveClass('bg-white'); // Active by default
    expect(familyTabBtn).not.toHaveClass('bg-white');

    // Switch to Family list
    await act(async () => {
      fireEvent.click(familyTabBtn);
    });

    expect(familyTabBtn).toHaveClass('bg-white');
    expect(privateTabBtn).not.toHaveClass('bg-white');
  });

  it('adds product directly if it does NOT exist in the pantry', async () => {
    mocks.addDoc.mockResolvedValueOnce({ id: 'doc-1' });

    render(<ShoppingListContainer />);

    // Trigger snapshot for pantry list (empty)
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', []);
    });
    
    // Trigger shopping list snapshot (empty)
    await act(async () => {
      (globalThis as any).triggerSnapshot('private_shopping_list', []);
    });

    const nameInput = screen.getByPlaceholderText('np. Chleb, Masło');
    const submitButton = screen.getByText('Dodaj pozycję');

    fireEvent.change(nameInput, { target: { value: 'Masło' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mocks.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user123/private_shopping_list' }),
      expect.objectContaining({ name: 'Masło', quantity: 1, checked: false })
    );
  });

  it('shows confirmation and adds product if it exists in the pantry and user clicks OK', async () => {
    mocks.addDoc.mockResolvedValueOnce({ id: 'doc-2' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ShoppingListContainer />);

    // 1. Pantry has 'Masło'
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', [
        {
          id: 'pantry-item-1',
          data: () => ({ name: 'Masło' }),
        },
      ]);
    });

    // 2. Shopping list is empty
    await act(async () => {
      (globalThis as any).triggerSnapshot('private_shopping_list', []);
    });

    const nameInput = screen.getByPlaceholderText('np. Chleb, Masło');
    const submitButton = screen.getByText('Dodaj pozycję');

    fireEvent.change(nameInput, { target: { value: 'Masło' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Masz już ten produkt w spiżarni'));
    expect(mocks.addDoc).toHaveBeenCalled();
  });

  it('shows confirmation and skips adding if it exists in the pantry and user clicks Cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ShoppingListContainer />);

    // 1. Pantry has 'Masło'
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', [
        {
          id: 'pantry-item-1',
          data: () => ({ name: 'Masło' }),
        },
      ]);
    });

    // 2. Shopping list is empty
    await act(async () => {
      (globalThis as any).triggerSnapshot('private_shopping_list', []);
    });

    const nameInput = screen.getByPlaceholderText('np. Chleb, Masło');
    const submitButton = screen.getByText('Dodaj pozycję');

    fireEvent.change(nameInput, { target: { value: 'Masło' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(mocks.addDoc).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue(''); // Field is cleared
  });

  it('performs checkout (transfers checked items to pantry) successfully', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Mock getDocs to simulate pantry fetch during checkout
    const mockPantryDocs = [
      {
        id: 'pantry-chleb-id',
        data: () => ({ name: 'Chleb', quantity: 2, unit: 'szt.' }),
      },
    ];
    mocks.getDocs.mockResolvedValueOnce({
      forEach: (callback: any) => mockPantryDocs.forEach(callback),
    });

    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    mocks.writeBatch.mockReturnValue(mockBatch);

    render(<ShoppingListContainer />);

    // 1. Trigger pantry snapshot
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', []);
    });

    // 2. Trigger shopping list snapshot with one checked item ('Chleb', quantity 3)
    await act(async () => {
      (globalThis as any).triggerSnapshot('private_shopping_list', [
        {
          id: 'shop-chleb-id',
          data: () => ({ name: 'Chleb', quantity: 3, unit: 'szt.', checked: true }),
        },
      ]);
    });

    const checkoutButton = screen.getByText(/Kupione:/);

    await act(async () => {
      fireEvent.click(checkoutButton);
    });

    // Verify batch operations
    // 'Chleb' already exists in pantry (2 szt.) and we bought 3 szt.
    // It should update doc in pantry to quantity 5 (2 + 3)
    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/pantry/pantry-chleb-id' }),
      { quantity: 5 }
    );
    // It should delete item from shopping list
    expect(mockBatch.delete).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user123/private_shopping_list/shop-chleb-id' })
    );
    // It should commit the batch
    expect(mockBatch.commit).toHaveBeenCalled();
  });
});
