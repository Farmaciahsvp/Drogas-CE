import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { RefreshCw } from 'lucide-react';

export default function Inventory({ user, searchTerm: globalSearchTerm = '' }) {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all, low, out

  // Estados de modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Estados de formularios
  const [selectedMed, setSelectedMed] = useState(null);
  
  // Agregar/Editar medicamento
  const [medForm, setMedForm] = useState({
    name: '',
    active_principle: '',
    category: 'Psicotrópico',
    stock: 0,
    unit: 'Tabletas',
    min_stock: 10,
    shelf_location: 'Almacén General'
  });

  // Reabastecer stock
  const [refillForm, setRefillForm] = useState({
    medication_id: '',
    quantity: '',
    notes: ''
  });

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.inventory.getAll();
      setMedications(data);
    } catch (err) {
      setError('Error al obtener la lista de medicamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleOpenAdd = () => {
    setMedForm({
      name: '',
      active_principle: '',
      category: 'Psicotrópico',
      stock: 0,
      unit: 'Tabletas',
      min_stock: 10,
      shelf_location: 'Almacén General'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenRefill = (med) => {
    setRefillForm({
      medication_id: med.id,
      quantity: '',
      notes: ''
    });
    setSelectedMed(med);
    setIsRefillModalOpen(true);
  };

  const handleOpenEdit = (med) => {
    setSelectedMed(med);
    setMedForm({
      name: med.name,
      active_principle: med.active_principle,
      category: med.category,
      unit: med.unit,
      min_stock: med.min_stock,
      shelf_location: med.shelf_location || 'Almacén General'
    });
    setIsEditModalOpen(true);
  };

  // Envíos de formulario
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.inventory.create(medForm);
      setIsAddModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRefillSubmit = async (e) => {
    e.preventDefault();
    if (!refillForm.quantity || refillForm.quantity <= 0) {
      alert('Por favor ingrese una cantidad válida mayor a 0');
      return;
    }
    try {
      await api.inventory.refill(
        refillForm.medication_id,
        parseInt(refillForm.quantity),
        refillForm.notes || 'Ingreso de reabastecimiento en almacén'
      );
      setIsRefillModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.inventory.update(selectedMed.id, medForm);
      setIsEditModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  // Combinar el término de búsqueda global con el local
  const activeSearch = globalSearchTerm || localSearchTerm;

  // Filtrado de medicamentos
  const filteredMedications = medications.filter((med) => {
    const matchesSearch = 
      med.name.toLowerCase().includes(activeSearch.toLowerCase()) || 
      med.active_principle.toLowerCase().includes(activeSearch.toLowerCase()) ||
      med.category.toLowerCase().includes(activeSearch.toLowerCase());

    const matchesCategory = categoryFilter === '' || med.category === categoryFilter;

    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = med.stock <= med.min_stock && med.stock > 0;
    } else if (stockFilter === 'out') {
      matchesStock = med.stock === 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Lista única de categorías para el filtro
  const categories = [...new Set(medications.map((m) => m.category))];

  if (loading && medications.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="ml-3 font-semibold text-primary">Cargando inventario...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Inventario Farmacéutico</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Catálogo completo de medicamentos y existencias en almacén</p>
        </div>
        {user.role === 'admin' && (
          <button 
            onClick={handleOpenAdd}
            className="h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 transition-all flex items-center gap-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Registrar Medicamento
          </button>
        )}
      </div>

      {error && (
        <div className="bg-error-container/20 border border-error text-error p-md rounded-xl flex items-center gap-sm">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* BARRA DE FILTROS */}
      <div className="bg-surface-container p-md rounded-xl border border-outline-variant shadow-sm space-y-md">
        <div className="flex flex-col md:flex-row gap-md items-center justify-between">
          
          {/* Input local (si no se usa la barra de búsqueda superior) */}
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              type="text"
              className="w-full bg-surface-variant border-none rounded-full pl-10 pr-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
              placeholder="Buscar localmente en tabla..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              disabled={!!globalSearchTerm} // Deshabilitado si hay búsqueda global activa
            />
            {globalSearchTerm && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold">Búsqueda Global</span>
            )}
          </div>

          {/* Selectores */}
          <div className="flex gap-md w-full md:w-auto">
            <select
              className="flex-1 md:flex-initial bg-surface-variant border-none rounded-full px-4 py-2 text-on-surface text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas las Categorías</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="flex-1 md:flex-initial bg-surface-variant border-none rounded-full px-4 py-2 text-on-surface text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">Todo el Inventario</option>
              <option value="low">Stock Crítico</option>
              <option value="out">Sin Existencias</option>
            </select>
          </div>

        </div>
      </div>

      {/* TABLA DE INVENTARIO */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        {filteredMedications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-surface-container-high/40 border-b border-outline-variant">
                <tr>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Código del Medicamento</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Principio Activo</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Categoría</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Existencia</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Mínimo</th>
                  <th className="px-lg py-sm font-label-caps text-label-caps text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredMedications.map((med) => {
                  const isLow = med.stock <= med.min_stock && med.stock > 0;
                  const isOut = med.stock === 0;
                  return (
                    <tr key={med.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-lg py-md">
                        <p className="font-body-lg text-body-lg text-on-surface font-semibold">{med.name}</p>
                      </td>
                      <td className="px-lg py-md text-on-surface-variant">{med.active_principle}</td>
                      <td className="px-lg py-md">
                        <span className="bg-primary-container/10 text-primary border border-primary/20 px-sm py-0.5 rounded text-xs font-semibold">
                          {med.category}
                        </span>
                      </td>
                      <td className={`px-lg py-md font-data-mono text-data-mono font-bold ${
                        isOut ? 'text-error' : isLow ? 'text-warning' : 'text-on-surface'
                      }`}>
                        {med.stock} {med.unit}
                      </td>

                      <td className="px-lg py-md font-data-mono text-data-mono text-on-surface-variant">
                        {med.min_stock} {med.unit}
                      </td>
                      <td className="px-lg py-md text-center">
                        <div className="flex gap-sm justify-center">
                          {(user.role === 'admin' || user.role === 'farmaceutico') && (
                            <button 
                              onClick={() => handleOpenRefill(med)}
                              className="bg-surface-variant px-sm py-1.5 rounded text-primary hover:bg-primary hover:text-on-primary transition-all font-label-caps text-label-caps text-xs font-semibold"
                            >
                              Ingresar Stock
                            </button>
                          )}
                          {user.role === 'admin' && (
                            <button 
                              onClick={() => handleOpenEdit(med)}
                              className="bg-surface-variant px-sm py-1.5 rounded text-on-surface hover:bg-surface-container-high transition-all font-label-caps text-label-caps text-xs font-semibold"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-xl text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2">warning</span>
            <p className="font-body-lg">No se encontraron medicamentos con los filtros seleccionados.</p>
          </div>
        )}
      </div>

      {/* --- MODAL: AGREGAR MEDICAMENTO --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-lg w-full p-lg shadow-2xl relative">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <h3 className="font-headline-md text-headline-md text-primary mb-md border-b border-outline-variant pb-xs">
              Registrar Nuevo Medicamento
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-md">
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



              <div className="flex gap-md justify-end pt-sm border-t border-outline-variant">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-10 px-md rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-caps text-label-caps text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps text-xs font-semibold"
                >
                  Guardar Medicamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REABASTECER STOCK --- */}
      {isRefillModalOpen && selectedMed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-md w-full p-lg shadow-2xl relative">
            <button 
              onClick={() => setIsRefillModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <h3 className="font-headline-md text-headline-md text-secondary mb-md border-b border-outline-variant pb-xs">
              Registrar Ingreso de Stock
            </h3>
            
            <p className="text-sm text-on-surface-variant mb-md">
              Aumentar existencias para <strong className="text-on-surface">{selectedMed.name}</strong>.<br /> 
              Stock actual: <strong className="text-secondary">{selectedMed.stock} {selectedMed.unit}</strong>.
            </p>

            <form onSubmit={handleRefillSubmit} className="space-y-md">
              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Cantidad a Ingresar</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Ej. 50"
                  value={refillForm.quantity}
                  onChange={(e) => setRefillForm({ ...refillForm, quantity: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label className="text-xs font-semibold text-on-surface-variant">Notas del Ingreso (Opcional)</label>
                <textarea
                  className="bg-surface-variant border-none rounded-lg px-4 py-2 text-on-surface focus:ring-1 focus:ring-primary text-sm focus:outline-none h-20 resize-none"
                  placeholder="Ej. Compra de inventario mensual..."
                  value={refillForm.notes}
                  onChange={(e) => setRefillForm({ ...refillForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-md justify-end pt-sm border-t border-outline-variant">
                <button 
                  type="button" 
                  onClick={() => setIsRefillModalOpen(false)}
                  className="h-10 px-md rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-caps text-label-caps text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="h-10 px-md rounded bg-secondary text-on-secondary font-label-caps text-label-caps text-xs font-semibold"
                >
                  Confirmar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDITAR MEDICAMENTO --- */}
      {isEditModalOpen && selectedMed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-lg w-full p-lg shadow-2xl relative">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <h3 className="font-headline-md text-headline-md text-primary mb-md border-b border-outline-variant pb-xs">
              Modificar Medicamento
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-md">
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

              <div className="flex gap-md justify-end pt-sm border-t border-outline-variant">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-10 px-md rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-caps text-label-caps text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps text-xs font-semibold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
