import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getIngredientImage } from '../utils/ingredientImageHelper';
import { CATEGORY_FALLBACKS } from '../data/ingredientImages';

const CATEGORIES = ['Vegetables', 'Fruits', 'Dairy', 'Proteins', 'Grains', 'Spices', 'Other'];
const UNITS = ['pieces', 'kg', 'g', 'lbs', 'oz', 'ml', 'l', 'cups', 'tbsp', 'tsp', 'pack', 'can', 'bottle'];

const CATEGORY_ICONS = {
  'Vegetables': 'eco',
  'Fruits': 'nutrition',
  'Dairy': 'water_drop', // fallback to something similar to dairy
  'Proteins': 'set_meal',
  'Grains': 'grain',
  'Spices': 'shutter_speed',
  'Other': 'category'
};

const Pantry = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const fetchPantryItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/pantry');
      setItems(response.data.data.items || []);
    } catch (error) {
      toast.error('Error loading pantry items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPantryItems();
  }, [fetchPantryItems]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory]);

  const filterItems = () => {
    let result = [...items];

    if (searchQuery) {
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory === 'Expiring Soon') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      result = result.filter(item => {
        if (!item.expiry_date) return false;
        const exp = new Date(item.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const days = Math.round((exp - now) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 7;
      });
    } else if (selectedCategory !== 'All') {
      result = result.filter(item => item.category === selectedCategory);
    }

    // Default sort by expiry
    result.sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date) - new Date(b.expiry_date);
    });

    setFilteredItems(result);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await api.delete(`/pantry/${id}`);
      const updatedItems = items.filter(item => item.id !== id);
      setItems(updatedItems);
      setFilteredItems(updatedItems.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      }));
      toast.success('Item deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Error deleting item');
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiringItemsList = items.filter(item => {
    if (!item.expiry_date) return false;
    const expiryDate = new Date(item.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);
    const days = Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  });
  const expiringCount = expiringItemsList.length;

  const expiredCount = items.filter(item => {
    if (!item.expiry_date) return false;
    const expiryDate = new Date(item.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);
    return expiryDate < today;
  }).length;

  return (
    <div className="page-bg bg-background text-on-surface font-body-md min-h-screen relative overflow-hidden">
      {/* Background Blobs */}
      <div className="cc-bg-blob bg-primary w-96 h-96 -top-20 -left-20 opacity-30"></div>
      <div className="cc-bg-blob bg-tertiary w-[500px] h-[500px] bottom-0 right-0 opacity-20"></div>

      <Navbar />

      <main className="px-4 md:px-10 max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: Pantry Inventory */}
        <section className="lg:col-span-8">
          <div className="cc-glass-panel rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Your Pantry</h1>
              <div className="flex items-center gap-3">
                <div className="relative flex-grow min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                  <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/30 border border-white/50 rounded-full text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                    placeholder="Search ingredients..." 
                    type="text"
                  />
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-primary text-white px-4 md:px-6 py-2 rounded-full font-label-md flex items-center gap-2 shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Add Item
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8 no-scrollbar">
              <button 
                onClick={() => setSelectedCategory('All')}
                className={`px-5 py-2 rounded-full font-label-md whitespace-nowrap transition-all border border-transparent ${selectedCategory === 'All' ? 'bg-primary text-white shadow-md' : 'cc-glass-pill text-on-surface-variant hover:bg-white/60'}`}
              >
                All
              </button>
              {expiringCount > 0 && (
                <button 
                  onClick={() => setSelectedCategory('Expiring Soon')}
                  className={`px-5 py-2 rounded-full font-label-md whitespace-nowrap transition-all border border-amber-400/50 ${selectedCategory === 'Expiring Soon' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50/70 text-amber-800 hover:bg-amber-100'}`}
                >
                  ⏳ Expiring Soon ({expiringCount})
                </button>
              )}
              {CATEGORIES.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2 rounded-full font-label-md whitespace-nowrap transition-all border border-transparent ${selectedCategory === cat ? 'bg-primary text-white shadow-md' : 'cc-glass-pill text-on-surface-variant hover:bg-white/60'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Pantry Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="cc-glass-pill h-48 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                  <PantryItemCard 
                    key={item.id} 
                    item={item} 
                    onEdit={() => setEditingItem(item)}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant border-2 border-dashed border-primary/20 rounded-2xl bg-white/30">
                <span className="material-symbols-outlined text-4xl mb-2 text-primary/40">inventory_2</span>
                <p>No pantry items found.</p>
                {searchQuery || selectedCategory !== 'All' ? (
                  <button onClick={() => {setSearchQuery(''); setSelectedCategory('All')}} className="mt-2 text-primary underline text-sm">Clear filters</button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Quick Stats */}
        <aside className="lg:col-span-4">
          <div className="cc-glass-panel rounded-3xl p-6 md:p-8 sticky top-24">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-6">Quick Stats</h2>
            
            <div className="space-y-6">
              {/* Total Items Stat */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/60">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">inventory_2</span>
                </div>
                <div>
                  <p className="text-label-sm text-outline">Total Items</p>
                  <p className="font-display-lg text-2xl font-bold text-on-surface">{items.length}</p>
                </div>
              </div>

              {/* Expiring Soon Stat */}
              <div 
                onClick={() => expiringCount > 0 && setSelectedCategory(selectedCategory === 'Expiring Soon' ? 'All' : 'Expiring Soon')}
                className={`flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/60 ${expiringCount > 0 ? 'cursor-pointer hover:bg-amber-50/50 transition-colors' : ''}`}
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined">running_with_errors</span>
                </div>
                <div>
                  <p className="text-label-sm text-outline">Expiring Soon (7 Days)</p>
                  <p className="font-display-lg text-2xl font-bold text-amber-600">{expiringCount}</p>
                </div>
              </div>

              {/* Expired Stat */}
              {expiredCount > 0 && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-error-container/40 border border-error/20">
                  <div className="w-12 h-12 rounded-xl bg-error/20 flex items-center justify-center text-error">
                    <span className="material-symbols-outlined">warning</span>
                  </div>
                  <div>
                    <p className="text-label-sm text-error/80">Expired</p>
                    <p className="font-display-lg text-2xl font-bold text-error">{expiredCount}</p>
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="space-y-3 mt-4">
                {expiringCount > 0 && (
                  <button 
                    onClick={() => {
                      const names = expiringItemsList.map(i => i.name).join(', ');
                      toast.success(`Prioritizing expiring items: ${names}`);
                      navigate('/generate', { state: { usePantry: true, expiringIngredients: expiringItemsList.map(i => i.name) } });
                    }}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <span className="material-symbols-outlined">schedule</span>
                    Cook With Expiring ({expiringCount})
                  </button>
                )}
                <button 
                  onClick={() => navigate('/generate', { state: { usePantry: true } })}
                  className="w-full py-3.5 rounded-2xl border-2 border-primary/20 text-primary font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">auto_awesome</span>
                  Generate Meal Plan
                </button>
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
                >
                  <span className="material-symbols-outlined">storefront</span>
                  Buy / Sell on Marketplace
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {showAddModal && (
        <ItemModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchPantryItems}
        />
      )}

      {editingItem && (
        <ItemModal 
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={fetchPantryItems}
        />
      )}

    </div>
  );
};

const PantryItemCard = ({ item, onEdit, onDelete }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let expiryDate = null;
  if (item.expiry_date) {
    expiryDate = new Date(item.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);
  }

  const daysUntilExpiry = expiryDate ? Math.round((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = expiryDate && expiryDate < today;
  const isSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 5;
  const icon = CATEGORY_ICONS[item.category] || 'category';

  let statusBadge = null;
  if (isExpired) {
    statusBadge = <div className="absolute top-2 right-2 bg-error/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-sm">Expired</div>;
  } else if (isSoon) {
    statusBadge = <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-sm">Soon</div>;
  } else {
    statusBadge = <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-sm">Fresh</div>;
  }

  return (
    <div className="cc-glass-pill rounded-2xl p-4 flex flex-col gap-4 hover:translate-y-[-4px] transition-transform border border-white/50 group relative">
      <div className="h-32 w-full rounded-xl overflow-hidden relative bg-white/40 flex items-center justify-center">
        {/* Real ingredient photo */}
        <img 
          src={getIngredientImage(item.name, item.category)} 
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = CATEGORY_FALLBACKS[item.category] || CATEGORY_FALLBACKS.Other;
          }}
        />
        {statusBadge}
        {/* Action overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }} 
            className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }} 
            className="w-8 h-8 rounded-full bg-white text-error flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-headline-md text-label-md text-on-surface truncate pr-2" title={item.name}>{item.name}</h3>
          <p className="text-label-sm text-outline">{item.category}</p>
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-auto">
        <span className="font-label-md text-on-surface-variant">{item.quantity} {item.unit}</span>
        <span className={`text-label-sm flex items-center gap-1 ${isExpired ? 'text-error font-medium' : isSoon ? 'text-amber-600 font-medium' : 'text-outline'}`}>
          <span className="material-symbols-outlined text-sm">schedule</span>
          {isExpired ? 'Expired' : daysUntilExpiry !== null ? `${daysUntilExpiry} days left` : 'No date'}
        </span>
      </div>
    </div>
  );
};

const ItemModal = ({ item, onClose, onSuccess }) => {
  const isEditing = !!item;
  const [formData, setFormData] = useState({
    name: item?.name || '',
    quantity: item?.quantity || '',
    unit: item?.unit || 'pieces',
    category: item?.category || 'Other',
    expiry_date: item?.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : '',
    is_running_low: item?.is_running_low || false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedQuantity = parseFloat(formData.quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('Quantity must be a valid positive number');
      return;
    }
    if (!formData.expiry_date) {
      toast.error('Expiry date is required');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await api.put(`/pantry/${item.id}`, { ...formData, quantity: parsedQuantity });
        toast.success('Item updated');
      } else {
        await api.post('/pantry', { ...formData, quantity: parsedQuantity });
        toast.success('Item added');
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="cc-glass-panel rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="font-headline-md text-2xl text-on-surface mb-6">{isEditing ? 'Edit Item' : 'Add Item'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-on-surface outline-none focus:border-primary focus:bg-white/80 transition-all"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-on-surface outline-none focus:border-primary focus:bg-white/80 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-on-surface outline-none focus:border-primary focus:bg-white/80 transition-all appearance-none"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-on-surface outline-none focus:border-primary focus:bg-white/80 transition-all appearance-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Expiry Date</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-on-surface outline-none focus:border-primary focus:bg-white/80 transition-all"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border-2 border-outline-variant text-on-surface-variant font-label-md hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 cc-cta-gradient py-3 rounded-2xl text-white font-label-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Pantry;
