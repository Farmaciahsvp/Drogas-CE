import React, { useState, useEffect } from 'react';
import { api, diagnostics } from '../utils/api';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings({ user }) {
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pharmError, setPharmError] = useState('');
  const [pharmSuccess, setPharmSuccess] = useState('');

  const [medError, setMedError] = useState('');
  const [medSuccess, setMedSuccess] = useState('');
  const [logError, setLogError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logFromDate, setLogFromDate] = useState('');
  const [logToDate, setLogToDate] = useState('');
  const [apiHealth, setApiHealth] = useState([]);
  const [apiRecentErrors, setApiRecentErrors] = useState([]);

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

  const loadLogs = async () => {
    setLogError('');
    try {
      const data = diagnostics.getApiCalls();
      const mapped = (data || []).map((d, idx) => ({
        id: `${d.at || 'n/a'}-${idx}`,
        type: d.ok ? 'ok' : 'error',
        timestamp: d.at,
        operation: d.scope,
        duration_ms: d.ms,
        details: d.error || 'Operación completada correctamente'
      }));
      setLogs(mapped.reverse());
    } catch (err) {
      setLogError('Error al obtener logs técnicos.');
    }
  };

  const loadApiDiagnostics = () => {
    const summary = diagnostics.summarizeApiCalls();
    const recentErrors = diagnostics
      .getApiCalls()
      .filter((r) => !r.ok)
      .slice(-20)
      .reverse();
    setApiHealth(summary);
    setApiRecentErrors(recentErrors);
  };

  useEffect(() => {
    loadPharmacists();
    loadLogs();
    loadApiDiagnostics();
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
    const usernameValue = pharmForm.username.trim().toLowerCase();
    const isEmail = usernameValue.includes('@');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-z0-9._-]{3,}$/;
    if (isEmail && !emailRegex.test(usernameValue)) {
      setPharmError('El correo no tiene un formato valido.');
      return;
    }
    if (!isEmail && !usernameRegex.test(usernameValue)) {
      setPharmError('El usuario debe tener minimo 3 caracteres y solo letras, numeros, punto, guion o guion bajo.');
      return;
    }
    const hasUpper = /[A-Z]/.test(pharmForm.password);
    const hasLower = /[a-z]/.test(pharmForm.password);
    const hasNumber = /[0-9]/.test(pharmForm.password);
    if (pharmForm.password.length < 8 || !hasUpper || !hasLower || !hasNumber) {
      setPharmError('La contrasena debe tener minimo 8 caracteres, mayuscula, minuscula y numero.');
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

  const filteredLogs = logs.filter((log) => {
    const matchesType = logTypeFilter === 'all' || log.type === logTypeFilter;
    const text = `${log.operation || ''} ${log.details || ''}`.toLowerCase();
    const matchesSearch = !logSearch || text.includes(logSearch.toLowerCase());

    const ts = new Date(log.timestamp);
    const fromOk = !logFromDate || ts >= new Date(`${logFromDate}T00:00:00`);
    const toOk = !logToDate || ts <= new Date(`${logToDate}T23:59:59`);

    return matchesType && matchesSearch && fromOk && toOk;
  });

  const handleDownloadLogsTxt = () => {
    const lines = [];
    lines.push('Drogas CE - Reporte de Logs');
    lines.push(`Generado por: ${user?.name || 'Sistema'}`);
    lines.push(`Fecha: ${new Date().toLocaleString('es-ES')}`);
    lines.push(`Filtros => tipo: ${logTypeFilter}, busqueda: ${logSearch || '-'}, desde: ${logFromDate || '-'}, hasta: ${logToDate || '-'}`);
    lines.push('='.repeat(90));

    filteredLogs.forEach((log) => {
      const sign = log.type === 'ingreso' ? '+' : '-';
    lines.push(`[${new Date(log.timestamp).toLocaleString('es-ES')}] ${log.type.toUpperCase()}`);
    lines.push(`Operación: ${log.operation || '-'}`);
    lines.push(`Duración: ${log.duration_ms ?? '-'} ms`);
    lines.push(`Detalle: ${log.details || '-'}`);
      lines.push('-'.repeat(90));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `drogas-ce-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
                    placeholder="Min. 8, con mayúscula, minúscula y número"
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

      <div className="bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md">
        <div className="flex items-center justify-between gap-sm border-b border-outline-variant pb-xs">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-warning text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Salud de API (Diagnóstico)</h3>
          </div>
          <div className="flex gap-xs">
            <button
              onClick={loadApiDiagnostics}
              className="h-9 px-sm rounded bg-surface-container-high border border-outline-variant text-on-surface text-xs font-semibold"
            >
              Refrescar
            </button>
            <button
              onClick={() => {
                diagnostics.clearApiCalls();
                loadApiDiagnostics();
              }}
              className="h-9 px-sm rounded bg-error-container/20 border border-error/30 text-error text-xs font-semibold"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-surface-container-high/40 border-b border-outline-variant">
              <tr>
                <th className="px-sm py-sm">Operación</th>
                <th className="px-sm py-sm">Llamadas</th>
                <th className="px-sm py-sm">Errores</th>
                <th className="px-sm py-sm">Promedio ms</th>
                <th className="px-sm py-sm">P95 ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {apiHealth.length === 0 ? (
                <tr>
                  <td className="px-sm py-sm text-on-surface-variant" colSpan={5}>Sin métricas registradas aún.</td>
                </tr>
              ) : apiHealth.slice(0, 20).map((row) => (
                <tr key={row.scope}>
                  <td className="px-sm py-sm font-data-mono text-data-mono">{row.scope}</td>
                  <td className="px-sm py-sm">{row.count}</td>
                  <td className={`px-sm py-sm ${row.errors > 0 ? 'text-error font-semibold' : 'text-secondary'}`}>{row.errors}</td>
                  <td className="px-sm py-sm">{row.avgMs}</td>
                  <td className="px-sm py-sm">{row.p95Ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {apiRecentErrors.length > 0 && (
          <div className="space-y-xs">
            <p className="text-xs font-semibold text-error">Últimos errores API</p>
            <div className="max-h-40 overflow-y-auto space-y-xs pr-xs scrollbar-thin">
              {apiRecentErrors.map((e, idx) => (
                <div key={`${e.at}-${idx}`} className="bg-error-container/10 border border-error/20 rounded p-xs text-[11px]">
                  <p className="font-data-mono text-data-mono">{e.scope}</p>
                  <p className="text-on-surface-variant">{e.at} | {e.ms}ms</p>
                  <p className="text-error">{e.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface-container p-lg rounded-xl border border-outline-variant shadow-sm space-y-md">
        <div className="flex items-center justify-between gap-sm border-b border-outline-variant pb-xs">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Reporte de Logs</h3>
          </div>
          <div className="flex gap-xs">
            <button
              onClick={loadLogs}
              className="h-9 px-sm rounded bg-surface-container-high border border-outline-variant text-on-surface text-xs font-semibold flex items-center gap-xs"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
            <button
              onClick={() => {
                diagnostics.clearApiCalls();
                loadLogs();
                loadApiDiagnostics();
              }}
              className="h-9 px-sm rounded bg-error-container/20 border border-error/30 text-error text-xs font-semibold"
            >
              Borrar Logs
            </button>
          </div>
        </div>

        {logError && (
          <div className="bg-error-container/20 border border-error text-error p-sm rounded-lg text-sm">
            {logError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-sm">
          <input type="date" value={logFromDate} onChange={(e) => setLogFromDate(e.target.value)} className="bg-surface-variant border-none rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none" />
          <input type="date" value={logToDate} onChange={(e) => setLogToDate(e.target.value)} className="bg-surface-variant border-none rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none" />
          <select value={logTypeFilter} onChange={(e) => setLogTypeFilter(e.target.value)} className="bg-surface-variant border-none rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none">
            <option value="all">Todos</option>
            <option value="ok">Exitosas</option>
            <option value="error">Errores</option>
          </select>
          <input type="text" placeholder="Buscar por operación/detalle técnico" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="md:col-span-2 bg-surface-variant border-none rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none" />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">Resultados: {filteredLogs.length}</p>
          <button
            onClick={handleDownloadLogsTxt}
            className="h-10 px-md rounded bg-primary text-on-primary font-label-caps text-label-caps text-xs font-bold"
          >
            Descargar Logs TXT
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-xs pr-xs scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <p className="text-xs italic text-on-surface-variant">No hay logs para los filtros seleccionados.</p>
          ) : (
            filteredLogs.slice(0, 100).map((log) => (
              <div key={log.id} className="bg-surface-container-low p-sm rounded border border-outline-variant text-xs">
                <p className={`font-semibold ${log.type === 'error' ? 'text-error' : 'text-secondary'}`}>
                  [{new Date(log.timestamp).toLocaleString('es-ES')}] {log.type.toUpperCase()}
                </p>
                <p className="text-on-surface">
                  {log.operation || '-'} | {log.duration_ms ?? '-'} ms
                </p>
                <p className="text-on-surface-variant">{log.details || '-'}</p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
