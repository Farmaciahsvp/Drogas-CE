import React from 'react';

export default function Sidebar({ user, activeTab, setActiveTab, onLogout }) {
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'farmaceutico': return 'Farmacéutico';
      default: return role;
    }
  };

  // Definición de enlaces con Material Symbols Outlined
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'farmaceutico'] },
    { id: 'prescribe', label: 'Registrar Receta', icon: 'edit_document', roles: ['admin', 'farmaceutico'] },
    { id: 'inventory', label: 'Inventario', icon: 'inventory_2', roles: ['admin', 'farmaceutico'] },
    { id: 'replenish', label: 'Solicitud Reposición', icon: 'autorenew', roles: ['admin', 'farmaceutico'] },
    { id: 'transactions', label: 'Historial Kárdex', icon: 'analytics', roles: ['admin', 'farmaceutico'] },
    { id: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="h-screen w-64 bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50">
      
      {/* Brand Header */}
      <div className="px-md mb-xl flex items-center gap-sm">
        <div className="w-10 h-10 bg-primary-container flex items-center justify-center rounded-lg">
          <span className="material-symbols-outlined text-on-primary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md text-primary leading-tight">Drogas CE</h2>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">{getRoleLabel(user.role)}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-xs px-sm">
        {visibleMenuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group cursor-pointer flex items-center gap-md px-md py-sm rounded-md transition-all ${
                isActive 
                  ? 'bg-secondary-container/20 text-secondary border-r-4 border-secondary' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span 
                className="material-symbols-outlined text-xl" 
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="font-label-caps text-label-caps text-sm">{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* Bottom Profile / Action */}
      <div className="mt-auto px-sm space-y-xs">
        <div 
          onClick={onLogout}
          className="group cursor-pointer flex items-center gap-md px-md py-sm rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/10 transition-all"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span className="font-label-caps text-label-caps text-sm">Cerrar Sesión</span>
        </div>
      </div>

    </aside>
  );
}
