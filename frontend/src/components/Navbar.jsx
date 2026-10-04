import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDropdownOpen(false);
  };

  const navContent = (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/50 backdrop-blur-2xl border-b border-white/60 h-14 flex justify-between items-center px-4 md:px-10 shadow-[0_8px_24px_rgba(180,110,40,0.06)]">
        <Link to="/dashboard" className="font-headline-md text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>cooking</span>
          <span className="text-[#3d1e06] font-bold tracking-tight">ChefCraft</span>
        </Link>
        <div className="flex items-center gap-3">
          <button className="material-symbols-outlined text-[#574538] hover:text-amber-600 hover:bg-white/60 p-2 rounded-full transition-colors cursor-pointer active:scale-95" title="Notifications">notifications</button>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              className="w-8 h-8 rounded-full overflow-hidden border border-white/80 shadow-sm cursor-pointer active:scale-95 transition-transform"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <img alt="User Avatar" className="w-full h-full object-cover" src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white/90 backdrop-blur-2xl border border-white/90 shadow-[0_20px_60px_rgba(180,110,40,0.12)] overflow-hidden py-1 z-50">
                <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-[#3d1e06] hover:bg-white/80 hover:text-amber-600 transition-colors" onClick={() => setIsDropdownOpen(false)}>
                  <span className="material-symbols-outlined text-[20px]">person</span>
                  Profile
                </Link>
                <Link to="/marketplace" className="flex items-center gap-2 px-4 py-2 text-sm text-[#3d1e06] hover:bg-white/80 hover:text-emerald-600 transition-colors" onClick={() => setIsDropdownOpen(false)}>
                  <span className="material-symbols-outlined text-[20px]">storefront</span>
                  Marketplace
                </Link>
                <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-[#3d1e06] hover:bg-white/80 hover:text-amber-600 transition-colors" onClick={() => setIsDropdownOpen(false)}>
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                  Settings
                </Link>
                <div className="h-px bg-slate-200/80 my-1"></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex justify-between items-center px-4 py-1.5 bg-white/50 text-[#3d1e06] backdrop-blur-2xl border border-white/80 w-[calc(100%-40px)] max-w-2xl rounded-full shadow-[0_16px_40px_rgba(180,110,40,0.10)]">
        <NavLink to="/dashboard" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Dashboard</span>
            </>
          )}
        </NavLink>

        <NavLink to="/generate" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>auto_awesome</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Generate</span>
            </>
          )}
        </NavLink>

        <NavLink to="/recipes" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>restaurant_menu</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Recipes</span>
            </>
          )}
        </NavLink>

        <NavLink to="/pantry" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>inventory_2</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Pantry</span>
            </>
          )}
        </NavLink>

        <NavLink to="/social" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>group</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Social</span>
            </>
          )}
        </NavLink>
        
        <NavLink to="/meal-plan" className={({isActive}) => `flex flex-col items-center justify-center rounded-full px-4 sm:px-6 py-1.5 transition-all duration-[180ms] ease-out ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_8px_16px_rgba(249,115,22,0.35)] font-bold scale-105 -translate-y-0.5' : 'text-[#574538] hover:text-[#3d1e06] hover:bg-white/60'}`}>
          {({isActive}) => (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
              <span className="font-label-sm text-xs sm:text-sm hidden sm:block">Plan</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );

  return createPortal(navContent, document.body);
}
