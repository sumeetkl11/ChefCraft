import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRecipes: 0,
    pantryItems: 0,
    mealsThisWeek: 0
  });
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [upcomingMeals, setUpcomingMeals] = useState([]);
  const [popularPosts, setPopularPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (options = {}) => {
    const silent = options.silent && (recentRecipes.length > 0 || upcomingMeals.length > 0 || popularPosts.length > 0);
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const summaryRes = await api.get('/user/dashboard-summary', { ttl: 60000 });
        const summaryData = summaryRes.data?.data;
        if (summaryData) {
          if (summaryData.stats) {
            setStats((prev) => ({
              totalRecipes: summaryData.stats.totalRecipes ?? prev.totalRecipes,
              pantryItems: summaryData.stats.pantryItems ?? prev.pantryItems,
              mealsThisWeek: summaryData.stats.mealsThisWeek ?? prev.mealsThisWeek
            }));
          }
          if (Array.isArray(summaryData.recentRecipes)) {
            setRecentRecipes(summaryData.recentRecipes);
          }
          if (Array.isArray(summaryData.upcomingMeals)) {
            setUpcomingMeals(summaryData.upcomingMeals);
          }
          if (Array.isArray(summaryData.popularPosts)) {
            setPopularPosts(summaryData.popularPosts);
          }
          return;
        }
      } catch (summaryErr) {
        console.warn('Unified dashboard summary unavailable, falling back to individual endpoints:', summaryErr);
      }

      const results = await Promise.allSettled([
        api.get('/pantry/stats'),
        api.get('/meal-plans/stats'),
        api.get('/recipes/recent?limit=5'),
        api.get('/meal-plans/upcoming?limit=5'),
        api.get('/posts?limit=20&page=1')
      ]);

      const [pantryRes, mealsRes, recentRes, upcomingRes, postsRes] = results;

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        toast.error(`${failedCount} dashboard section(s) failed to load — showing available data`);
      }

      if (pantryRes.status === 'fulfilled' || mealsRes.status === 'fulfilled' || recentRes.status === 'fulfilled') {
        const pantryData = pantryRes.status === 'fulfilled' ? pantryRes.value.data?.data : null;
        const mealsData = mealsRes.status === 'fulfilled' ? mealsRes.value.data?.data : null;
        const recentData = recentRes.status === 'fulfilled' ? recentRes.value.data?.data : null;

        setStats((prev) => ({
          totalRecipes: recentData?.recipes?.length || prev.totalRecipes,
          pantryItems: pantryData?.total_items ?? prev.pantryItems,
          mealsThisWeek: mealsData?.stats?.this_week_count ?? prev.mealsThisWeek
        }));
      }

      if (recentRes.status === 'fulfilled') {
        const recipesList = recentRes.value.data?.data?.recipes || (Array.isArray(recentRes.value.data?.data) ? recentRes.value.data.data : []);
        setRecentRecipes(recipesList);
      }

      if (upcomingRes.status === 'fulfilled') {
        const mealsList = upcomingRes.value.data?.data?.meals || (Array.isArray(upcomingRes.value.data?.data) ? upcomingRes.value.data.data : []);
        setUpcomingMeals(mealsList);
      }

      if (postsRes.status === 'fulfilled') {
        const postsList = postsRes.value.data?.data || postsRes.value.data?.posts || [];
        if (Array.isArray(postsList)) {
          setPopularPosts(
            [...postsList]
              .sort((a, b) => {
                const scoreA = (a.like_count || 0) * 3 + (a.comment_count || 0);
                const scoreB = (b.like_count || 0) * 3 + (b.comment_count || 0);
                return scoreB - scoreA;
              })
              .slice(0, 4)
          );
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [popularPosts.length, recentRecipes.length, upcomingMeals.length]);

  useEffect(() => {
    void fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="page-bg bg-background text-on-surface font-body-md min-h-screen">
        <Navbar />
        <main className="px-4 md:px-10 max-w-[1200px] mx-auto animate-pulse">
          <div className="cc-glass-panel h-96 rounded-3xl mb-12"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="cc-glass-panel h-64 rounded-3xl"></div>
             <div className="cc-glass-panel h-64 rounded-3xl"></div>
             <div className="cc-glass-panel h-64 rounded-3xl"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-bg bg-background text-on-surface font-body-md min-h-screen relative overflow-hidden">
      {/* Background Blobs */}
      <div className="cc-bg-blob bg-slate-100 w-96 h-96 -top-20 -left-20 opacity-[0.06]"></div>
      <div className="cc-bg-blob bg-white w-[500px] h-[500px] bottom-0 right-0 opacity-[0.08]"></div>
      <div className="cc-bg-blob bg-slate-100/40 w-64 h-64 top-1/2 left-1/3 opacity-[0.04]"></div>

      <Navbar />

      <main className="px-4 md:px-10 max-w-[1200px] mx-auto relative z-10">
        
        {/* Hero Section */}
        <section className="mb-12">
          <div className="cc-glass-panel rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="font-display-lg text-display-lg mb-6 leading-tight">
                  Build dinner plans that look and feel <span style={{color: '#101828'}}>restaurant-ready</span>.
                </h1>
                <p className="text-on-surface-variant font-body-lg mb-8 max-w-md">
                  Your professional culinary workspace for organizing ingredients, discovering masterpieces, and sharing the art of food.
                </p>
                <div className="flex gap-4">
                  <Link to="/generate" className="bg-primary text-white font-label-md px-8 py-4 rounded-full shadow-[0_8px_24px_rgba(245,158,11,0.35)] hover:scale-105 transition-transform active:scale-95 inline-block text-center">
                    Start Generating
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stat Card 1 */}
                <Link to="/recipes" className="cc-glass-pill p-6 rounded-2xl flex flex-col gap-2 hover:translate-y-[-4px] transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant_menu</span>
                  <span className="font-display-lg text-3xl font-bold">{stats.totalRecipes}</span>
                  <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Saved Recipes</span>
                </Link>
                {/* Stat Card 2 */}
                <Link to="/pantry" className="cc-glass-pill p-6 rounded-2xl flex flex-col gap-2 hover:translate-y-[-4px] transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                  <span className="font-display-lg text-3xl font-bold">{stats.pantryItems}</span>
                  <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Pantry Items</span>
                </Link>
                {/* Stat Card 3 */}
                <Link to="/meal-plan" className="cc-glass-pill p-6 rounded-2xl flex flex-col gap-2 hover:translate-y-[-4px] transition-transform col-span-1 sm:col-span-2">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                      <span className="font-display-lg text-3xl font-bold">{stats.mealsThisWeek < 10 ? `0${stats.mealsThisWeek}` : stats.mealsThisWeek}</span>
                      <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Meals This Week</span>
                    </div>
                    <div className="h-16 w-32 flex items-end gap-1 px-2">
                      <div className="w-full bg-primary/20 rounded-t-sm h-1/2"></div>
                      <div className="w-full bg-primary/40 rounded-t-sm h-3/4"></div>
                      <div className="w-full bg-primary rounded-t-sm h-full"></div>
                      <div className="w-full bg-primary/60 rounded-t-sm h-2/3"></div>
                      <div className="w-full bg-primary/30 rounded-t-sm h-1/3"></div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
            {/* Abstract visual element */}
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          </div>
        </section>

        {/* Bento Grid Panels */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Recipes */}
          <div className="cc-glass-panel p-6 rounded-3xl flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">Recent Recipes</h2>
              <Link to="/recipes" className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">arrow_forward</Link>
            </div>
            <div className="space-y-4">
              {recentRecipes.length > 0 ? (
                <>
                  {/* First item is large */}
                  <Link to={`/recipes/${recentRecipes[0].id}`} className="block group cursor-pointer">
                    <div className="relative h-40 w-full rounded-2xl overflow-hidden mb-3 bg-white/40 flex items-center justify-center">
                      {recentRecipes[0].image_url ? (
                        <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={recentRecipes[0].image_url} alt={recentRecipes[0].name} loading="eager" decoding="async" fetchPriority="high" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-primary/30">restaurant</span>
                      )}
                      <div className="absolute top-3 right-3 cc-glass-pill px-3 py-1 rounded-full text-xs font-bold text-on-surface">
                        {(recentRecipes[0].prep_time || 0) + (recentRecipes[0].cook_time || 0)} MIN
                      </div>
                    </div>
                    <h3 className="font-label-md text-lg group-hover:text-primary transition-colors">{recentRecipes[0].name}</h3>
                    <p className="text-sm text-on-surface-variant truncate">{recentRecipes[0].description || 'Fresh from your collection'}</p>
                  </Link>

                  {/* Remaining items are small list items */}
                  {recentRecipes.slice(1, 3).map((recipe) => (
                    <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="flex items-center gap-4 cc-glass-pill p-3 rounded-xl hover:bg-white/40 transition-colors cursor-pointer border-transparent hover:border-white/40">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/40 flex items-center justify-center">
                        {recipe.image_url ? (
                          <img className="w-full h-full object-cover" src={recipe.image_url} alt={recipe.name} loading="lazy" decoding="async" />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-primary/30">restaurant</span>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-label-md text-sm truncate">{recipe.name}</h4>
                        <p className="text-xs text-on-surface-variant truncate">
                          {(recipe.prep_time || 0) + (recipe.cook_time || 0)} mins
                        </p>
                      </div>
                    </Link>
                  ))}
                </>
              ) : (
                <div className="py-8 text-center text-on-surface-variant text-sm">
                  No recipes saved yet.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Meals */}
          <div className="cc-glass-panel p-6 rounded-3xl flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">Upcoming Meals</h2>
              <Link to="/meal-plan" className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">calendar_month</Link>
            </div>
            <div className="space-y-3">
              {upcomingMeals.length > 0 ? (
                upcomingMeals.slice(0, 3).map((meal, index) => (
                  <div key={meal.id} className={`border-l-4 ${index === 0 ? 'border-primary pl-4 py-2 bg-primary/10' : 'border-outline-variant pl-4 py-2 cc-glass-pill'} rounded-r-xl ${index === 2 ? 'opacity-60' : ''}`}>
                    <span className={`text-xs font-bold ${index === 0 ? 'text-primary' : 'text-on-surface-variant'} uppercase`}>{meal.meal_date}</span>
                    <h4 className="font-label-md truncate">{meal.recipe_name}</h4>
                    {index === 0 && (
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold">Planned</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-on-surface-variant text-sm">
                  No meals planned this week.
                </div>
              )}
            </div>
            <Link to="/meal-plan" className="w-full text-center py-3 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant font-label-md hover:bg-white/20 transition-colors mt-auto">
              + Plan New Meal
            </Link>
          </div>

          {/* Social Feed / Popular Posts */}
          <div className="cc-glass-panel p-6 rounded-3xl flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">Social Feed</h2>
              <Link to="/social" className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">groups</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {popularPosts.length > 0 ? (
                popularPosts.map((post) => (
                  <Link key={post.id} to={`/social`} className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer bg-white/40 flex items-center justify-center">
                    {post.image_url ? (
                      <img className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" src={post.image_url} alt={post.recipe_name || 'Post'} loading="lazy" decoding="async" />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-primary/30">image</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-white text-xs font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span> 
                        {post.like_count || 0}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-2 py-8 text-center text-on-surface-variant text-sm">
                  No social posts yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
