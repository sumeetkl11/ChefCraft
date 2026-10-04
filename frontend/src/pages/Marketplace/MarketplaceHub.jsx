import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../components/Navbar';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  MapPin, 
  ChevronRight, 
  X, 
  Check, 
  CreditCard, 
  Truck, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  ReceiptText
} from 'lucide-react';
import { getIngredientImage } from '../../utils/ingredientImageHelper';
import { CATEGORY_FALLBACKS } from '../../data/ingredientImages';
import { MARKETPLACE_PRODUCTS, MARKETPLACE_CATEGORIES } from '../../data/marketplaceProducts';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function MarketplaceHub() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [addToPantry, setAddToPantry] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Derived state
  const filteredProducts = useMemo(() => {
    return MARKETPLACE_PRODUCTS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, searchQuery]);

  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryFee = subtotal > 500 ? 0 : (subtotal > 0 ? 40 : 0);
  const totalAmount = subtotal + deliveryFee;

  // Cart actions
  const addToCart = (product) => {
    setCart(prev => ({
      ...prev,
      [product.id]: {
        ...product,
        quantity: (prev[product.id]?.quantity || 0) + 1
      }
    }));
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId].quantity > 1) {
        newCart[productId].quantity -= 1;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const handleConfirmOrder = async (e) => {
    e?.preventDefault();
    if (!deliveryAddress.trim()) {
      toast.error('Please provide a delivery address');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsPlacingOrder(true);
    try {
      if (addToPantry) {
        const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const syncPromises = cartItems.map(item =>
          api.post('/pantry', {
            name: item.name,
            quantity: item.quantity,
            unit: 'pieces',
            category: item.category || 'Other',
            expiry_date: defaultExpiry
          }).catch(err => {
            console.warn(`Pantry auto-sync skipped for ${item.name}:`, err?.message);
          })
        );
        await Promise.allSettled(syncPromises);
      }

      toast.success(
        addToPantry 
          ? '🎉 Order placed! Items synced directly to your Pantry.' 
          : '🎉 Order placed successfully! Your groceries are on their way.'
      );
      setCart({});
      setIsCheckoutOpen(false);
      setDeliveryAddress('');
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Unable to complete order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-14">
      <Navbar />
      
      {/* Marketplace Header */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-center">
          <div className="w-full max-w-3xl relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-100/50 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-[#d70f64]/20 focus:border-[#d70f64] transition-colors shadow-sm text-sm"
              placeholder="Search for groceries, ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 relative items-start">
        
        {/* Left Sidebar - Categories */}
        <div className="hidden md:block col-span-2 space-y-1 sticky top-[140px]">
          <h3 className="font-bold text-slate-900 px-3 mb-4 uppercase tracking-wider text-sm">Categories</h3>
          {MARKETPLACE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat.id 
                  ? 'bg-[#d70f64]/10 text-[#d70f64]' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{cat.name}</span>
              {cat.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeCategory === cat.id ? 'bg-[#d70f64]/20 text-[#d70f64]' : 'bg-slate-100 text-slate-500'}`}>
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Center - Product Grid */}
        <div className="col-span-1 md:col-span-10 lg:col-span-7 pb-24 lg:pb-0">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">
              {activeCategory === 'all' ? 'Popular Items' : MARKETPLACE_CATEGORIES.find(c => c.id === activeCategory)?.name}
            </h2>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <span className="text-4xl mb-4 block">🔍</span>
              <h3 className="text-lg font-medium text-slate-900">No items found</h3>
              <p className="text-slate-500">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col">
                  {/* Discount Badge */}
                  {product.discount && (
                    <div className="absolute top-3 left-3 z-10 bg-[#d70f64] text-white text-xs font-bold px-2 py-1 rounded-md">
                      {product.discount} OFF
                    </div>
                  )}
                  
                  {/* Product Image */}
                  <div className="aspect-square bg-slate-50 rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                    <img 
                      src={getIngredientImage(product.name, product.category)} 
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = CATEGORY_FALLBACKS[product.category] || CATEGORY_FALLBACKS.Other;
                      }}
                    />
                  </div>
                  
                  {/* Product Details */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-slate-500 mb-2">{product.category}</p>
                    
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <div>
                        {product.discount && (
                          <span className="text-xs text-slate-400 line-through block mb-0.5">Rs. {product.originalPrice}</span>
                        )}
                        <span className="font-bold text-slate-900">Rs. {product.price}</span>
                      </div>
                      
                      {/* Add Button */}
                      {cart[product.id] ? (
                        <div className="flex items-center gap-3 bg-[#d70f64] text-white rounded-full p-1 shadow-sm">
                          <button onClick={() => removeFromCart(product.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold min-w-[12px] text-center">{cart[product.id].quantity}</span>
                          <button onClick={() => addToCart(product)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(product)}
                          className="w-8 h-8 rounded-full bg-slate-100 text-[#d70f64] flex items-center justify-center hover:bg-[#d70f64] hover:text-white transition-colors shadow-sm"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar - Cart */}
        <div className="hidden lg:block col-span-3 sticky top-[140px]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-140px)]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#d70f64]" />
                Your Cart
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {cartItems.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium text-sm">Your cart is empty</p>
                  <p className="text-slate-400 text-xs mt-1">Add items to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden shrink-0">
                        <img 
                          src={getIngredientImage(item.name, item.category)} 
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = CATEGORY_FALLBACKS[item.category] || CATEGORY_FALLBACKS.Other;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 truncate">{item.name}</h4>
                        <div className="text-[#d70f64] font-semibold text-sm mt-0.5">Rs. {item.price * item.quantity}</div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded-md transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold w-3 text-center">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center text-[#d70f64] hover:bg-white rounded-md transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer */}
            {cartItems.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4 text-sm font-medium">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">Rs. {subtotal}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full bg-[#d70f64] text-white font-bold py-3.5 px-4 rounded-xl hover:bg-[#b00c52] transition-colors shadow-lg shadow-[#d70f64]/30 flex items-center justify-between cursor-pointer active:scale-[0.99]"
                >
                  <span>Checkout</span>
                  <span className="bg-white/20 px-2 py-1 rounded-lg text-sm">Rs. {subtotal}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Cart Bar (Fixed Bottom) */}
        {cartItems.length > 0 && (
          <div className="lg:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-4 right-4 z-50">
            <button 
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-[#d70f64] text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl shadow-[#d70f64]/30 flex items-center justify-between cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <div className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold">
                  {totalItems}
                </div>
                <span>View Cart & Checkout</span>
              </div>
              <span>Rs. {subtotal}</span>
            </button>
          </div>
        )}
      </main>

      {/* Checkout Modal */}
      {isCheckoutOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative border border-slate-100 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[min(90vh,620px)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-[#d70f64] shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Checkout & Delivery</h2>
                  <p className="text-xs text-slate-500">{totalItems} {totalItems === 1 ? 'item' : 'items'} in your basket</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 pr-1 my-3 space-y-4 custom-scrollbar">
              {/* Order Items Preview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <ReceiptText className="w-3.5 h-3.5 text-[#d70f64]" />
                  Order Summary
                </h3>
                <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 divide-y divide-slate-100 max-h-32 overflow-y-auto custom-scrollbar">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                          src={getIngredientImage(item.name, item.category)} 
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = CATEGORY_FALLBACKS[item.category] || CATEGORY_FALLBACKS.Other;
                          }}
                        />
                        <div className="truncate">
                          <p className="font-medium text-slate-900 truncate text-xs sm:text-sm">{item.name}</p>
                          <p className="text-[11px] text-slate-400">Qty: {item.quantity} × Rs. {item.price}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900 shrink-0 ml-2 text-xs sm:text-sm">Rs. {item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#d70f64]" />
                  Delivery Address <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter house/flat number, building name, street, area..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#d70f64]/20 focus:border-[#d70f64] text-xs sm:text-sm transition-all resize-none"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#d70f64]" />
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-[#d70f64] bg-rose-50/40 text-slate-900 ring-2 ring-[#d70f64]/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Truck className={`w-3.5 h-3.5 ${paymentMethod === 'cod' ? 'text-[#d70f64]' : 'text-slate-400'}`} />
                      {paymentMethod === 'cod' && <Check className="w-3 h-3 text-[#d70f64]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold">Cash on Delivery</p>
                      <p className="text-[10px] text-slate-400">At doorstep</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'upi'
                        ? 'border-[#d70f64] bg-rose-50/40 text-slate-900 ring-2 ring-[#d70f64]/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Sparkles className={`w-3.5 h-3.5 ${paymentMethod === 'upi' ? 'text-[#d70f64]' : 'text-slate-400'}`} />
                      {paymentMethod === 'upi' && <Check className="w-3 h-3 text-[#d70f64]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold">UPI / QR</p>
                      <p className="text-[10px] text-slate-400">Instant scan</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#d70f64] bg-rose-50/40 text-slate-900 ring-2 ring-[#d70f64]/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <CreditCard className={`w-3.5 h-3.5 ${paymentMethod === 'card' ? 'text-[#d70f64]' : 'text-slate-400'}`} />
                      {paymentMethod === 'card' && <Check className="w-3 h-3 text-[#d70f64]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold">Card</p>
                      <p className="text-[10px] text-slate-400">Debit / Credit</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pantry Auto-Sync Checkbox */}
              <div 
                onClick={() => setAddToPantry(!addToPantry)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                  addToPantry
                    ? 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                  addToPantry ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                }`}>
                  {addToPantry && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">Auto-stock in My Pantry</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">Recommended</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Syncs purchased items into your digital Pantry for immediate AI recipe suggestions!
                  </p>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>Rs. {subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    Delivery Fee
                    {subtotal > 500 && (
                      <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.2 rounded">FREE</span>
                    )}
                  </span>
                  <span>{deliveryFee === 0 ? 'Rs. 0' : `Rs. ${deliveryFee}`}</span>
                </div>
                {subtotal > 0 && subtotal <= 500 && (
                  <p className="text-[10px] text-[#d70f64]">Add Rs. {500 - subtotal} more for free delivery!</p>
                )}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm sm:text-base">
                  <span>Total Amount</span>
                  <span className="text-[#d70f64]">Rs. {totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-xs sm:text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isPlacingOrder}
                className="flex-1 bg-[#d70f64] hover:bg-[#b00c52] text-white font-bold py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl transition-all shadow-lg shadow-[#d70f64]/25 flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-70 cursor-pointer active:scale-[0.99]"
              >
                {isPlacingOrder ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Order • Rs. {totalAmount}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
