import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw } from 'lucide-react';

export default function Dispense({ user, searchTerm: globalSearchTerm = '' }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  
  // Modal de dispensación
  const [selectedPresc, setSelectedPresc] = useState(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPendingPrescriptions = async () => {
    setLoading(true);
    try {
      const data = await api.prescriptions.getAll('pending');
      setPrescriptions(data);
    } catch (err) {
      console.error('Error al cargar recetas pendientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPrescriptions();
  }, []);

  const handleOpenDispense = async (code) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const data = await api.prescriptions.getByCode(code);
      setSelectedPresc(data);
      setIsDispenseModalOpen(true);
    } catch (error) {
      alert('Error al cargar los detalles de la receta.');
    }
  };

  const handleDispenseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPresc) return;

    // Verificar stock suficiente
    const insufficientStock = selectedPresc.items.some(
      (item) => item.current_stock < item.quantity_prescribed
    );

    if (insufficientStock) {
      setErrorMsg('No se puede dispensar. Uno o más medicamentos no tienen existencias suficientes.');
      return;
    }

    setDispenseLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.prescriptions.dispense(selectedPresc.id);
      setSuccessMsg(`¡Receta ${selectedPresc.code} surtida exitosamente! Se actualizaron los saldos de inventario.`);
      
      setTimeout(() => {
        setIsDispenseModalOpen(false);
        fetchPendingPrescriptions();
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error al despachar la receta.');
    } finally {
      setDispenseLoading(false);
    }
  };

  // Combinar búsqueda global y local
  const activeSearch = globalSearchTerm || localSearchTerm;

  // Filtrado de recetas pendientes
  const filteredPrescriptions = prescriptions.filter((presc) => 
    presc.code.toLowerCase().includes(activeSearch.toLowerCase()) ||
    presc.patient_name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    presc.patient_id.toLowerCase().includes(activeSearch.toLowerCase())
  );

  if (loading && prescriptions.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando cola de farmacia...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Despacho y Egresos (Farmacia)</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Surta las recetas en espera de pacientes y registre sus salidas automáticas</p>
        </div>
        <button 
          onClick={fetchPendingPrescriptions}
          className="h-10 px-md rounded bg-surface-container-high border border-outline-variant text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-colors flex items-center gap-sm font-semibold"
        >
          <span className="material-symbols-outlined text-[18px]">sync</span>
          Actualizar Cola
        </button>
      </div>

      {/* BARRA DE BUSQUEDA LOCAL */}
      <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input
            type="text"
            className="w-full bg-surface-variant border-none rounded-full pl-10 pr-4 py-2.5 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
            placeholder="Buscar recetas por código (REC-XXXXXX), DNI o nombre del paciente..."
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            disabled={!!globalSearchTerm} // Deshabilitado si la búsqueda global está activa
          />
          {globalSearchTerm && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold">Búsqueda Global</span>
          )}
        </div>
      </div>

      {/* COLA DE RECEPTAS EN ESPERA */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="p-lg border-b border-outline-variant flex items-center gap-sm bg-surface-container-low/50">
          <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
            Cola de Espera para Dispensación ({filteredPrescriptions.length})
          </h3>
        </div>

        {filteredPrescriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-high/40">
                <tr>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Código de Receta</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Paciente / Identificación</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Médico Firmante</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Fecha de Entrada</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredPrescriptions.map((presc) => (
                  <tr key={presc.id} className="hover:bg-surface-container-highest transition-colors">
                    <td className="px-lg py-md">
                      <span className="font-data-mono text-data-mono text-primary font-bold text-base tracking-wider">{presc.code}</span>
                    </td>
                    <td className="px-lg py-md">
                      <p className="font-body-lg text-body-lg text-on-surface font-semibold leading-tight">{presc.patient_name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-0.5">DNI: {presc.patient_id}</p>
                    </td>
                    <td className="px-lg py-md text-on-surface-variant font-medium">{presc.doctor_name}</td>
                    <td className="px-lg py-md text-on-surface-variant text-sm font-medium">
                      {new Date(presc.created_at).toLocaleString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-lg py-md text-center">
                      <button
                        onClick={() => handleOpenDispense(presc.code)}
                        className="bg-secondary text-on-secondary px-md py-2 rounded font-label-caps text-label-caps text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-xs mx-auto shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                        Revisar y Surtir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-xl text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-secondary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="font-body-lg">¡Cola al día! No quedan recetas pendientes de surtir.</p>
          </div>
        )}
      </div>

      {/* --- MODAL DE DISPENSACIÓN --- */}
      {isDispenseModalOpen && selectedPresc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-lg w-full p-lg shadow-2xl relative">
            <button 
              onClick={() => setIsDispenseModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
              disabled={dispenseLoading}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            
            <div className="border-b border-outline-variant pb-xs mb-md flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-headline-md text-secondary font-semibold">Dispensar Receta Física</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Captura digitalizada y egreso</p>
              </div>
              <span className="font-display-lg text-display-lg text-secondary text-xl font-extrabold">{selectedPresc.code}</span>
            </div>

            {errorMsg && (
              <div className="bg-error-container/20 border border-error text-error p-sm rounded-lg flex items-center gap-xs text-xs mb-md">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-secondary-container/20 border border-secondary text-secondary p-sm rounded-lg flex items-center gap-xs text-xs mb-md">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-md">
              
              {/* Info Paciente */}
              <div className="bg-surface-container-low p-sm rounded-xl border border-outline-variant">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">PACIENTE</span>
                <span className="font-body-lg text-body-lg text-on-surface font-semibold block leading-tight">{selectedPresc.patient_name}</span>
                <span className="text-xs text-on-surface-variant block mt-0.5">DNI: {selectedPresc.patient_id}</span>
                <span className="text-xs text-on-surface-variant block">Médico Firmante: {selectedPresc.doctor_name}</span>
              </div>

              {/* Items y existencias */}
              <div>
                <h4 className="font-body-lg text-body-lg text-on-surface mb-sm border-b border-outline-variant/60 pb-0.5 font-semibold">
                  Validación de Stock en Almacén
                </h4>
                
                <div className="space-y-sm max-h-[220px] overflow-y-auto pr-sm scrollbar-thin">
                  {selectedPresc.items?.map((item) => {
                    const hasStock = item.current_stock >= item.quantity_prescribed;
                    return (
                      <div 
                        key={item.id} 
                        className={`p-sm rounded-lg border flex flex-col gap-xs ${
                          hasStock ? 'bg-surface-container-low border-outline-variant' : 'bg-error-container/5 border-error/40'
                        }`}
                      >
                        <div className="flex justify-between font-semibold text-sm">
                          <span className="text-on-surface">{item.medication_name}</span>
                          <span className="text-primary font-bold">Surtir: {item.quantity_prescribed} {item.unit}</span>
                        </div>
                        
                        <div className="text-xs text-on-surface-variant border-t border-dashed border-outline-variant/50 pt-1 mt-1 flex justify-between items-center">
                          <span>Indicación: {item.instructions}</span>
                          <div className="flex items-center gap-xs font-semibold">
                            <span>Stock Almacén:</span>
                            <span className={hasStock ? 'text-secondary' : 'text-error'}>
                              {item.current_stock} {item.unit}
                            </span>
                          </div>
                        </div>

                        {!hasStock && (
                          <div className="flex items-center gap-xs text-[10px] text-error font-semibold mt-1">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            <span>¡Existencias insuficientes para abastecer este medicamento!</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Acciones */}
              {!successMsg && (
                <div className="flex gap-md justify-end pt-sm border-t border-outline-variant">
                  <button 
                    type="button" 
                    onClick={() => setIsDispenseModalOpen(false)}
                    disabled={dispenseLoading}
                    className="h-10 px-md rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-caps text-label-caps text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={handleDispenseSubmit}
                    disabled={
                      dispenseLoading || 
                      selectedPresc.items.some((item) => item.current_stock < item.quantity_prescribed)
                    }
                    className="h-10 px-md rounded bg-secondary text-on-secondary font-label-caps text-label-caps text-xs font-bold hover:brightness-110 transition-all flex items-center gap-xs shadow-md disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {dispenseLoading ? 'Despachando...' : 'Confirmar Dispensación e Inventariar Egreso'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
