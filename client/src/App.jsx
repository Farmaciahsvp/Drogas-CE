import React, { useState, useEffect } from 'react';
import { api, getCurrentUser } from './utils/api';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Prescriptions from './components/Prescriptions';
import Transactions from './components/Transactions';
import Settings from './components/Settings';
import ReplenishRequests from './components/ReplenishRequests';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Sincronizar tema oscuro (por defecto siempre oscuro en este nuevo diseño de PharmOps Pro)
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  const handleLogout = () => {
    api.auth.logout();
    setUser(null);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;
    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    const onEscLogout = (event) => {
      if (event.key === 'Escape') {
        handleLogout();
      }
    };
    window.addEventListener('keydown', onEscLogout);

    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
      window.removeEventListener('keydown', onEscLogout);
    };
  }, [user]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} setActiveTab={setActiveTab} />;
      case 'inventory':
        return <Inventory user={user} searchTerm={searchTerm} />;
      case 'prescribe':
        return <Prescriptions user={user} />;
      case 'transactions':
        return <Transactions user={user} searchTerm={searchTerm} />;
      case 'settings':
        return <Settings user={user} />;
      case 'replenish':
        return <ReplenishRequests user={user} />;
      default:
        return <Dashboard user={user} setActiveTab={setActiveTab} />;
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .filter((n) => n)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-lg">
      
      {/* SIDEBAR NAVIGATION (ASIDE) */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-0'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar
          user={user}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          onLogout={handleLogout}
        />
      </div>

      {/* MOBILE HEADER (BARRA MÓVIL) */}
      <header className="lg:hidden h-16 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-md fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-sm">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-primary hover:bg-surface-container-high p-2 rounded-lg"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
            <span className="font-headline-md text-headline-md text-primary tracking-tight text-base">Drogas CE</span>
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
            {getInitials(user.name)}
          </div>
        </div>
      </header>

      {/* TOP APP BAR (SOLO DESKTOP) */}
      <header className="hidden lg:flex ml-64 w-[calc(100%-16rem)] sticky top-0 z-40 bg-surface-dim/85 backdrop-blur-xl border-b border-outline-variant shadow-sm justify-between items-center px-lg py-sm">
        <div className="flex items-center gap-lg">
          <h1 className="font-display-lg text-display-lg text-primary tracking-tight">PharmOps Pro</h1>
          <div className="relative w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input 
              className="w-full bg-surface-variant border-none rounded-full pl-10 pr-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none" 
              placeholder="Buscar medicamentos, recetas o transacciones..." 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-md">
          <div className="cursor-pointer active:opacity-80 p-2 hover:bg-surface-container-high rounded-full relative">
            <span className="material-symbols-outlined text-primary">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </div>
          <div className="h-8 w-px bg-outline-variant mx-sm"></div>
          <div className="flex items-center gap-sm cursor-pointer hover:bg-surface-container-high p-1 pr-3 rounded-full transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs" style={{ border: '1px solid var(--primary)' }}>
              {getInitials(user.name)}
            </div>
            <span className="font-label-caps text-label-caps text-on-surface">{user.name}</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="lg:ml-64 p-md lg:p-lg pt-20 lg:pt-lg">
        <div className="max-w-[1400px] mx-auto">
          {renderActiveView()}
        </div>
      </main>

      {/* OVERLAY PARA MÓVIL AL ABRIR EL MENÚ */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
        />
      )}
    </div>
  );
}

export default App;
