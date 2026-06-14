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
  const { userProfile } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [minQuantity, setMinQuantity] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!userProfile?.currentFamilyId) return;

    const pantryRef = collection(db, 'families', userProfile.currentFamilyId, 'pantry');
    const q = query(pantryRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      console.error('Error listening to pantry:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.currentFamilyId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userProfile?.currentFamilyId) return;

    const itemName = name.trim();
    const itemQty = parseFloat(quantity);
    const itemMinQty = parseFloat(minQuantity);

    if (!itemName) {
      setError('Nazwa produktu jest wymagana.');
      return;
    }

    if (isNaN(itemQty) || itemQty < 0) {
      setError('Ilość musi być liczbą nieujemną.');
      return;
    }

    setIsAdding(true);
    try {
      const pantryRef = collection(db, 'families', userProfile.currentFamilyId, 'pantry');
      await addDoc(pantryRef, {
        name: itemName,
        quantity: itemQty,
        unit: unit,
        minQuantity: isNaN(itemMinQty) ? 0 : itemMinQty,
      });

      // Reset form
      setName('');
      setQuantity('1');
      setMinQuantity('0');
    } catch (err: any) {
      console.error('Error adding to pantry:', err);
      setError('Wystąpił błąd podczas dodawania do spiżarni.');
    } finally {
      setIsAdding(false);
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
            className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 transition-all shadow-sm shadow-slate-100/40"
          />
        </div>
      </div>

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

          <form onSubmit={handleAddItem} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Nazwa Produktu
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Mleko, Ryż"
                className="w-full px-3 py-2 text-sm bg-slate-55 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block mb-1">
                  Ilość
                </label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 text-sm bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
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
                  className="w-full px-3 py-2 text-sm bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all cursor-pointer"
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
              <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block mb-1">
                Minimalna Ilość (Ostrzeżenie)
              </label>
              <input
                type="number"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-slate-55 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-650 transition-all"
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
              <p className="text-sm font-semibold">Brak produktów w spiżarni.</p>
              {search && <p className="text-xs text-slate-400 mt-1">Spróbuj zmienić zapytanie wyszukiwania.</p>}
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
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
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
