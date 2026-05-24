import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw } from 'lucide-react';

export default function Transactions({ user, searchTerm: globalSearchTerm = '' }) {
  const [transactions, setTransactions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, ingreso, egreso
  const [dataScope, setDataScope] = useState('recent');
  
  // Estado para el medicamento seleccionado para ver su historial específico
  const [selectedMed, setSelectedMed] = useState(null);

  const matchesMedication = (tx, med) => {
    const txMedId = Number(tx.medication_id);
    const medId = Number(med.id);
    if (!Number.isNaN(txMedId) && !Number.isNaN(medId) && txMedId === medId) {
      return true;
    }
    return tx.medication_name === med.name;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, medData] = await Promise.all([
        api.transactions.getAll(dataScope),
        api.inventory.getAll()
      ]);
      setTransactions(txData);
      setMedications(medData);
    } catch (err) {
      console.error('Error al cargar datos de kárdex:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dataScope]);

  const handlePrint = () => {
    window.print();
  };

  // Combinar término global y local
  const activeSearch = globalSearchTerm || localSearchTerm;

  // Filtrado de medicamentos para la vista de tarjetas
  const filteredMedications = medications.filter((med) => {
    return (
      String(med.name || '').toLowerCase().includes(String(activeSearch || '').toLowerCase()) ||
      String(med.active_principle || '').toLowerCase().includes(String(activeSearch || '').toLowerCase()) ||
      String(med.category || '').toLowerCase().includes(String(activeSearch || '').toLowerCase())
    );
  });

  // Filtrado de transacciones para la vista de detalle
  const filteredTransactions = transactions.filter((tx) => {
    // Filtrar por el medicamento seleccionado
    const matchesMedicationFilter = selectedMed 
      ? matchesMedication(tx, selectedMed)
      : true;

    const matchesType = typeFilter === 'all' || tx.type === typeFilter;

    // Si estamos en la vista de detalle del medicamento, no filtramos por texto
    // (a menos que se quiera buscar específicamente dentro del historial de ese medicamento)
    const matchesSearch = selectedMed
      ? String(tx.user_name || '').toLowerCase().includes(String(activeSearch || '').toLowerCase()) || String(tx.notes || '').toLowerCase().includes(String(activeSearch || '').toLowerCase())
      : true;

    return matchesMedicationFilter && matchesType && matchesSearch;
  });

  if (loading && medications.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando bitácora de movimientos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      
      {/* VISTA 1: GRID DE TARJETAS DE MEDICAMENTOS (Ninguno seleccionado) */}
      {!selectedMed ? (
        <div className="space-y-lg no-print">
          
          {/* PAGE HEADER */}
          <div className="flex justify-between items-end gap-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Bitácora de Kárdex por Medicamento</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Seleccione un medicamento para auditar detalladamente su historial de movimientos</p>
            </div>
            <button 
              onClick={loadData}
              className="h-10 px-md rounded bg-surface-container-high border border-outline-variant text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-colors flex items-center justify-center gap-sm font-semibold text-xs"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
              Sincronizar
            </button>
          </div>

          {/* PANEL DE BUSCADOR */}
          <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm">
            <div className="flex flex-col md:flex-row gap-sm md:items-center md:justify-between">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input
                type="text"
                className="w-full bg-surface-variant border-none rounded-full pl-10 pr-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                placeholder="Buscar por código de medicamento o principio..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                disabled={!!globalSearchTerm}
              />
              {globalSearchTerm && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold">Búsqueda Global</span>
              )}
            </div>
            <select
              value={dataScope}
              onChange={(e) => setDataScope(e.target.value)}
              className="bg-surface-variant border-none rounded-full px-4 py-2 text-on-surface text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="recent">Últimos 7 días</option>
              <option value="all">Histórico completo</option>
            </select>
            </div>
          </div>

          {/* GRID DE MEDICAMENTOS */}
          {filteredMedications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-lg">
              {filteredMedications.map((med) => {
                // Filtrar movimientos específicos de esta tarjeta para el conteo
                const medMvs = transactions.filter((t) => matchesMedication(t, med));
                const medIngresos = medMvs.filter((t) => t.type === 'ingreso').length;
                const medEgresos = medMvs.filter((t) => t.type === 'egreso').length;
                const isLow = med.stock <= med.min_stock && med.stock > 0;
                const isOut = med.stock === 0;

                return (
                  <div 
                    key={med.id}
                    onClick={() => {
                      setSelectedMed(med);
                      setLocalSearchTerm(''); // Limpiar para que la vista de detalle esté libre de filtros
                    }}
                    className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between cursor-pointer hover:bg-surface-container-high transition-all hover:-translate-y-1 relative group"
                  >
                    <div className="flex justify-between items-start mb-md">
                      <span className="bg-primary-container/10 text-primary border border-primary/20 px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {med.category}
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">analytics</span>
                    </div>

                    <div className="space-y-xs mb-md">
                      <h4 className="font-headline-sm text-base text-on-surface font-extrabold group-hover:underline tracking-tight">
                        {med.name}
                      </h4>
                      <p className="font-body-sm text-xs text-on-surface-variant truncate">
                        {med.active_principle}
                      </p>
                    </div>

                    <div className="border-t border-outline-variant/60 pt-sm mt-sm flex justify-between items-center text-xs">
                      <div>
                        <p className="text-[9px] text-on-surface-variant uppercase font-bold">STOCK ACTUAL</p>
                        <p className={`font-data-mono text-data-mono font-bold ${isOut ? 'text-error' : isLow ? 'text-warning' : 'text-primary'}`}>
                          {med.stock} {med.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-on-surface-variant uppercase font-bold">MOVIMIENTOS</p>
                        <p className="font-bold text-on-surface font-data-mono">{medMvs.length} logs</p>
                        <p className="text-[10px] text-primary font-semibold">Ingresos: {medIngresos}</p>
                        <p className="text-[10px] text-secondary font-semibold">Egresos: {medEgresos}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2">find_in_page</span>
              <p className="font-body-lg">No se encontraron medicamentos en el catálogo.</p>
            </div>
          )}

        </div>
      ) : (
        
        /* VISTA 2: DETALLE HISTÓRICO DEL MEDICAMENTO SELECCIONADO */
        <div className="space-y-lg">
          
          {/* HEADER DE NAVEGACIÓN Y DETALLE */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-md no-print border-b border-outline-variant pb-md">
            <div className="flex items-center gap-sm">
              <button 
                onClick={() => {
                  setSelectedMed(null);
                  setLocalSearchTerm('');
                }}
                className="p-2 hover:bg-surface-container-high rounded-full text-primary transition-colors flex items-center justify-center border border-outline-variant bg-surface-container"
                title="Volver al listado"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
              <div>
                <span className="bg-primary-container/10 text-primary border border-primary/20 px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {selectedMed.category}
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface mt-1">Kárdex de Movimientos</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Código: <strong className="text-primary font-data-mono">{selectedMed.name}</strong> | Principio Activo: <strong>{selectedMed.active_principle}</strong>
                </p>
              </div>
            </div>
            
            <div className="flex gap-md w-full sm:w-auto">
              <button 
                onClick={handlePrint}
                className="flex-1 sm:flex-initial h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center gap-sm font-bold text-xs shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir Reporte
              </button>
              <button 
                onClick={() => {
                  setSelectedMed(null);
                  setLocalSearchTerm('');
                }}
                className="flex-1 sm:flex-initial h-10 px-md rounded bg-surface-container-high border border-outline-variant text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-colors flex items-center justify-center gap-sm font-semibold text-xs"
              >
                Volver
              </button>
            </div>
          </div>

          {/* Cabecera optimizada para impresión física */}
          <div className="print-only hidden mb-xl border-b-2 border-black pb-sm">
            <h1 className="text-3xl font-bold text-black font-headline-md">Drogas CE</h1>
            <h2 className="text-xl font-semibold text-black mt-1">Reporte de Auditoría de Kárdex Clínico</h2>
            <p className="text-sm text-gray-700 mt-2">
              Código del Medicamento: <strong>{selectedMed.name}</strong><br />
              Principio Activo: <strong>{selectedMed.active_principle}</strong> | Categoría: <strong>{selectedMed.category}</strong>
            </p>
            <p className="text-sm text-gray-700">Existencia Actual en Almacén: <strong>{selectedMed.stock} {selectedMed.unit}</strong></p>
            <p className="text-xs text-gray-500 mt-2">Generado por: {user.name} | Fecha: {new Date().toLocaleString('es-ES')}</p>
          </div>

          {/* ANALYTICS CARDS (METRICS) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg">
            <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] font-bold">Total Ingresos (Entradas)</span>
              <span className="font-display-lg text-display-lg text-primary mt-2 font-data-mono font-bold">
                +{filteredTransactions.filter(t => t.type === 'ingreso').reduce((acc, curr) => acc + curr.quantity, 0)} {selectedMed.unit}
              </span>
            </div>
            <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] font-bold">Total Egresos (Salidas)</span>
              <span className="font-display-lg text-display-lg text-secondary mt-2 font-data-mono font-bold">
                -{filteredTransactions.filter(t => t.type === 'egreso').reduce((acc, curr) => acc + curr.quantity, 0)} {selectedMed.unit}
              </span>
            </div>
            <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px] font-bold">Existencia Actual en Almacén</span>
              <span className="font-display-lg text-display-lg text-on-surface mt-2 font-data-mono font-bold">
                {selectedMed.stock} {selectedMed.unit}
              </span>
            </div>
          </div>

          {/* FILTRO RÁPIDO DENTRO DE DETALLE (NO-PRINT) */}
          <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm no-print">
            <div className="flex flex-col md:flex-row gap-md items-center justify-between">
              
              <div className="relative w-full md:w-96">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                <input
                  type="text"
                  className="w-full bg-surface-variant border-none rounded-full pl-10 pr-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Buscar por notas o responsable..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-xs text-xs font-semibold">
                  <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  Tipo de Movimiento:
                </span>
                <select
                  className="bg-surface-variant border-none rounded-full px-4 py-2 text-on-surface text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  style={{ width: '190px' }}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">Ingresos y Egresos</option>
                  <option value="ingreso">Solo Ingresos</option>
                  <option value="egreso">Solo Egresos</option>
                </select>
              </div>

            </div>
          </div>

          {/* TABLA DE TRANSACCIONES FILTRADA */}
          <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            {filteredTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse print-table">
                  <thead className="bg-surface-container-high/40 border-b border-outline-variant">
                    <tr>
                      <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant print-header">Fecha / Hora</th>
                      <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant print-header">Operación</th>
                      <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant print-header">Cantidad</th>
                      <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant print-header">Responsable</th>
                      <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant print-header">Detalles / Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant print-divide">
                    {filteredTransactions.map((tx) => {
                      const isIngreso = tx.type === 'ingreso';
                      return (
                        <tr key={tx.id} className="hover:bg-surface-container-highest transition-colors">
                          <td className="px-lg py-md font-data-mono text-data-mono text-xs text-on-surface-variant font-medium print-text text-center">
                            {new Date(tx.timestamp).toLocaleString('es-ES', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-lg py-md text-center">
                            <span className={`px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              isIngreso 
                                ? 'bg-primary-container/10 text-primary border-primary/20 print-badge-in' 
                                : 'bg-secondary-container/10 text-secondary border-secondary/20 print-badge-out'
                            }`}>
                              {isIngreso ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td className={`px-lg py-md font-data-mono text-data-mono font-bold print-text text-center ${
                            isIngreso ? 'text-primary' : 'text-secondary'
                          }`}>
                            {isIngreso ? '+' : '-'}{tx.quantity} {selectedMed.unit}
                          </td>
                          <td className="px-lg py-md text-on-surface-variant font-medium print-text text-center">{tx.user_name}</td>
                          <td className="px-lg py-md text-on-surface-variant text-sm print-text text-center">{tx.reference_recipe_number ? String(tx.notes || '').replace(/REC-\d{6}/g, tx.reference_recipe_number) : tx.notes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-xl text-on-surface-variant italic">
                No se registran movimientos para este medicamento en base a los filtros.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Estilos CSS específicos para la impresión integrados */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .ml-64 {
            margin-left: 0 !important;
          }
          .w-\\[calc\\(100\\%-16rem\\)\\] {
            width: 100% !important;
          }
          main {
            padding: 0 !important;
            margin-left: 0 !important;
            width: 100% !important;
          }
          .bg-surface-container {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-table th {
            color: black !important;
            border-bottom: 2px solid black !important;
            padding: 8px 12px !important;
          }
          .print-table td {
            border-bottom: 1px solid #ddd !important;
            color: black !important;
            padding: 8px 12px !important;
          }
          .print-text {
            color: black !important;
          }
          .print-badge-in {
            background: none !important;
            border: 1px solid black !important;
            color: black !important;
          }
          .print-badge-out {
            background: none !important;
            border: 1px dashed black !important;
            color: black !important;
          }
        }
      `}</style>

    </div>
  );
}


