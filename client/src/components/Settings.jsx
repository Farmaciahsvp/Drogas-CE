import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings({ user }) {
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pharmError, setPharmError] = useState('');
  const [pharmSuccess, setPharmSuccess] = useState('');

  const [medError, setMedError] = useState('');
  const [medSuccess, setMedSuccess] = useState('');

  // Formulario de Farmacéutico
  const [pharmForm, setPharmForm] = useState({
    name: '',
    username: '',
    password: ''
  });

  // Formulario de Medicamento
  const [medForm, setMedForm] = useState({
    name: '',
    active_principle: '',
    category: 'Psicotrópico',
    stock: 0,
    unit: 'Tabletas',
    min_stock: 10,
    shelf_location: 'Almacén General'
  });

  // Cargar farmacéuticos al montar
  const loadPharmacists = async () => {
    setLoading(true);
    setPharmError('');
    try {
      const data = await api.users.getPharmacists();
      setPharmacists(data);
    } catch (err) {
      setPharmError('Error al obtener la lista de farmacéuticos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPharmacists();
  }, []);

  // Registro de farmacéutico
  const handlePharmSubmit = async (e) => {
    e.preventDefault();
    setPharmError('');
    setPharmSuccess('');

    if (!pharmForm.name || !pharmForm.username || !pharmForm.password) {
      setPharmError('Todos los campos son obligatorios.');
      return;
    }

    try {
      const payload = {
        ...pharmForm,
        role: 'farmaceutico'
      };

      await api.users.create(payload);
      setPharmSuccess(`¡Farmacéutico "${pharmForm.name}" registrado con éxito!`);
      setPharmForm({ name: '', username: '', password: '' });
      loadPharmacists();
    } catch (err) {
      setPharmError(err.message || 'Error al registrar el farmacéutico.');
    }
  };

  // Registro de medicamento
  const handleMedSubmit = async (e) => {
    e.preventDefault();
    setMedError('');
    setMedSuccess('');

    const { name, active_principle, category, stock, unit, min_stock, shelf_location } = medForm;
    if (!name || !active_principle || !category || stock === undefined || !unit || min_stock === undefined || !shelf_location) {
      setMedError('Todos los campos del medicamento son obligatorios.');
      return;
    }

    try {
      await api.inventory.create(medForm);
      setMedSuccess(`¡Medicamento "${name}" registrado con éxito en el inventario!`);
      // Resetear
      setMedForm({
        name: '',
        active_principle: '',
        category: 'Psicotrópico',
        stock: 0,
        unit: 'Tabletas',
        min_stock: 10,
        shelf_location: 'Almacén General'
      });
    } catch (err) {
      setMedError(err.message || 'Error al registrar el medicamento.');
    }
  };

  return (
    <div className="space-y-lg">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Configuración y Administración</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Alta de personal farmacéutico y catálogo de medicamentos de Drogas CE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        
        {/* PANEL: REGISTRAR FARMACÉUTICOS */}
        <div className="bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md flex flex-col justify-between">
          <div className="space-y-md">
            <div className="flex items-center gap-sm border-b border-outline-variant pb-xs">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Registrar Farmacéutico</h3>
            </div>

            <p className="text-sm text-on-surface-variant">
              Crea credenciales para un nuevo farmacéutico. Tendrá acceso para registrar recetas físicas, egresar stock en ventanilla y auditar el historial Kárdex.
            </p>

            {pharmError && (
              <div className="bg-error-container/20 border border-error text-error p-sm rounded-lg flex items-center gap-sm text-sm">
                <AlertCircle size={16} />
                <span>{pharmError}</span>
              </div>
            )}

            {pharmSuccess && (
              <div className="bg-secondary-container/20 border border-secondary text-secondary p-sm rounded-lg flex items-center gap-sm text-sm">
                <CheckCircle size={16} />
                <span>{pharmSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePharmSubmit} className="space-y-sm">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Ej. Luis Roberto García"
                  value={pharmForm.name}
                  onChange={(e) => setPharmForm({ ...pharmForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="text-xs font-semibold text-on-surface-variant">Nombre de Usuario (Login)</label>
                  <input
                    type="text"
                    required
                    className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                    placeholder="Ej. lgarcia"
                    value={pharmForm.username}
                    onChange={(e) => setPharmForm({ ...pharmForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="text-xs font-semibold text-on-surface-variant">Contraseña</label>
                  <input
                    type="password"
                    required
                    className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                    placeholder="Min. 4 caracteres"
                    value={pharmForm.password}
                    onChange={(e) => setPharmForm({ ...pharmForm, password: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 mt-md rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center font-bold tracking-wider"
              >
                REGISTRAR FARMACÉUTICO
              </button>
            </form>
          </div>

          {/* Listado de farmacéuticos registrados */}
          <div className="mt-lg border-t border-dashed border-outline-variant pt-md">
            <h4 className="font-body-lg text-body-lg text-primary mb-sm font-semibold flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">group</span>
              Farmacéuticos en el Sistema ({pharmacists.length})
            </h4>

            {loading ? (
              <div className="flex items-center gap-sm text-xs text-on-surface-variant py-2">
                <RefreshCw className="animate-spin text-primary" size={14} />
                Cargando personal...
              </div>
            ) : pharmacists.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-xs pr-xs scrollbar-thin">
                {pharmacists.map((ph) => (
                  <div key={ph.id} className="bg-surface-container-low p-sm rounded border border-outline-variant flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-on-surface">{ph.name}</p>
                      <p className="text-on-surface-variant text-[10px]">Usuario: @{ph.username}</p>
                    </div>
                    <span className="bg-secondary-container/10 text-secondary border border-secondary/20 px-xs py-0.5 rounded text-[9px] font-bold uppercase">
                      Farmacéutico
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-on-surface-variant">No hay farmacéuticos registrados.</p>
            )}
          </div>
        </div>

        {/* PANEL: REGISTRAR MEDICAMENTOS */}
        <div className="bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md">
          <div className="flex items-center gap-sm border-b border-outline-variant pb-xs">
            <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Registrar Medicamento</h3>
          </div>

          <p className="text-sm text-on-surface-variant">
            Registra una nueva molécula o producto en el catálogo. Se le asignará stock inicial, unidad, ubicación física y nivel mínimo para activar alertas.
          </p>

          {medError && (
            <div className="bg-error-container/20 border border-error text-error p-sm rounded-lg flex items-center gap-sm text-sm">
              <AlertCircle size={16} />
              <span>{medError}</span>
            </div>
          )}

          {medSuccess && (
            <div className="bg-secondary-container/20 border border-secondary text-secondary p-sm rounded-lg flex items-center gap-sm text-sm">
              <CheckCircle size={16} />
              <span>{medSuccess}</span>
            </div>
          )}

          <form onSubmit={handleMedSubmit} className="space-y-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Código del Medicamento</label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}"
                  title="Formato requerido: 000-00-0000"
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Ej. 000-00-0000"
                  value={medForm.name}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 9) val = val.slice(0, 9);
                    let formatted = '';
                    if (val.length > 0) formatted += val.slice(0, 3);
                    if (val.length > 3) formatted += '-' + val.slice(3, 5);
                    if (val.length > 5) formatted += '-' + val.slice(5, 9);
                    setMedForm({ ...medForm, name: formatted });
                  }}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Principio Activo</label>
                <input
                  type="text"
                  required
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Ej. Paracetamol"
                  value={medForm.active_principle}
                  onChange={(e) => setMedForm({ ...medForm, active_principle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Categoría</label>
                <select
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  value={medForm.category}
                  onChange={(e) => setMedForm({ ...medForm, category: e.target.value })}
                >
                  <option value="Psicotrópico">Psicotrópico</option>
                  <option value="Estupefaciente">Estupefaciente</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Unidad de Medida</label>
                <select
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  value={medForm.unit}
                  onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                >
                  <option value="Tabletas">Tabletas</option>
                  <option value="Ampollas">Ampollas</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Stock Inicial</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  value={medForm.stock}
                  onChange={(e) => setMedForm({ ...medForm, stock: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  value={medForm.min_stock}
                  onChange={(e) => setMedForm({ ...medForm, min_stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-10 mt-lg rounded bg-secondary text-on-secondary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center justify-center font-bold tracking-wider"
            >
              REGISTRAR MEDICAMENTO
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
