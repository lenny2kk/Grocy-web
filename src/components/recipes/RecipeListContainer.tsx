/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Trash2, 
  Loader2,
  BookOpen,
  ShoppingCart,
  PlusCircle,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
}

export const RecipeListContainer: React.FC = () => {
  const { user, userProfile, loading: authLoading, profileError } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantryItems, setPantryItems] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Local operation states
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [currentIngName, setCurrentIngName] = useState('');
  const [currentIngQty, setCurrentIngQty] = useState('1');
  const [currentIngUnit, setCurrentIngUnit] = useState('szt.');

  // Modal / Selection for Magic Cart
  const [activeRecipeForCart, setActiveRecipeForCart] = useState<Recipe | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userProfile?.currentFamilyId) return;

    const pantryRef = collection(db, 'families', userProfile.currentFamilyId, 'pantry');
    const unsubscribe = onSnapshot(pantryRef, (snapshot) => {
      const list: { name: string }[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ name: docSnap.data().name || '' });
      });
      setPantryItems(list);
    }, (err) => {
      console.error('Error listening to pantry from RecipeListContainer:', err);
    });

    return () => unsubscribe();
  }, [userProfile?.currentFamilyId, authLoading]);

  useEffect(() => {
    if (authLoading) return;

    if (!userProfile?.currentFamilyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFirestoreError(null);

    const recipesRef = collection(db, 'families', userProfile.currentFamilyId, 'recipes');
    const q = query(recipesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recipesList: Recipe[] = [];
      snapshot.forEach((docSnap) => {
        recipesList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Recipe);
      });
      setRecipes(recipesList);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to recipes:', err);
      setFirestoreError(`Błąd pobierania przepisów (Firestore): ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.currentFamilyId, authLoading]);

  const handleAddIngredientRow = () => {
    const ingName = currentIngName.trim();
    const ingQty = parseFloat(currentIngQty);

    if (!ingName) return;
    if (isNaN(ingQty) || ingQty <= 0) return;

    setIngredients([
      ...ingredients,
      { name: ingName, quantity: ingQty, unit: currentIngUnit }
    ]);

    setCurrentIngName('');
    setCurrentIngQty('1');
  };

  const handleRemoveIngredientRow = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!userProfile?.currentFamilyId) return;

    const recipeName = name.trim();
    if (!recipeName) {
      setError('Nazwa przepisu jest wymagana.');
      return;
    }

    if (ingredients.length === 0) {
      setError('Dodaj przynajmniej jeden składnik.');
      return;
    }

    try {
      const recipesRef = collection(db, 'families', userProfile.currentFamilyId, 'recipes');
      await addDoc(recipesRef, {
        name: recipeName,
        description: description.trim(),
        ingredients: ingredients,
        createdAt: serverTimestamp()
      });

      setName('');
      setDescription('');
      setIngredients([]);
      setSuccessMsg('Pomyślnie dodano przepis!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error adding recipe:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Wystąpił błąd podczas zapisywania przepisu: ${message}`);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!userProfile?.currentFamilyId) return;
    if (!window.confirm('Czy na pewno chcesz usunąć ten przepis?')) return;

    try {
      const recipeRef = doc(db, 'families', userProfile.currentFamilyId, 'recipes', recipeId);
      await deleteDoc(recipeRef);
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  const handleMagicCopyIngredients = async (targetList: 'private' | 'family') => {
    if (!user || !userProfile || !activeRecipeForCart) return;

    setIsCopying(true);
    try {
      const batch = writeBatch(db);
      
      const targetColRef = targetList === 'private'
        ? collection(db, 'users', user.uid, 'private_shopping_list')
        : collection(db, 'families', userProfile.currentFamilyId, 'family_shopping_list');

      let copiedCount = 0;

      for (const ing of activeRecipeForCart.ingredients) {
        // Porównanie nazwy składnika z produktami w spiżarni (in-memory)
        const existsInPantry = pantryItems.some(
          (pantryItem) => pantryItem.name.trim().toLowerCase() === ing.name.trim().toLowerCase()
        );

        if (existsInPantry) {
          const confirmAdd = window.confirm(
            `Produkt '${ing.name}' znajduje się już w Twojej spiżarni. Czy na pewno chcesz dodać go do listy zakupów?`
          );
          if (!confirmAdd) {
            // Pomiń ten produkt
            continue;
          }
        }

        const docRef = doc(targetColRef);
        const data = {
          name: ing.name.trim(),
          quantity: ing.quantity,
          unit: ing.unit,
          checked: false,
          createdAt: serverTimestamp(),
          ...(targetList === 'family' ? { addedBy: userProfile.displayName || 'Członek rodziny' } : {})
        };

        batch.set(docRef, data);
        copiedCount++;
      }

      if (copiedCount > 0) {
        await batch.commit();
        setSuccessMsg(
          `Składniki z przepisu "${activeRecipeForCart.name}" zostały dodane do Twojej listy ${
            targetList === 'private' ? 'prywatnej' : 'rodzinnej'
          } (dodano ${copiedCount} z ${activeRecipeForCart.ingredients.length} składników)!`
        );
      } else {
        setSuccessMsg('Wszystkie składniki z przepisu znajdowały się już w spiżarni i zostały pominięte.');
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error copying ingredients:', err);
      alert('Wystąpił błąd podczas dodawania do listy zakupów.');
    } finally {
      setIsCopying(false);
      setActiveRecipeForCart(null);
    }
  };

  const displayError = profileError || firestoreError;

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Przepisy</h2>
        <p className="text-xs text-slate-500 mt-1">Stwórz bazę dań i jednym kliknięciem dodawaj składniki do zakupów</p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm animate-fadeIn">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Firestore or Profile Error Notification */}
      {displayError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm animate-fadeIn">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-bold text-slate-800">Wykryto błąd bazy danych Firebase</p>
            <p className="text-xs mt-1 font-mono text-rose-600 break-all">{displayError}</p>
            <p className="text-xs mt-2 text-slate-500 leading-normal">
              Upewnij się, że wgrałeś poprawne reguły zabezpieczeń Firestore (Firestore Security Rules) zezwalające zalogowanym użytkownikom na odczyt/zapis w ścieżkach <code>/users/&#123;userId&#125;</code> oraz <code>/families/&#123;familyId&#125;</code>.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Add Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form to Add Recipe */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 lg:col-span-1 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-2 text-indigo-650">
            <BookOpen className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800">Dodaj Przepis</h3>
          </div>

          <form onSubmit={handleAddRecipe} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Nazwa Przepisu
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Spaghetti Bolognese"
                className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block mb-1">
                Opis / Instrukcja (opcjonalnie)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="np. Ugotuj makaron, dodaj sos..."
                rows={2}
                className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all resize-none"
              />
            </div>

            {/* Sub-form: Add Ingredient to list */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">
                Dodaj Składnik do przepisu
              </label>
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={currentIngName}
                  onChange={(e) => setCurrentIngName(e.target.value)}
                  placeholder="Nazwa składnika (np. Makaron)"
                  className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={currentIngQty}
                    onChange={(e) => setCurrentIngQty(e.target.value)}
                    placeholder="Ilość"
                    className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all"
                  />
                  <select
                    value={currentIngUnit}
                    onChange={(e) => setCurrentIngUnit(e.target.value)}
                    className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all cursor-pointer"
                  >
                    <option value="szt.">szt.</option>
                    <option value="l">l</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="opak.">opak.</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="w-full py-1.5 flex justify-center items-center gap-1 bg-slate-55 border border-slate-200 text-indigo-605 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Dodaj składnik
                </button>
              </div>
            </div>

            {/* List of currently added ingredients */}
            {ingredients.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 space-y-1.5 max-h-36 overflow-y-auto">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Składniki w przepisie:</span>
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-white border border-slate-100 rounded-md">
                    <span className="text-slate-800 truncate pr-2 font-bold">{ing.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-500 font-extrabold">{ing.quantity} {ing.unit}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 flex justify-center items-center font-bold text-xs text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm shadow-indigo-600/10"
            >
              Zapisz przepis
            </button>
          </form>
        </div>

        {/* Recipe List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
              Ładowanie przepisów...
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-300 rounded-2xl text-slate-400 bg-white shadow-sm">
              <BookOpen className="w-8 h-8 mx-auto text-slate-355 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Brak przepisów w bazie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-white border border-slate-200/60 hover:border-slate-300 shadow-sm shadow-slate-100/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate">{recipe.name}</h4>
                      <button
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 transition-all cursor-pointer shrink-0"
                        title="Usuń przepis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {recipe.description && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                        {recipe.description}
                      </p>
                    )}
                    
                    {/* Ingredients detail */}
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Składniki:</span>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {recipe.ingredients?.map((ing, idx) => (
                          <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="truncate pr-2 font-bold">{ing.name}</span>
                            <span className="text-slate-500 font-extrabold shrink-0">{ing.quantity} {ing.unit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Magic Cart Button */}
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      onClick={() => setActiveRecipeForCart(recipe)}
                      className="w-full py-2.5 flex items-center justify-center gap-1.5 font-bold text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-600 border border-indigo-200/30 hover:border-indigo-550 hover:text-white transition-all cursor-pointer shadow-sm"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Dodaj do listy zakupów
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Magic Cart Selection Modal */}
      {activeRecipeForCart && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base leading-tight">Magiczny Koszyk</h3>
                <p className="text-xs text-slate-500 mt-1">Gdzie dodać składniki z przepisu: <strong>{activeRecipeForCart.name}</strong>?</p>
              </div>
              <button
                onClick={() => setActiveRecipeForCart(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleMagicCopyIngredients('private')}
                disabled={isCopying}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold text-slate-750 bg-slate-55 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Lista Prywatna
              </button>
              
              <button
                onClick={() => handleMagicCopyIngredients('family')}
                disabled={isCopying}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold text-white rounded-xl bg-indigo-650 hover:bg-indigo-600 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lista Rodzinna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
