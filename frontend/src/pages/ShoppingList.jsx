import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, X, Check, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import toast from 'react-hot-toast';
import api from '../services/api'

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Grains', 'Spices', 'Beverages', 'Other'];

const ShoppingList = () => {
    const [items, setItems] = useState([]);
    const [groupedItems, setGroupedItems] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExpiryModal, setShowExpiryModal] = useState(false);
    const [expiryDate, setExpiryDate] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchShoppingList();
    }, []);

    const fetchShoppingList = async () => {
        try {
            const response = await api.get('/shopping-list?grouped=true');
            const grouped = response.data.data.items;
            // convert grouped format to flat array for easier manipulation
            
            const flatItems = [];
            grouped.forEach(group => {
                if (group && group.items && Array.isArray(group.items)) {
                    group.items.forEach(item => {
                        if (item) {
                            flatItems.push({
                                ...item,
                                category: group.category,
                                is_checked: item.is_checked || false
                            });
                        }
                    });
                }
            });
            setItems(flatItems);
            organizeByCategory(flatItems);
        } catch (error) {
            toast.error('Failed to load shopping list');
        } finally {
            setLoading(false);
        }
    };

    const organizeByCategory = (itemsList) => {
        const grouped = {};
        itemsList.forEach(item => {
            if (!item) return;
            const category = item.category || 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });
        setGroupedItems(grouped);
    };

    const handleToggleChecked = async (id) => {
        // UI toggle first for immediate feedback
        const updatedItems = items.map(item =>
            item && item.id === id ? { ...item, is_checked: !item.is_checked } : item
        ).filter(item => item);
        setItems(updatedItems);
        organizeByCategory(updatedItems);

        try {
            await api.put(`/shopping-list/${id}/toggle`);
        } catch (error) {
            toast.error('Failed to update item status');
        }
    };

    const handleDeleteItem = async (id) => {
        try {
            await api.delete(`/shopping-list/${id}`);
            const updatedItems = items.filter(item => item && item.id !== id);
            setItems(updatedItems);
            organizeByCategory(updatedItems);
            toast.success('Item removed');
        } catch (error) {
            toast.error('Failed to delete item');
        }
    };

    const handleClearChecked = async () => {
        if (!confirm('Remove all checked items?')) return;

        try {
            await api.delete('/shopping-list/clear/checked');
            const updatedItems = items.filter(item => item && !item.is_checked);
            setItems(updatedItems);
            organizeByCategory(updatedItems);
            toast.success('Checked items cleared');
        } catch (error) {
            toast.error('Failed to clear items');
        }
    };

    const handleQuickMoveToPantry = async () => {
        const checkedCount = items.filter(item => item && item.is_checked).length;
        if (checkedCount === 0) {
            toast.error('No items checked');
            return;
        }
        try {
            const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            await api.post('/shopping-list/add-to-pantry', { expiry_date: defaultExpiry });
            api.clearCache('pantry');
            api.clearCache('user/dashboard-summary');
            const updatedItems = items.filter(item => item && !item.is_checked);
            setItems(updatedItems);
            organizeByCategory(updatedItems);
            toast.success(`Moved ${checkedCount} bought item(s) straight to your Pantry!`);
        } catch (error) {
            toast.error('Failed to move items to pantry');
        }
    };

    const handleAddToPantry = async () => {
        const checkedCount = items.filter(item => item && item.is_checked).length;
        if (checkedCount === 0) {
            toast.error('No items checked');
            return;
        }

        // Open the expiry date modal instead of direct confirmation
        setShowExpiryModal(true);
    };

    const handleConfirmAddToPantry = async () => {
        if (!expiryDate) {
            toast.error('Expiry date is required');
            return;
        }

        try {
            await api.post('/shopping-list/add-to-pantry', { expiry_date: expiryDate });
            api.clearCache('pantry');
            api.clearCache('user/dashboard-summary');
            const updatedItems = items.filter(item => item && !item.is_checked);
            setItems(updatedItems);
            organizeByCategory(updatedItems);
            toast.success('Items added to pantry');
            setShowExpiryModal(false);
            setExpiryDate('');
        } catch (error) {
            toast.error('Failed to add items to pantry');
        }
    };

    if (loading ) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center h-96">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    const checkedCount = items.filter(item => item && item.is_checked).length;
    const totalCount = items.filter(item => item).length;

    return (
        <div className="page-bg min-h-screen">
            <Navbar />

            <div className="mx-auto px-4 py-8 sm:px-6 max-w-4xl relative">
                {/* Decorative blobs behind main container */}
                <div className="absolute top-20 right-10 w-[400px] h-[400px] bg-orange-400/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
                <div className="absolute top-[40%] left-10 w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

                {/* Header */}
                <div className="page-hero glass-panel mb-8 rounded-[32px] p-8 overflow-hidden relative shadow-lg shadow-amber-500/5">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="eyebrow mb-4">
                                <ShoppingCart className="h-4 w-4" />
                                Pantry Prep
                            </div>
                            <h1 className="text-4xl font-display text-slate-900">Shopping List</h1>
                            <p className="text-slate-600 mt-2 font-medium">
                                {totalCount > 0 ? `${checkedCount} of ${totalCount} items checked` : 'Your shopping list is empty'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                {totalCount > 0 && (
                    <div className="flex flex-wrap gap-3 mb-8">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white px-5 py-3 rounded-full font-medium shadow-md shadow-orange-500/20 transition-transform hover:scale-105 active:scale-95 border border-transparent"
                        >
                            <Plus className="w-5 h-5" />
                            Add Item
                        </button>
                        {checkedCount > 0 && (
                            <>
                                <button
                                    onClick={handleQuickMoveToPantry}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full font-semibold transition-all shadow-md shadow-emerald-600/20"
                                >
                                    <Check className="w-5 h-5" />
                                    1-Click Move to Pantry ({checkedCount})
                                </button>
                                <button
                                    onClick={handleAddToPantry}
                                    className="flex items-center gap-2 bg-white/40 border border-white/60 backdrop-blur-md text-amber-700 hover:bg-white/60 px-5 py-3 rounded-full font-semibold transition-all shadow-sm"
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    Set Custom Expiry
                                </button>
                                <button
                                    onClick={handleClearChecked}
                                    className="flex items-center gap-2 bg-white/40 border border-rose-200 backdrop-blur-md text-rose-600 hover:bg-rose-50 hover:border-rose-300 px-5 py-3 rounded-full font-semibold transition-all shadow-sm"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    Clear Checked
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Shopping List */}
                {totalCount > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(groupedItems).map(([category, categoryItems]) => (
                            <div key={category} className="glass-card overflow-hidden bg-white/40 border border-white/60 backdrop-blur-md shadow-[0_16px_40px_rgba(245,158,11,0.03)]">
                                <div className="bg-white/30 px-6 py-4 border-b border-white/60 backdrop-blur-sm">
                                    <h2 className="font-semibold text-amber-900 tracking-wider uppercase text-sm">{category}</h2>
                                </div>
                                <div className="divide-y divide-white/40">
                                    {categoryItems.map(item => (
                                        <ShoppingListItem
                                            key={item.id}
                                            item={item}
                                            onToggle={handleToggleChecked}
                                            onDelete={handleDeleteItem}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center bg-white/40 border border-white/60 backdrop-blur-md shadow-sm">
                        <ShoppingCart className="w-16 h-16 text-amber-500/40 mx-auto mb-4" />
                        <p className="text-slate-500 mb-6 font-medium">Your shopping list is empty</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white px-6 py-3 rounded-full font-medium transition-transform hover:scale-105 active:scale-95 shadow-md shadow-orange-500/20"
                        >
                            <Plus className="w-5 h-5" />
                            Add First Item
                        </button>
                    </div>
                )}
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <AddItemModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={(newItem) => {
                        // Add to local state
                        const updatedItems = [...items, newItem];
                        setItems(updatedItems);
                        organizeByCategory(updatedItems);
                        setShowAddModal(false);
                    }}
                />
            )}

            {/* Expiry Date Modal */}
            {showExpiryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Set Expiry Date</h2>
                            <button onClick={() => setShowExpiryModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="text-gray-600 mb-4">
                            Enter an expiry date for the items being added to your pantry.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                required
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowExpiryModal(false);
                                    setExpiryDate('');
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAddToPantry}
                                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Add to Pantry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ShoppingListItem = ({ item, onToggle, onDelete }) => {
    return (
        <div className="flex items-center gap-4 px-6 py-4 hover:bg-white/50 transition-colors group border-b border-white/20 last:border-b-0">
            <button
                onClick={() => onToggle(item.id)}
                className="shrink-0"
            >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${item.is_checked
                    ? 'bg-amber-500 border-amber-500 shadow-inner'
                    : 'border-white/60 hover:border-amber-400 bg-white/40 shadow-sm'
                    }`}>
                    {item.is_checked && <Check className="w-4 h-4 text-white" />}
                </div>
            </button>

            <div className="flex-1 min-w-0">
                <p className={`font-medium ${item.is_checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {item.ingredient_name}
                </p>
                <p className={`text-sm ${item.is_checked ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.quantity} {item.unit}
                    {item.from_meal_plan && (
                        <span className="ml-2 text-xs font-semibold text-amber-600 tracking-wide uppercase">• From meal plan</span>
                    )}
                </p>
            </div>

            <button
                onClick={() => onDelete(item.id)}
                className="shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};

const AddItemModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        ingredient_name: '',
        quantity: '',
        unit: 'pieces',
        category: 'Other'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);

        try {
            await api.post('/shopping-list', {
                ...formData,
                quantity: parseFloat(formData.quantity)
            });
            toast.success('Item added to shopping list');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Add Item</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                        <input
                            type="text"
                            value={formData.ingredient_name}
                            onChange={(e) => setFormData({ ...formData, ingredient_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                            <select
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            >
                                <option value="pieces">Pieces</option>
                                <option value="kg">Kilograms</option>
                                <option value="g">Grams</option>
                                <option value="l">Liters</option>
                                <option value="ml">Milliliters</option>
                                <option value="cups">Cups</option>
                                <option value="tbsp">Tablespoons</option>
                                <option value="tsp">Teaspoons</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShoppingList;
