import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Trash2, 
  User, 
  Users, 
  Loader2,
  ShoppingCart,
  CheckSquare,
  Square,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  addedBy?: string;
}

export const ShoppingListContainer: React.FC = () => {
  const { user, userProfile, loading: authLoading, profileError } = useAuth();
  const [activeTab, setActiveTab] = useState<'private' | 'family'>('private');
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [pantryItems, setPantryItems] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Local operation states
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const getListPath = () => {
    if (!user || !userProfile) return null;
    return activeTab === 'private'
      ? { ref: collection(db, 'users', user.uid, 'private_shopping_list'), type: 'private' }
      : { ref: collection(db, 'families', userProfile.currentFamilyId, 'family_shopping_list'), type: 'family' };
  };

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
      console.error('Error listening to pantry from ShoppingListContainer:', err);
    });

    return () => unsubscribe();
  }, [userProfile?.currentFamilyId, authLoading]);

  useEffect(() => {
    if (authLoading) return;

    const listInfo = getListPath();
    if (!listInfo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFirestoreError(null);

    const q = query(listInfo.ref, orderBy('checked', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shoppingList: ShoppingItem[] = [];
      snapshot.forEach((docSnap) => {
        shoppingList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as ShoppingItem);
      });
      setItems(shoppingList);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to shopping list:', err);
      setFirestoreError(`Błąd pobierania listy zakupów (Firestore): ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, userProfile?.currentFamilyId, authLoading]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const listInfo = getListPath();
    if (!listInfo || !user || !userProfile) return;

    const itemName = name.trim();
    const itemQty = parseFloat(quantity);

    if (!itemName) {
      setError('Nazwa produktu jest wymagana.');
      return;
    }

    if (isNaN(itemQty) || itemQty <= 0) {
      setError('Ilość musi być większa od zera.');
      return;
    }

    // Sprawdzenie czy produkt jest już w spiżarni (in-memory)
    const existsInPantry = pantryItems.some(
      (pantryItem) => pantryItem.name.trim().toLowerCase() === itemName.toLowerCase()
    );

    if (existsInPantry) {
      const confirmAdd = window.confirm(
        `Masz już ten produkt w spiżarni. Czy mimo to chcesz dodać go do listy zakupów?`
      );
      if (!confirmAdd) {
        setName('');
        return;
      }
    }

    setIsAdding(true);
    try {
      const data = {
        name: itemName,
        quantity: itemQty,
        unit: unit,
        checked: false,
        createdAt: serverTimestamp(),
        ...(listInfo.type === 'family' ? { addedBy: userProfile.displayName || 'Członek rodziny' } : {})
      };

      await addDoc(listInfo.ref, data);
      setName('');
      setQuantity('1');
    } catch (err) {
      console.error('Error adding to shopping list:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Wystąpił błąd podczas dodawania: ${message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleCheck = async (itemId: string, currentChecked: boolean) => {
    const listInfo = getListPath();
    if (!listInfo) return;

    try {
      const itemRef = doc(db, listInfo.ref.path, itemId);
      await updateDoc(itemRef, {
        checked: !currentChecked
      });
    } catch (err) {
      console.error('Error toggling check state:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const listInfo = getListPath();
    if (!listInfo) return;

    try {
      const itemRef = doc(db, listInfo.ref.path, itemId);
      await deleteDoc(itemRef);
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleCheckoutCheckedItems = async () => {
    const listInfo = getListPath();
    if (!listInfo || !userProfile?.currentFamilyId) return;

    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    if (!window.confirm(`Czy chcesz dodać te ${checkedItems.length} kupione produkty do swojej spiżarni i usunąć je z listy zakupów?`)) {
      return;
    }

    setIsCheckingOut(true);
    try {
      const pantryRef = collection(db, 'families', userProfile.currentFamilyId, 'pantry');
      const pantrySnap = await getDocs(pantryRef);
      const pantryItemsMap = new Map<string, { id: string, quantity: number }>();
      
      pantrySnap.forEach(pDoc => {
        const pData = pDoc.data();
        pantryItemsMap.set(pData.name.toLowerCase().trim(), {
          id: pDoc.id,
          quantity: pData.quantity || 0
        });
      });

      const batch = writeBatch(db);

      for (const item of checkedItems) {
        const normName = item.name.toLowerCase().trim();
        
        if (pantryItemsMap.has(normName)) {
          const existing = pantryItemsMap.get(normName)!;
          const targetRef = doc(db, 'families', userProfile.currentFamilyId, 'pantry', existing.id);
          batch.update(targetRef, {
            quantity: existing.quantity + item.quantity
          });
        } else {
          const newPantryDocRef = doc(collection(db, 'families', userProfile.currentFamilyId, 'pantry'));
          batch.set(newPantryDocRef, {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            minQuantity: 0
          });
        }

        const listDocRef = doc(db, listInfo.ref.path, item.id);
        batch.delete(listDocRef);
      }

      await batch.commit();
    } catch (err) {
      console.error('Error during checkout:', err);
      alert('Wystąpił błąd podczas przenoszenia produktów do spiżarni.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const displayError = profileError || firestoreError;

  return (
    <div className="space-y-6 animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Title */}
      <div className="shrink-0">
        <h2 className="text-xl font-extrabold text-slate-900">Lista Zakupów</h2>
        <p className="text-xs text-slate-500 mt-1">Zarządzaj artykułami do kupienia w czasie rzeczywistym</p>
      </div>

      {/* Selector Tabs */}
      <div className="flex p-1 bg-slate-100 border border-slate-200/80 rounded-xl shrink-0">
        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'private'
              ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          Prywatna
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'family'
              ? 'bg-white text-slate-900 border border-slate-200/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Rodzinna
        </button>
      </div>

      {/* Firestore or Profile Error Notification */}
      {displayError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm animate-fadeIn shrink-0">
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

      {/* Grid: Form & List */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
        {/* Form to add */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 lg:col-span-1 shadow-sm shadow-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-indigo-600">
            <ShoppingCart className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800">Dodaj do listy</h3>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleAddItem} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Nazwa artykułu
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Chleb, Masło"
                className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider block mb-1">
                  Ilość
                </label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider block mb-1">
                  Jednostka
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-655 transition-all cursor-pointer"
                >
                  <option value="szt.">szt.</option>
                  <option value="l">l</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="opak.">opak.</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full mt-2 py-2.5 flex justify-center items-center font-bold text-xs text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-600/10"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dodaj pozycję'}
            </button>
          </form>
        </div>

        {/* Items List */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-full overflow-hidden min-h-0">
          {items.some(i => i.checked) && (
            <button
              onClick={handleCheckoutCheckedItems}
              disabled={isCheckingOut}
              className="w-full py-2.5 px-4 flex justify-center items-center gap-2 font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Przenoszenie...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  Kupione: Przenieś zaznaczone do spiżarni
                </>
              )}
            </button>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(theme(spacing.24)+env(safe-area-inset-bottom))] md:pb-8 pr-1">
            {loading ? (
              <div className="flex justify-center items-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
                Ładowanie listy...
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-300 rounded-2xl text-slate-400 bg-white shadow-sm">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-350 mb-2" />
                <p className="text-sm font-semibold text-slate-800">Brak pozycji na tej liście zakupów.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      item.checked
                        ? 'bg-slate-100/60 border-slate-200/40 opacity-60 shadow-none'
                        : 'bg-white border-slate-200/60 hover:border-slate-300 shadow-sm shadow-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleCheck(item.id, item.checked)}
                        className="text-slate-400 hover:text-indigo-650 transition-colors cursor-pointer shrink-0"
                      >
                        {item.checked ? (
                          <CheckSquare className="w-5 h-5 text-indigo-650" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-350 hover:text-slate-450" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <span
                          className={`text-sm font-bold truncate block ${
                            item.checked ? 'line-through text-slate-400 font-medium' : 'text-slate-800'
                          }`}
                        >
                          {item.name}
                        </span>
                        {activeTab === 'family' && item.addedBy && (
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            Dodał(a): {item.addedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className={`text-xs font-bold ${item.checked ? 'text-slate-405' : 'text-slate-600'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 transition-colors cursor-pointer"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
