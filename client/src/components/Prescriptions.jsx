import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw } from 'lucide-react';

export default function Prescriptions({ user }) {
  const [medications, setMedications] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [patientId, setPatientId] = useState('');
  const [dispenseImmediately, setDispenseImmediately] = useState(true);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, recipeNumber: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [medFilter, setMedFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [medsData, prescData] = await Promise.all([
        api.inventory.getAll(),
        api.prescriptions.getAll()
      ]);
      setMedications(medsData);
      setPrescriptions(prescData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();

    if (!prescriptionNumber || !patientId) {
      alert('Por favor complete Numero de Receta y Numero de Identificacion.');
      return;
    }

    const med = medications.find((m) => m.id === parseInt(selectedMedId));
    if (!med) {
      alert('Seleccione un medicamento.');
      return;
    }

    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (med.stock < quantity) {
      alert(`No hay stock suficiente (${quantity} solicitados, ${med.stock} disponibles).`);
      return;
    }

    try {
      const prescriptionData = {
        patient_name: `Receta ${prescriptionNumber}`,
        patient_id: patientId,
        doctor_name: 'No especificado',
        dispenseImmediately,
        items: [
          {
            medication_id: med.id,
            quantity_prescribed: quantity,
            instructions: 'Dispensacion segun receta fisica.'
          }
        ]
      };

      await api.prescriptions.create(prescriptionData);
      setSuccessModal({ open: true, recipeNumber: prescriptionNumber });

      setPrescriptionNumber('');
      setPatientId('');
      setSelectedMedId('');
      setQuantity(1);
      setDispenseImmediately(true);

      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewDetails = async (code) => {
    try {
      const data = await api.prescriptions.getByCode(code);
      setSelectedPrescription(data);
      setIsDetailsModalOpen(true);
    } catch (error) {
      alert('Error al obtener los detalles de la receta.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="bg-warning/10 text-warning px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-warning/20">En Espera</span>;
      case 'dispensed':
        return <span className="bg-secondary/10 text-secondary px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-secondary/20">Dispensada</span>;
      case 'cancelled':
        return <span className="bg-error/10 text-error px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-error/20">Cancelada</span>;
      default:
        return <span className="text-xs uppercase font-bold">{status}</span>;
    }
  };

  const selectedMedication = medications.find((m) => m.id === parseInt(selectedMedId));
  const formatRecipeNumber = (patientName = '') => patientName.replace(/^Receta\s*/i, '').trim();
  const filteredRebajos = prescriptions.filter((presc) => {
    const matchesMedication =
      !medFilter ||
      String(presc.medication_code || '') === medFilter;

    const createdAt = new Date(presc.created_at);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    const matchesFrom = !from || createdAt >= from;
    const matchesTo = !to || createdAt <= to;

    return matchesMedication && matchesFrom && matchesTo;
  });
  const rebajoMedications = [...new Set(
    (prescriptions || [])
      .map((p) => p.medication_code)
      .filter(Boolean)
  )];

  if (loading && medications.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando digitalizacion de recetas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Registrar Receta Medica Fisica</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Digitalice las recetas recibidas en ventanilla para egresar medicamentos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md">
          <div className="flex items-center gap-sm border-b border-outline-variant pb-xs">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>edit_document</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Captura de Receta Fisica</h3>
          </div>

          <form onSubmit={handleSubmitPrescription} className="space-y-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Numero de Receta</label>
                <input type="text" required className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none" placeholder="Ej. 00124587" value={prescriptionNumber} onChange={(e) => setPrescriptionNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Numero de Identificacion</label>
                <input type="text" required className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none" placeholder="Ej. 12345678-A" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
              </div>
            </div>

            <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant space-y-md">
              <h4 className="font-body-lg text-body-lg text-primary font-semibold">Captura de Despacho</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="text-xs font-semibold text-on-surface-variant">Medicamento</label>
                  <select className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none" value={selectedMedId} onChange={(e) => setSelectedMedId(e.target.value)}>
                    <option value="">-- Seleccione un producto del almacen --</option>
                    {medications.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.stock === 0}>
                        {m.name} ({m.active_principle}) - Stock: {m.stock} {m.unit} {m.stock === 0 ? '[AGOTADO]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="text-xs font-semibold text-on-surface-variant">Cantidad a Despachar</label>
                  <input type="number" min="1" className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-outline-variant pt-md">
              <h4 className="font-body-lg text-body-lg text-on-surface mb-sm font-semibold">Detalle de la receta</h4>
              {selectedMedication ? (
                <div className="bg-surface-container-low p-sm rounded border border-outline-variant">
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">{selectedMedication.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Cantidad: <strong className="text-primary">{quantity} {selectedMedication.unit}</strong></p>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant font-body-sm italic">Seleccione un medicamento para continuar.</p>
              )}
            </div>

            <button type="submit" disabled={!selectedMedId || quantity <= 0} className="w-full h-12 rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center font-bold tracking-wider mt-md disabled:opacity-50 disabled:cursor-not-allowed">
              REGISTRAR Y DISPENSAR STOCK
            </button>
          </form>
        </div>

        <div className="bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col h-[650px]">
          <div className="flex items-center gap-sm border-b border-outline-variant pb-xs mb-md">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">history</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Historial de Rebajos</h3>
          </div>
          <div className="grid grid-cols-1 gap-sm mb-md">
            <div className="grid grid-cols-2 gap-sm">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-surface-variant border-none rounded-lg px-3 py-2 text-on-surface text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                title="Desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-surface-variant border-none rounded-lg px-3 py-2 text-on-surface text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                title="Hasta"
              />
            </div>
            <select
              value={medFilter}
              onChange={(e) => setMedFilter(e.target.value)}
              className="bg-surface-variant border-none rounded-lg px-3 py-2 text-on-surface text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">Todos los medicamentos</option>
              {rebajoMedications.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          {filteredRebajos.length > 0 ? (
            <div className="space-y-sm flex-1 overflow-y-auto pr-sm scrollbar-thin">
              {filteredRebajos.map((presc) => (
                <div key={presc.id} className="bg-surface-container-low p-sm rounded border border-outline-variant flex flex-col gap-xs hover:bg-surface-variant/30 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-data-mono text-data-mono text-primary font-bold text-sm">{formatRecipeNumber(presc.patient_name)}</span>
                    {getStatusBadge(presc.status)}
                  </div>
                  <div>
                    <p className="font-body-lg text-body-lg text-on-surface font-semibold truncate leading-tight">Medicamento: {presc.medication_code || 'No disponible'}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">Nombre: {presc.medication_name || 'No disponible'}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">Cantidad rebajada: {presc.quantity_dispensed || 0} {presc.medication_unit || ''}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">DNI: {presc.patient_id}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">Farmacéutico: {user?.name || 'No disponible'}</p>
                  </div>
                  <div className="flex justify-between items-center border-t border-outline-variant/40 pt-1 mt-1 text-[11px] text-on-surface-variant font-label-caps">
                    <span>{new Date(presc.created_at).toLocaleDateString('es-ES')}</span>
                    <button onClick={() => handleViewDetails(presc.code)} className="text-primary hover:underline flex items-center gap-[2px] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">visibility</span>
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-on-surface-variant text-center">
              <p>No se registran rebajos con los filtros seleccionados</p>
            </div>
          )}
        </div>
      </div>

      {isDetailsModalOpen && selectedPrescription && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-lg w-full p-lg shadow-2xl relative">
            <button onClick={() => setIsDetailsModalOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <div className="border-b border-outline-variant pb-xs mb-md flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-primary font-semibold">Receta Digitalizada</h3>
              <span className="font-display-lg text-display-lg text-primary text-xl font-extrabold">{formatRecipeNumber(selectedPrescription.patient_name)}</span>
            </div>
            <div className="space-y-sm max-height-[250px] overflow-y-auto pr-sm scrollbar-thin">
              {selectedPrescription.items?.map((item) => (
                <div key={item.id} className="bg-surface-container-low p-sm rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-on-surface text-sm">{item.medication_name}</span>
                    <span className="text-primary text-sm font-bold">{item.quantity_prescribed} {item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {successModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-md w-full p-lg shadow-2xl relative">
            <button
              onClick={() => setSuccessModal({ open: false, recipeNumber: '' })}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <div className="border-b border-outline-variant pb-xs mb-md">
              <h3 className="font-headline-md text-headline-md text-primary font-semibold">Receta Registrada</h3>
            </div>
            <div className="space-y-sm">
              <p className="text-on-surface">Receta fisica registrada con exito.</p>
              <p className="text-on-surface-variant">
                Numero de receta: <strong className="text-primary">{successModal.recipeNumber}</strong>
              </p>
            </div>
            <div className="flex justify-end pt-md mt-md border-t border-outline-variant">
              <button
                onClick={() => setSuccessModal({ open: false, recipeNumber: '' })}
                className="h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps text-xs font-semibold"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
