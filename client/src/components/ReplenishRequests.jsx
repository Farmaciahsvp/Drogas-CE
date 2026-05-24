import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function ReplenishRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Formulario
  const [selectedMedId, setSelectedMedId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [dataScope, setDataScope] = useState('recent');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqData, medData] = await Promise.all([
        api.replenish.getAll(dataScope),
        api.inventory.getAll()
      ]);
      setRequests(reqData);
      setMedications(medData);
    } catch (err) {
      setError('Error al obtener datos del almacén.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dataScope]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedMedId || quantity <= 0) {
      setError('Por favor seleccione un medicamento y una cantidad válida mayor a 0.');
      return;
    }

    try {
      await api.replenish.create({
        medication_id: parseInt(selectedMedId),
        quantity: parseInt(quantity),
        notes: notes
      });
      
      setSuccess('Solicitud de reposición registrada con éxito.');
      setSelectedMedId('');
      setQuantity(1);
      setNotes('');
      
      loadData();
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud.');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('¿Está seguro de aprobar esta solicitud de reposición? Se incrementará el stock del medicamento y se registrará la transacción en el Kárdex.')) {
      return;
    }
    
    setError('');
    setSuccess('');
    try {
      const res = await api.replenish.approve(id);
      setSuccess(res.message);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al aprobar la solicitud.');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('¿Está seguro de rechazar esta solicitud de reposición?')) {
      return;
    }
    
    setError('');
    setSuccess('');
    try {
      const res = await api.replenish.reject(id);
      setSuccess(res.message);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al rechazar la solicitud.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="bg-warning/10 text-warning px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-warning/20">
            Pendiente
          </span>
        );
      case 'approved':
        return (
          <span className="bg-secondary/10 text-secondary px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-secondary/20">
            Aprobada
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-error/10 text-error px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-error/20">
            Rechazada
          </span>
        );
      default:
        return <span className="text-xs uppercase font-bold">{status}</span>;
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando solicitudes de reposición...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Solicitudes de Reposición</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Gestión y aprobación de reabastecimiento crítico para farmacia</p>
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

      {error && (
        <div className="bg-error-container/20 border border-error text-error p-md rounded-xl flex items-center gap-sm">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-secondary-container/20 border border-secondary text-secondary p-md rounded-xl flex items-center gap-sm">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        
        {/* FORMULARIO DE CREACIÓN (IZQUIERDA) */}
        <div className="lg:col-span-1 bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md h-fit">
          <div className="flex items-center gap-sm border-b border-outline-variant pb-xs">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Nueva Solicitud</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="flex flex-col gap-xs">
              <label className="text-xs font-semibold text-on-surface-variant">Medicamento a Reponer</label>
              <select
                className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none w-full"
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                required
              >
                <option value="">-- Seleccionar producto --</option>
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.active_principle}) - Stock: {m.stock} {m.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-xs font-semibold text-on-surface-variant">Cantidad Solicitada</label>
              <input
                type="number"
                min="1"
                required
                className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                placeholder="Ej. 100"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-xs font-semibold text-on-surface-variant">Justificación / Notas</label>
              <textarea
                className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none h-24 resize-none w-full"
                placeholder="Ej. Stock mínimo superado. Se requiere para recetas de alta demanda..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center font-bold tracking-wider"
            >
              ENVIAR SOLICITUD
            </button>
          </form>
        </div>

        {/* LISTADO / TABLA DE SOLICITUDES (DERECHA) */}
        <div className="lg:col-span-2 bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm flex flex-col h-[550px]">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-xs">
                <span className="material-symbols-outlined">assignment_returned</span>
                Listado Histórico de Solicitudes
              </h3>
            </div>
            <button 
              onClick={loadData}
              className="p-2 hover:bg-surface-container-high rounded-full text-primary transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[20px]">sync</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-xs scrollbar-thin">
            {requests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-high/40 border-b border-outline-variant">
                    <tr>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Folio</th>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Medicamento</th>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Cant.</th>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Solicitado por</th>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Notas</th>
                      <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Estatus</th>
                      {user.role === 'admin' && (
                        <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant text-right">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-sm">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-surface-container-highest transition-colors">
                        <td className="px-md py-md font-data-mono text-data-mono font-bold text-primary">
                          #SR-{req.id}
                        </td>
                        <td className="px-md py-md">
                          <p className="font-semibold text-on-surface leading-none">{req.medication_name}</p>
                          <span className="text-[10px] text-on-surface-variant">{req.active_principle}</span>
                        </td>
                        <td className="px-md py-md font-data-mono text-data-mono font-bold text-on-surface">
                          {req.quantity} {req.unit}
                        </td>
                        <td className="px-md py-md text-on-surface-variant">{req.user_name}</td>
                        <td className="px-md py-md text-on-surface-variant max-w-[150px] truncate" title={req.notes}>
                          {req.notes || '-'}
                        </td>
                        <td className="px-md py-md">{getStatusBadge(req.status)}</td>
                        {user.role === 'admin' && (
                          <td className="px-md py-md text-right">
                            {req.status === 'pending' ? (
                              <div className="flex gap-xs justify-end">
                                <button 
                                  onClick={() => handleApprove(req.id)}
                                  className="bg-secondary-container/20 text-secondary border border-secondary/30 px-2 py-1 rounded text-xs hover:bg-secondary hover:text-on-secondary transition-all font-semibold"
                                >
                                  Aprobar
                                </button>
                                <button 
                                  onClick={() => handleReject(req.id)}
                                  className="bg-error-container/20 text-error border border-error/30 px-2 py-1 rounded text-xs hover:bg-error hover:text-on-error transition-all font-semibold"
                                >
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant italic uppercase font-bold">Procesada</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-xl text-on-surface-variant italic">
                No hay solicitudes de reposición registradas.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
