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
  orderBy 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  PackagePlus,
  Layers
} from 'lucide-react';

interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minQuantity: number;
}

export const PantryDashboard: React.FC = () => {
  const { userProfile, loading: authLoading, profileError } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Local operation states
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [minQuantity, setMinQuantity] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) return;

    // If auth completed but profile doesn't exist/can't be fetched
    if (!userProfile?.currentFamilyId || userProfile.currentFamilyId.trim() === '') {
      console.error('PantryDashboard: Missing or empty currentFamilyId', userProfile);
      setFirestoreError('Błąd: Brak przypisanego identyfikatora rodziny (currentFamilyId) w profilu użytkownika. Skonfiguruj grupę w Ustawieniach.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setFirestoreError(null);

    // Timeout fallback (5 seconds) to prevent infinite spinner if Firebase hangs
    const timeoutId = setTimeout(() => {
      setLoading((currLoading) => {
        if (currLoading) {
          console.warn('Pantry list loading timed out. Checking connection or Firestore initialization.');
          setFirestoreError('Przekroczono limit czasu połączenia z bazą Firestore. Sprawdź połączenie lub konsolę Firebase.');
          return false;
        }
        return currLoading;
      });
    }, 5000);

    let unsubscribe = () => {};

    try {
      const pantryRef = collection(db, 'families', userProfile.currentFamilyId, 'pantry');
      const q = query(pantryRef, orderBy('name', 'asc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        clearTimeout(timeoutId);
        const pantryList: PantryItem[] = [];
        snapshot.forEach((docSnap) => {
          pantryList.push({
            id: docSnap.id,
            ...docSnap.data()
          } as PantryItem);
        });
        setItems(pantryList);
        setLoading(false);
      }, (err) => {
        clearTimeout(timeoutId);
        console.error('Firestore onSnapshot error in PantryDashboard:', err);
        setFirestoreError(`Błąd pobierania danych ze spiżarni (Firestore): ${err.message}`);
        setLoading(false);
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Synchronous error setting up pantry subscription:', err);
      const message = err instanceof Error ? err.message : String(err);
      setFirestoreError(`Błąd inicjalizacji połączenia z Firestore: ${message}`);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [userProfile?.currentFamilyId, authLoading]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAdding(true);
    setLoading(true); // Ensure main loader or add loader is set while adding

    try {
      const familyId = userProfile?.currentFamilyId;
      
      // 2. Walidacja currentFamilyId przed wykonaniem addDoc/setDoc
      if (!familyId || familyId.trim() === '') {
        throw new Error('Brak przypisanego identyfikatora rodziny (currentFamilyId). Zarejestruj się ponownie lub dołącz do rodziny w zakładce Ustawienia.');
      }

      const itemName = name.trim();
      const itemQty = parseFloat(quantity);
      const itemMinQty = parseFloat(minQuantity);

      if (!itemName) {
        throw new Error('Nazwa produktu jest wymagana.');
      }

      if (isNaN(itemQty) || itemQty < 0) {
        throw new Error('Ilość musi być liczbą nieujemną.');
      }

      // Dane trafiają pod poprawną ścieżkę /families/${currentFamilyId}/pantry
      const pantryRef = collection(db, 'families', familyId, 'pantry');
      await addDoc(pantryRef, {
        name: itemName,
        quantity: itemQty,
        unit: unit,
        minQuantity: isNaN(itemMinQty) ? 0 : itemMinQty,
      });

      setName('');
      setQuantity('1');
      setMinQuantity('0');
    } catch (err) {
      console.error('Error adding product in handleCreateProduct:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Wystąpił błąd podczas dodawania do spiżarni: ${message}`);
    } finally {
      // 1. Zresetuj stan ładowania w bloku finally
      setIsAdding(false);
      setLoading(false);
    }
  };

  const handleUpdateQty = async (itemId: string, currentQty: number, change: number) => {
    if (!userProfile?.currentFamilyId) return;

    const newQty = Math.max(0, currentQty + change);
    try {
      const itemRef = doc(db, 'families', userProfile.currentFamilyId, 'pantry', itemId);
      await updateDoc(itemRef, {
        quantity: newQty
      });
    } catch (err) {
      console.error('Error updating quantity:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Nie udało się zmienić ilości: ${message}`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!userProfile?.currentFamilyId) return;
    if (!window.confirm('Czy na pewno chcesz usunąć ten produkt ze spiżarni?')) return;

    try {
      const itemRef = doc(db, 'families', userProfile.currentFamilyId, 'pantry', itemId);
      await deleteDoc(itemRef);
    } catch (err) {
      console.error('Error deleting item:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Nie udało się usunąć produktu: ${message}`);
    }
  };

  const getStatus = (item: PantryItem) => {
    if (item.quantity === 0) {
      return {
        label: 'Brak',
        className: 'bg-rose-50 text-rose-700 border border-rose-200',
        icon: <XCircle className="w-3.5 h-3.5" />
      };
    }
    if (item.quantity <= item.minQuantity) {
      return {
        label: 'Niski stan',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
        icon: <AlertTriangle className="w-3.5 h-3.5" />
      };
    }
    return {
      label: 'W porządku',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />
    };
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const displayError = profileError || firestoreError;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Spiżarnia</h2>
          <p className="text-xs text-slate-500 mt-1">Stan zapasów w Twoim gospodarstwie domowym</p>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj produktu..."
            className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-base text-slate-950 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-650 transition-all shadow-sm shadow-slate-100/40"
          />
        </div>
      </div>

      {/* Firestore or Profile Error Notification */}
      {displayError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm animate-fadeIn">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-bold text-slate-800">Błąd bazy danych Firebase</p>
            <p className="text-xs mt-1 font-mono text-rose-600 break-all">{displayError}</p>
            <p className="text-xs mt-2 text-slate-500 leading-normal">
              Upewnij się, że wgrałeś poprawne reguły zabezpieczeń Firestore (Firestore Security Rules) w konsoli Firebase. Stworzyłem dla Ciebie plik <code>firestore.rules</code> w głównym katalogu projektu z gotowymi regułami do skopiowania.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Add Product Form */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-4 lg:col-span-1 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <PackagePlus className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800">Dodaj Produkt</h3>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Nazwa Produktu
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Mleko, Ryż"
                className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
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
                  className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
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
                  className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all cursor-pointer"
                >
                  <option value="szt.">szt.</option>
                  <option value="l">l</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="opak.">opak.</option>
                </select>
              </div>
            </div>
 
            <div>
              <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider block mb-1">
                Minimalna Ilość (Ostrzeżenie)
              </label>
              <input
                type="number"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 text-base bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full mt-2 py-2.5 flex justify-center items-center font-bold text-xs text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-600/10"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dodaj do spiżarni'}
            </button>
          </form>
        </div>

        {/* Product List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
              Ładowanie spiżarni...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-300 rounded-2xl text-slate-400 bg-white shadow-sm">
              <Layers className="w-8 h-8 mx-auto text-slate-350 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Twoja spiżarnia jest pusta.</p>
              <p className="text-xs text-slate-500 mt-1">Dodaj pierwszy produkt, korzystając z formularza obok!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const status = getStatus(item);
                return (
                  <div 
                    key={item.id}
                    className="flex flex-col justify-between p-4 bg-white border border-slate-200/60 rounded-2xl hover:border-slate-300 shadow-sm shadow-slate-100/50 transition-all group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-800 truncate text-base">{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                            {status.icon}
                            {status.label}
                          </span>
                          {item.minQuantity > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              (Min: {item.minQuantity} {item.unit})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 md:opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3">
                      <span className="text-sm font-bold text-slate-600">
                        Stan: <span className="text-slate-900 font-extrabold">{item.quantity}</span> {item.unit}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-55 border border-slate-200 rounded-xl p-0.5">
                        <button
                          onClick={() => handleUpdateQty(item.id, item.quantity, -1)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                          disabled={item.quantity <= 0}
                          title="Zmniejsz"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateQty(item.id, item.quantity, 1)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Zwiększ"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
