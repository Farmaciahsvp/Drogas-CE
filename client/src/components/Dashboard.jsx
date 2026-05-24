import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw } from 'lucide-react';

export default function Dashboard({ user, setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [dispatchFilter, setDispatchFilter] = useState('all');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.dashboard.getStats();
      setStats(data);
    } catch (err) {
      setError('Error al cargar mÃ©tricas del tablero.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando operaciones de farmacia...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container/20 border border-error text-error p-md rounded-xl flex items-center gap-sm">
        <span className="material-symbols-outlined">error</span>
        <span>{error}</span>
      </div>
    );
  }

  // Encontrar el valor mÃ¡ximo de stock de categorÃ­a para escalar las barras
  const dispatchSeries = stats?.weeklyDispenseAverages?.series?.[dispatchFilter] || [];
  const dispatchMax = dispatchSeries.length > 0
    ? Math.max(...dispatchSeries.map((d) => d.avg))
    : 1;

  // Mapa de iconos de transacciÃ³n recientes
  const getTxIcon = (notes, unit) => {
    const text = (notes || '').toLowerCase() + (unit || '').toLowerCase();
    if (text.includes('ampolla') || text.includes('inyecc') || text.includes('vacuna')) {
      return 'vaccines';
    } else if (text.includes('frasco') || text.includes('jarabe') || text.includes('suspens')) {
      return 'medication_liquid';
    } else {
      return 'pill';
    }
  };

  return (
    <div className="space-y-lg">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Resumen de Operaciones</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Estado en tiempo real del inventario y recetas de la farmacia</p>
          <div className="mt-xs flex items-center gap-xs">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-secondary' : 'bg-error'}`}></span>
            <span className="text-[11px] text-on-surface-variant">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div className="flex gap-md w-full sm:w-auto">
          <button 
            onClick={fetchStats}
            className="flex-1 sm:flex-initial h-10 px-md rounded bg-surface-container-high border border-outline-variant text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-colors flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Sincronizar
          </button>
          <button 
            onClick={() => setActiveTab('prescribe')}
            className="flex-1 sm:flex-initial h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Registrar Receta
          </button>
        </div>
      </div>

      {/* KEY METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-lg">
        
        {/* Metric 1 */}
        <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant">Existencia Ampollas</span>
            <span className="material-symbols-outlined text-primary text-2xl">vaccines</span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface leading-none mt-2">{stats?.totalAmpollas || 0}</div>
          <div className="mt-xs flex items-center gap-xs">
            <span className="font-body-sm text-body-sm text-primary">PresentaciÃ³n ampolla</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant">Existencia Tabletas</span>
            <span className="material-symbols-outlined text-primary text-2xl">pill</span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface leading-none mt-2">{stats?.totalTabletas || 0}</div>
          <div className="mt-xs flex items-center gap-xs">
            <span className="font-body-sm text-body-sm text-primary">PresentaciÃ³n tableta</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => stats?.lowStockAlerts > 0 && setActiveTab('inventory')}
          className={`bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between ${stats?.lowStockAlerts > 0 ? 'cursor-pointer hover:bg-surface-container-high' : ''}`}
        >
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant">Alertas de Stock</span>
            <span className={`material-symbols-outlined text-2xl ${stats?.lowStockAlerts > 0 ? 'text-error animate-pulse' : 'text-warning'}`}>warning</span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface leading-none mt-2">{stats?.lowStockAlerts || 0}</div>
          <div className="mt-xs flex items-center gap-xs">
            <span className={`font-body-sm text-body-sm ${stats?.lowStockAlerts > 0 ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
              {stats?.lowStockAlerts > 0 ? 'Requiere reabastecimiento crÃ­tico' : 'Todos los niveles normales'}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant">Recetas Procesadas</span>
            <span className="material-symbols-outlined text-tertiary text-2xl">clinical_notes</span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface leading-none mt-2">{stats?.pendingPrescriptions || 0}</div>
          <div className="mt-xs flex items-center gap-xs">
            <span className="font-body-sm text-body-sm text-tertiary">
              Despachadas inmediatamente
            </span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant">Surtido Hoy</span>
            <span className="material-symbols-outlined text-secondary text-2xl">check_circle</span>
          </div>
          {/* Calculamos recetas surtidas en base a egresos en transacciones recientes o ponemos un estÃ¡tico descriptivo */}
          <div className="font-display-lg text-display-lg text-on-surface leading-none mt-2">
            {stats?.recentTransactions?.filter(t => t.type === 'egreso').length || 0}
          </div>
          <div className="mt-xs flex items-center gap-xs">
            <span className="font-body-sm text-body-sm text-secondary">Egresos registrados en bitÃ¡cora reciente</span>
          </div>
        </div>

      </div>

      {/* DASHBOARD CENTER & SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        
                {/* BAR CHART: DESPACHO PROMEDIO POR DIA */}
        <div className="lg:col-span-2 bg-surface-container p-lg rounded-xl border border-outline-variant flex flex-col h-[400px]">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-lg gap-sm">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Despacho Promedio por Día</h3>
              <p className="font-label-caps text-label-caps text-on-surface-variant">Recetas dispensadas promedio por día de semana</p>
            </div>
            <select
              value={dispatchFilter}
              onChange={(e) => setDispatchFilter(e.target.value)}
              className="bg-surface-variant border-none rounded-full px-4 py-2 text-on-surface text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="psychotropic">Psicotrópicos</option>
              <option value="narcotic">Estupefacientes</option>
              <option value="other">Otros</option>
            </select>
          </div>

          {dispatchSeries.length > 0 ? (
            <div className="flex-1 flex items-end justify-between gap-md px-sm overflow-x-auto pb-2">
              {dispatchSeries.map((item, i) => {
                const percentage = dispatchMax > 0 ? (item.avg / dispatchMax) * 85 : 0;
                return (
                  <div className="flex-1 flex flex-col items-center gap-sm group min-w-[50px]" key={i}>
                    <div className="w-full flex flex-col-reverse justify-start h-[200px] relative">
                      <div
                        className="bg-primary rounded-t-lg w-full transition-all duration-300 group-hover:brightness-125 group-hover:scale-x-105"
                        style={{ height: `${Math.max(percentage, 10)}%` }}
                        title={`Promedio: ${item.avg} | Total: ${item.total}`}
                      ></div>
                    </div>
                    <span
                      className="font-label-caps text-label-caps text-on-surface-variant text-[11px] truncate w-full text-center mt-1"
                      title={`${item.day}: promedio ${item.avg}`}
                    >
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-on-surface-variant">
              <span>No hay datos de despacho para el filtro seleccionado</span>
            </div>
          )}
        </div>

        {/* RECENT FULFILLMENT SIDEBAR */}
        <div className="bg-surface-container p-lg rounded-xl border border-outline-variant h-[400px] flex flex-col">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg font-semibold">Despacho Reciente</h3>
          
          {stats?.recentTransactions?.length > 0 ? (
            <div className="space-y-sm flex-1 overflow-y-auto pr-sm scrollbar-thin">
              {stats.recentTransactions.map((tx) => {
                const isIngreso = tx.type === 'ingreso';
                return (
                  <div key={tx.id} className="bg-surface-container-low p-sm rounded border border-outline-variant flex items-center gap-md hover:bg-surface-variant/30 transition-all">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIngreso ? 'bg-primary-container/20 text-primary' : 'bg-secondary-container/20 text-secondary'}`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {isIngreso ? 'download' : getTxIcon(tx.notes, tx.unit)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body-lg text-body-lg text-on-surface leading-tight truncate">{tx.medication_name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {isIngreso ? `Ingresado por: ${tx.user_name}` : `Por: ${tx.user_name}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-data-mono text-data-mono text-on-surface text-sm">
                        {isIngreso ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </p>
                      <span className={`text-[10px] uppercase font-bold ${isIngreso ? 'text-primary' : 'text-secondary'}`}>
                        {isIngreso ? 'Entrada' : 'Surtido'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-on-surface-variant text-center">
              <p>No se registran movimientos recientes</p>
            </div>
          )}
        </div>

      </div>

      {/* CRITICAL INVENTORY MONITOR TABLE */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Monitor de Inventario CrÃ­tico</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Productos por debajo del stock mÃ­nimo de seguridad</p>
          </div>
          <button 
            onClick={() => setActiveTab('inventory')}
            className="text-primary font-label-caps text-label-caps flex items-center gap-xs hover:underline text-sm font-semibold"
          >
            Ver Todo <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {stats?.criticalMeds?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-high/40">
                <tr>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Medicamento / Item</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Stock Actual</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">MÃ­nimo Requerido</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Estado</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant text-right">AcciÃ³n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {stats.criticalMeds.map((med) => {
                  const isOut = med.stock === 0;
                  return (
                    <tr key={med.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-lg py-md">
                        <p className="font-body-lg text-body-lg text-on-surface font-medium">{med.name}</p>
                        <p className="font-data-mono text-data-mono text-on-surface-variant text-xs">{med.active_principle}</p>
                      </td>
                      <td className={`px-lg py-md font-data-mono text-data-mono font-semibold ${isOut ? 'text-error' : 'text-warning'}`}>
                        {med.stock} {med.unit}
                      </td>
                      <td className="px-lg py-md font-data-mono text-data-mono text-on-surface-variant">
                        {med.min_stock} {med.unit}
                      </td>
                      <td className="px-lg py-md">
                        <span className={`px-sm py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isOut ? 'bg-error-container/20 text-error border border-error/30' : 'bg-tertiary-container/10 text-tertiary border border-tertiary/20'
                        }`}>
                          {isOut ? 'Agotado' : 'Bajo Stock'}
                        </span>
                      </td>
                      <td className="px-lg py-md text-right">
                        <button 
                          onClick={() => setActiveTab('inventory')}
                          className="bg-surface-variant px-sm py-1.5 rounded text-primary hover:bg-primary hover:text-on-primary transition-all font-label-caps text-label-caps text-xs font-semibold"
                        >
                          Reabastecer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-xl text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-secondary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="font-body-lg">Â¡Felicidades! Todo el almacÃ©n cuenta con niveles de stock Ã³ptimos.</p>
          </div>
        )}
      </div>

    </div>
  );
}

