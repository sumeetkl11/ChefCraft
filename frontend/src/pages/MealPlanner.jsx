import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Plus, X, ChefHat, Check, ShoppingCart, Flame } from 'lucide-react';
import Navbar from '../components/Navbar';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getSocket, initializeSocket } from '../services/socket';

// Native date helpers (replaces date-fns)
const startOfWeek = (d) => { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); s.setHours(0,0,0,0); return s; };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const formatDate = (d, fmt) => {
    const pad = (n) => String(n).padStart(2, '0');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const tokens = {
        MMMM: months[d.getMonth()],
        MMM: monthsShort[d.getMonth()],
        MM: pad(d.getMonth() + 1),
        EEEE: days[d.getDay()],
        yyyy: String(d.getFullYear()),
        dd: pad(d.getDate()),
        d: String(d.getDate())
    };
    return fmt.replace(/MMMM|MMM|MM|EEEE|yyyy|dd|d/g, (match) => tokens[match]);
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MealPlanner = () => {
    const navigate = useNavigate();
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [mealPlan, setMealPlan] = useState({});
    const [recipes, setRecipes] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cookedMealIds, setCookedMealIds] = useState(new Set());
    const [cookingMealId, setCookingMealId] = useState(null);
    const [syncingList, setSyncingList] = useState(false);

    useEffect(() => {
        fetchMealPlan();
        fetchRecipes();

        const handleMealPlanUpdate = (payload) => {
            if (payload?.action === 'delete') {
                // Optimistically remove from local state without re-fetching
                setMealPlan((prev) => {
                    const updated = { ...prev };
                    for (const date of Object.keys(updated)) {
                        for (const type of Object.keys(updated[date])) {
                            if (updated[date][type]?.id === payload.id) {
                                const newDay = { ...updated[date] };
                                delete newDay[type];
                                updated[date] = newDay;
                            }
                        }
                    }
                    return updated;
                });
            } else {
                fetchMealPlan();
            }
        };

        let activeSocket = getSocket();
        let cleanedUp = false;

        const setupSocket = (sock) => {
            if (!sock || cleanedUp) return;
            sock.on('mealplan:update', handleMealPlanUpdate);
        };

        if (activeSocket) {
            setupSocket(activeSocket);
        } else {
            initializeSocket().then((sock) => {
                activeSocket = sock;
                setupSocket(sock);
            }).catch(() => {});
        }

        return () => {
            cleanedUp = true;
            if (activeSocket) {
                activeSocket.off('mealplan:update', handleMealPlanUpdate);
            }
        };
    }, [weekStart]);

    const fetchMealPlan = async () => {
        try {
            const startDate = formatDate(weekStart, 'yyyy-MM-dd');
            const response = await api.get('/meal-plans/weekly', { params: { start_date: startDate } });
            const rawMeals = response.data?.data?.mealPlans ?? response.data?.data;
            const meals = Array.isArray(rawMeals) ? rawMeals : [];

            // organize meals by date and meal type
            const organized = {};
            meals.forEach(meal => {
                const dateKey = String(meal.meal_date || '').slice(0, 10);
                if (!dateKey) return;
                if (!organized[dateKey]) {
                    organized[dateKey] = {};
                }
                organized[dateKey][meal.meal_type] = meal;
            });

            setMealPlan(organized);
        } catch (error) {
            console.error('Error loading meal plan', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecipes = async () => {
        try {
            const response = await api.get('/recipes');
            const rawRecipes = response.data?.data?.recipes ?? response.data?.data;
            setRecipes(Array.isArray(rawRecipes) ? rawRecipes : []);
        } catch (error) {
            console.error('Error fetching recipes:', error);
            setRecipes([]);
        }
    };

    const handleAddMeal = (date, mealType) => {
        setSelectedSlot({ date, mealType });
        setShowAddModal(true);
    };

    const handleSyncShoppingList = async () => {
        if (syncingList) return;
        try {
            setSyncingList(true);
            const startDate = formatDate(weekStart, 'yyyy-MM-dd');
            const endDate = formatDate(addDays(weekStart, 6), 'yyyy-MM-dd');
            const res = await api.post('/shopping-list/generate', { startDate, endDate });
            api.clearCache('shopping-list');
            const items = res.data?.data?.items || [];
            toast.success(`Synced ${items.length} missing ingredient(s) to Shopping List!`);
            navigate('/shopping-list');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to sync shopping list');
        } finally {
            setSyncingList(false);
        }
    };

    const handleCookMeal = async (meal) => {
        if (!meal?.recipe_id || cookingMealId === meal.id) return;
        try {
            setCookingMealId(meal.id);
            const res = await api.post('/meal-plans/cook', {
                recipeId: meal.recipe_id,
                mealPlanId: meal.id
            });
            api.clearCache('pantry');
            api.clearCache('user/dashboard-summary');
            const info = res.data?.data;
            const count = info?.totalMatched || 0;
            const streakDays = info?.streak?.current_streak;
            setCookedMealIds((prev) => new Set(prev).add(meal.id));
            toast.success(
                count > 0
                    ? `Cooked! Auto-deducted ${count} pantry item(s)${streakDays ? ` • 🔥 ${streakDays}d streak` : ''}`
                    : `Marked "${meal.recipe_name}" as cooked!${streakDays ? ` • 🔥 ${streakDays}d streak` : ''}`
            );
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to mark meal as cooked');
        } finally {
            setCookingMealId(null);
        }
    };

    const handleRemoveMeal = async (mealId) => {
        if (!confirm('Remove this meal from your plan?')) return;

        // Optimistic UI update
        setMealPlan((prev) => {
            const updated = { ...prev };
            for (const date of Object.keys(updated)) {
                for (const type of Object.keys(updated[date])) {
                    if (updated[date][type]?.id === mealId) {
                        const newDay = { ...updated[date] };
                        delete newDay[type];
                        updated[date] = newDay;
                    }
                }
            }
            return updated;
        });

        try {
            await api.delete(`/meal-plans/${mealId}`);
            toast.success('Meal removed');
        } catch (error) {
            toast.error('Failed to remove meal');
            fetchMealPlan(); // Revert on error
        }
    };

    const getDayMeals = (dayIndex) => {
        const date = formatDate(addDays(weekStart, dayIndex), 'yyyy-MM-dd');
        return mealPlan[date] || {};
    };

    const getDayNutrition = (dayIndex) => {
        const dayMealsObj = getDayMeals(dayIndex);
        return Object.values(dayMealsObj).reduce(
            (acc, meal) => ({
                calories: acc.calories + (Number(meal.calories) || 0),
                protein: acc.protein + (Number(meal.protein) || 0),
                carbs: acc.carbs + (Number(meal.carbs) || 0),
                fat: acc.fat + (Number(meal.fat) || 0)
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    };

    const weeklyNutrition = DAYS_OF_WEEK.reduce(
        (acc, _, idx) => {
            const d = getDayNutrition(idx);
            return {
                calories: acc.calories + d.calories,
                protein: acc.protein + d.protein,
                carbs: acc.carbs + d.carbs,
                fat: acc.fat + d.fat
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return (
        <div className="page-bg min-h-screen">
            <Navbar />

            <div className="mx-auto px-4 py-8 sm:px-6 max-w-[1400px] relative">
                {/* Decorative blobs behind main container */}
                <div className="absolute top-20 right-10 w-[500px] h-[500px] bg-orange-400/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
                <div className="absolute top-[40%] left-10 w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

                {/* Header */}
                <div className="page-hero glass-panel mb-8 rounded-[32px] p-8 overflow-hidden relative shadow-lg shadow-amber-500/5">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col gap-6 md:flex-row md:items-center justify-between relative z-10">
                        <div>
                            <div className="eyebrow mb-4">
                                <CalendarIcon className="h-4 w-4" />
                                Weekly Overview
                            </div>
                            <h1 className="font-display text-4xl text-slate-900">Meal Planner</h1>
                        </div>

                        {/* Week Navigation & Shopping Sync */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleSyncShoppingList}
                                disabled={syncingList}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-medium shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                {syncingList ? 'Syncing...' : 'Sync to Shopping List'}
                            </button>
                            <button
                                onClick={() => setWeekStart(addDays(weekStart, -7))}
                                className="px-4 py-2.5 bg-white/40 border border-white/60 text-slate-700 rounded-full hover:bg-white/60 font-medium transition-all backdrop-blur-sm"
                            >
                                Previous Week
                            </button>
                            <button
                                onClick={() => setWeekStart(startOfWeek(new Date()))}
                                className="px-5 py-2.5 bg-gradient-to-br from-amber-500 to-orange-600 hover:scale-105 text-white rounded-full font-medium shadow-md shadow-orange-500/20 transition-all border border-transparent"
                            >
                                This Week
                            </button>
                            <button
                                onClick={() => setWeekStart(addDays(weekStart, 7))}
                                className="px-4 py-2.5 bg-white/40 border border-white/60 text-slate-700 rounded-full hover:bg-white/60 font-medium transition-all backdrop-blur-sm"
                            >
                                Next Week
                            </button>
                        </div>
                    </div>
                </div>

                {/* Week Display */}
                <div className="glass-card mb-8 p-5 text-center bg-white/40 border border-white/60 backdrop-blur-md">
                    <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">Week of</p>
                    <p className="text-2xl font-display text-slate-900 mt-1">
                        {formatDate(weekStart, 'MMMM d')} - {formatDate(addDays(weekStart, 6), 'MMMM d, yyyy')}
                    </p>
                </div>

                {/* Calendar Grid */}
                <div className="glass-card overflow-hidden bg-white/40 border border-white/60 backdrop-blur-md">
                    {/* Header Row */}
                    <div className="grid grid-cols-8 border-b border-white/40 bg-white/30 backdrop-blur-sm">
                        <div className="p-4 font-semibold text-slate-700 border-r border-white/40 flex items-center justify-center">
                            Meal
                        </div>
                        {DAYS_OF_WEEK.map((day, index) => {
                            const dayNutr = getDayNutrition(index);
                            return (
                                <div key={day} className="p-4 text-center border-r border-white/40 last:border-r-0">
                                    <div className="font-semibold text-slate-900">{day.substring(0,3)}</div>
                                    <div className="text-sm text-slate-500 font-medium">
                                        {formatDate(addDays(weekStart, index), 'MMM d')}
                                    </div>
                                    {dayNutr.calories > 0 && (
                                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-[11px] font-semibold">
                                            <Flame className="w-3 h-3 text-amber-600" />
                                            {dayNutr.calories} kcal
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Meal Rows */}
                    {MEAL_TYPES.map(mealType => (
                        <div key={mealType} className="grid grid-cols-8 border-b border-white/40 last:border-b-0">
                            <div className="p-4 font-semibold text-slate-700 capitalize border-r border-white/40 bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                {mealType}
                            </div>
                            {DAYS_OF_WEEK.map((_, dayIndex) => {
                                const date = formatDate(addDays(weekStart, dayIndex), 'yyyy-MM-dd');
                                const dayMeals = getDayMeals(dayIndex);
                                const meal = dayMeals[mealType];

                                return (
                                    <div
                                        key={dayIndex}
                                        className="p-3 border-r border-white/40 last:border-r-0 min-h-[120px] hover:bg-white/50 transition-colors"
                                    >
                                        {meal ? (
                                            <div className="relative group h-full">
                                                <div className={`border rounded-xl p-3 h-full flex flex-col items-center justify-center shadow-sm backdrop-blur-md transition-colors ${cookedMealIds.has(meal.id) ? 'bg-emerald-400/25 border-emerald-400/40' : 'bg-gradient-to-br from-amber-300/40 to-orange-400/20 border-amber-300/30'}`}>
                                                    <p className="text-sm font-semibold text-amber-950 text-center line-clamp-3">
                                                        {meal.recipe_name}
                                                    </p>
                                                    {Number(meal.calories) > 0 && (
                                                        <span className="mt-1 text-[11px] font-medium text-amber-900/75">
                                                            {meal.calories} kcal • {meal.protein || 0}g P
                                                        </span>
                                                    )}
                                                    {cookedMealIds.has(meal.id) && (
                                                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                                            Cooked ✓
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCookMeal(meal)}
                                                        disabled={cookingMealId === meal.id}
                                                        title="Mark as Cooked & Auto-Deduct Pantry Ingredients"
                                                        className="absolute -top-2 -left-2 p-1.5 bg-emerald-500 rounded-full hover:bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md scale-75 group-hover:scale-100 disabled:opacity-50"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMeal(meal.id)}
                                                        title="Remove from Meal Plan"
                                                        className="absolute -top-2 -right-2 p-1.5 bg-rose-500 rounded-full hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md scale-75 group-hover:scale-100"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleAddMeal(date, mealType)}
                                                className="w-full h-full flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-white/60 rounded-xl transition-all group border-2 border-dashed border-white/40 hover:border-amber-400/50"
                                            >
                                                <Plus className="w-6 h-6 mb-1" />
                                                <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Add</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Stats & Weekly Nutrition Summary */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-card bg-white/40 border border-white/60 p-5 backdrop-blur-md">
                        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Meals Planned</p>
                        <p className="text-3xl font-display text-slate-900 mt-1">
                            {Object.values(mealPlan).reduce((acc, day) => acc + Object.keys(day).length, 0)}
                        </p>
                    </div>
                    <div className="glass-card bg-white/40 border border-white/60 p-5 backdrop-blur-md">
                        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Total Recipes</p>
                        <p className="text-3xl font-display text-slate-900 mt-1">{recipes.length}</p>
                    </div>
                    <div className="glass-card bg-white/40 border border-white/60 p-5 backdrop-blur-md">
                        <p className="text-sm font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-amber-600" />
                            Weekly Calories
                        </p>
                        <p className="text-3xl font-display text-slate-900 mt-1">
                            {weeklyNutrition.calories.toLocaleString()} <span className="text-base font-normal text-slate-500">kcal</span>
                        </p>
                    </div>
                    <div className="glass-card bg-white/40 border border-white/60 p-5 backdrop-blur-md">
                        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Weekly Macros</p>
                        <div className="flex items-center justify-between mt-2 text-sm font-semibold text-slate-800">
                            <span>{weeklyNutrition.protein}g Protein</span>
                            <span>•</span>
                            <span>{weeklyNutrition.carbs}g Carbs</span>
                            <span>•</span>
                            <span>{weeklyNutrition.fat}g Fat</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Meal Modal */}
            {showAddModal && selectedSlot && (
                <AddMealModal
                    date={selectedSlot.date}
                    mealType={selectedSlot.mealType}
                    recipes={recipes}
                    onClose={() => {
                        setShowAddModal(false);
                        setSelectedSlot(null);
                    }}
                    onSuccess={(newMeal) => {
                        // Add to local state
                        const updatedPlan = { ...mealPlan };
                        const date = selectedSlot.date;
                        if (!updatedPlan[date]) {
                            updatedPlan[date] = {};
                        }
                        updatedPlan[date][selectedSlot.mealType] = newMeal;
                        setMealPlan(updatedPlan);
                        setShowAddModal(false);
                        setSelectedSlot(null);
                    }}
                />
            )}
        </div>
    );
};

const AddMealModal = ({ date, mealType, recipes, onClose, onSuccess }) => {
    const [selectedRecipe, setSelectedRecipe] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = recipes.filter(recipe =>
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRecipe) {
            toast.error('Please select a recipe');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/meal-plans', {
                recipeId: selectedRecipe,
                planned_date: date,
                meal_type: mealType
            });
            toast.success('Meal added to plan');
            onSuccess(response.data.data?.mealPlan);
        } catch (error) {
            const message = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to add meal';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Add Meal</h2>
                        <p className="text-sm text-gray-600 capitalize">
                            {formatDate(new Date(date + 'T00:00:00'), 'EEEE, MMM d')} - {mealType}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Search */}
                    <div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search recipes..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                    </div>

                    {/* Recipe List */}
                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                        {filteredRecipes.length > 0 ? (
                            filteredRecipes.map(recipe => (
                                <label
                                    key={recipe.id}
                                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedRecipe === recipe.id
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="recipe"
                                        value={recipe.id}
                                        checked={selectedRecipe === recipe.id}
                                        onChange={(e) => setSelectedRecipe(e.target.value)}
                                        className="w-4 h-4 text-emerald-500 border-gray-300 focus:ring-emerald-500"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{recipe.name}</p>
                                        {recipe.cuisine_type && (
                                            <p className="text-xs text-gray-500">{recipe.cuisine_type}</p>
                                        )}
                                    </div>
                                </label>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">No recipes found</p>
                            </div>
                        )}
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
                            disabled={loading || !selectedRecipe}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Meal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MealPlanner;
