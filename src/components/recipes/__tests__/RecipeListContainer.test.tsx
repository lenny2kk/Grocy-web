import { render, screen, act, fireEvent } from '@testing-library/react';
import { RecipeListContainer } from '../RecipeListContainer';
import { useAuth } from '../../../contexts/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('RecipeListContainer', () => {
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

  it('renders recipe list and handles new recipe creation', async () => {
    mocks.addDoc.mockResolvedValueOnce({ id: 'recipe-doc-id' });

    render(<RecipeListContainer />);

    // Trigger initial empty snapshots
    // 1. Pantry snapshot
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', []);
    });

    // 2. Recipes snapshot
    await act(async () => {
      (globalThis as any).triggerSnapshot('recipes', []);
    });

    expect(screen.getByText('Brak przepisów w bazie.')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('np. Spaghetti Bolognese');
    const descInput = screen.getByPlaceholderText('np. Ugotuj makaron, dodaj sos...');
    
    const ingNameInput = screen.getByPlaceholderText('Nazwa składnika (np. Makaron)');
    const ingQtyInput = screen.getByPlaceholderText('Ilość');
    const addIngBtn = screen.getByText('Dodaj składnik');

    fireEvent.change(nameInput, { target: { value: 'Spaghetti' } });
    fireEvent.change(descInput, { target: { value: 'Pyszne spaghetti' } });
    fireEvent.change(ingNameInput, { target: { value: 'Makaron' } });
    fireEvent.change(ingQtyInput, { target: { value: '500' } });

    await act(async () => {
      fireEvent.click(addIngBtn);
    });

    // Verify ingredient is in list
    expect(screen.getByText('Makaron')).toBeInTheDocument();

    const submitBtn = screen.getByText('Zapisz przepis');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mocks.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'families/family123/recipes' }),
      expect.objectContaining({
        name: 'Spaghetti',
        description: 'Pyszne spaghetti',
        ingredients: [{ name: 'Makaron', quantity: 500, unit: 'szt.' }],
      })
    );
  });

  it('performs Magic Cart copying with pantry check skips correctly', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    
    // Ingredient 1: 'Cebula' (exists in pantry, will click Cancel -> skip)
    // Ingredient 2: 'Makaron' (does not exist in pantry -> copy)
    confirmSpy.mockReturnValueOnce(false); // Cancel Cebula

    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    mocks.writeBatch.mockReturnValue(mockBatch);

    render(<RecipeListContainer />);

    // 1. Pantry snapshot has Cebula
    await act(async () => {
      (globalThis as any).triggerSnapshot('pantry', [
        {
          id: 'pantry-cebula-id',
          data: () => ({ name: 'Cebula' }),
        },
      ]);
    });

    // 2. Recipes list snapshot has Spaghetti recipe
    await act(async () => {
      (globalThis as any).triggerSnapshot('recipes', [
        {
          id: 'recipe-spaghetti-id',
          data: () => ({
            name: 'Spaghetti',
            description: 'Opis',
            ingredients: [
              { name: 'Cebula', quantity: 1, unit: 'szt.' },
              { name: 'Makaron', quantity: 1, unit: 'opak.' },
            ],
          }),
        },
      ]);
    });

    // Verify recipe is shown
    expect(screen.getByText('Spaghetti')).toBeInTheDocument();

    // Click cart icon to trigger Magic Cart modal
    const cartButton = screen.getByText('Dodaj do listy zakupów');
    await act(async () => {
      fireEvent.click(cartButton);
    });

    // Magic Cart modal should pop up
    expect(screen.getByText(/Gdzie dodać składniki/)).toBeInTheDocument();

    const familyListBtn = screen.getByText('Lista Rodzinna');

    await act(async () => {
      fireEvent.click(familyListBtn);
    });

    // Cebula should prompt a confirm and be cancelled (skipped)
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Cebula' znajduje się już w Twojej spiżarni"));
    
    // Only Makaron (not Cebula) should be copied to family list
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        name: 'Makaron',
        quantity: 1,
        unit: 'opak.',
      })
    );

    expect(mockBatch.commit).toHaveBeenCalled();
  });
});
