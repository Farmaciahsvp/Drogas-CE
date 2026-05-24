import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { RefreshCw, FileDown } from 'lucide-react';

export default function ReplenishRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedMedId, setSelectedMedId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [dataScope, setDataScope] = useState('recent');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadData = async (reset = true) => {
    setLoading(true);
    setError('');
    try {
      const [reqPage, medData] = await Promise.all([
        api.replenish.getPage({ scope: dataScope, offset: reset ? 0 : offset }),
        api.inventory.getAll()
      ]);

      setRequests((prev) => (reset ? reqPage.items : [...prev, ...reqPage.items]));
      setOffset(reqPage.nextOffset);
      setHasMore(reqPage.hasMore);
      setMedications(medData || []);
    } catch (err) {
      setError('Error al obtener datos del almacén.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataScope]);

  const replenishmentRows = useMemo(() => {
    return (medications || []).map((m) => {
      const parsed = parseMedicationCodeAndLabel(m);
      const saldo = Number(m.stock || 0);
      // Fallback para registros antiguos sin initial_stock poblado.
      const cuota = Number(m.initial_stock || 0) > 0 ? Number(m.initial_stock) : saldo;
      const aReponer = Math.max(cuota - saldo, 0);
      return {
        id: m.id,
        code: parsed.code,
        medication: `${parsed.label}${m.active_principle ? ` (${m.active_principle})` : ''}`,
        cuota,
        saldo,
        aReponer,
        unit: m.unit || ''
      };
    });
  }, [medications]);

  const exportReplenishmentPdf = () => {
    if (!replenishmentRows.length) {
      setError('No hay medicamentos para exportar.');
      return;
    }

    const now = new Date();
    const fecha = now.toLocaleDateString('es-CR');
    const hora = now.toLocaleTimeString('es-CR');
    const farmaceutico = user?.name || user?.email || 'No identificado';

    const rowsHtml = replenishmentRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.code)}</td>
            <td>${escapeHtml(row.medication)}</td>
            <td style="text-align:right;">${row.cuota}</td>
            <td style="text-align:right;">${row.saldo}</td>
            <td style="text-align:right;font-weight:700;">${row.aReponer}</td>
          </tr>
        `
      )
      .join('');

    const totalAReponer = replenishmentRows.reduce((acc, row) => acc + row.aReponer, 0);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Reporte de Reposición</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #061237; color: #dce8ff; margin: 0; }
          .sheet { padding: 28px; }
          .header { border: 1px solid #2c3f6f; border-radius: 12px; padding: 16px; background: #122044; }
          .brand { color: #66e0da; font-size: 26px; font-weight: 800; margin: 0 0 8px 0; }
          .title { margin: 0; font-size: 20px; font-weight: 700; color: #f1f6ff; }
          .meta { margin-top: 10px; font-size: 13px; color: #9cb3d9; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; border: 1px solid #2c3f6f; border-radius: 10px; overflow: hidden; }
          thead { background: #1b2c58; }
          th, td { padding: 10px 12px; border-bottom: 1px solid #263d70; font-size: 12px; }
          th { text-align: left; color: #69e0d8; text-transform: uppercase; letter-spacing: .4px; }
          tbody tr:nth-child(even) { background: #0f1d42; }
          .footer { margin-top: 14px; font-size: 13px; color: #9cb3d9; }
          .footer strong { color: #66e0da; }
          @media print {
            body { background: #ffffff; color: #0c1734; }
            .header { background: #f3f7ff; border-color: #b9c8ea; }
            .brand { color: #0c6482; }
            .title { color: #15244d; }
            .meta, .footer { color: #334a7a; }
            table { border-color: #b9c8ea; }
            th, td { border-bottom: 1px solid #c8d5f2; }
            thead { background: #e6eefc; }
            tbody tr:nth-child(even) { background: #f7faff; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <p class="brand">Drogas CE | PharmOps Pro</p>
            <h1 class="title">Reporte Simple de Reposición</h1>
            <div class="meta">
              <div><strong>Fecha:</strong> ${fecha}</div>
              <div><strong>Hora:</strong> ${hora}</div>
              <div><strong>Farmacéutico:</strong> ${escapeHtml(farmaceutico)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Código del Medicamento</th>
                <th>Medicamento</th>
                <th>Cuota (Stock Inicial)</th>
                <th>Saldo Inventario</th>
                <th>Cantidad a Reponer</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <strong>Total a reponer:</strong> ${totalAReponer}
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      setError('No fue posible abrir la ventana para exportar el PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

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
        medication_id: parseInt(selectedMedId, 10),
        quantity: parseInt(quantity, 10),
        notes
      });

      setSuccess('Solicitud de reposición registrada con éxito.');
      setSelectedMedId('');
      setQuantity(1);
      setNotes('');
      loadData(true);
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud.');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('¿Está seguro de aprobar esta solicitud de reposición? Se incrementará el stock del medicamento y se registrará la transacción en el kárdex.')) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      const res = await api.replenish.approve(id);
      setSuccess(res.message);
      loadData(true);
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
      loadData(true);
    } catch (err) {
      setError(err.message || 'Error al rechazar la solicitud.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="bg-warning/10 text-warning px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-warning/20">Pendiente</span>;
      case 'approved':
        return <span className="bg-secondary/10 text-secondary px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-secondary/20">Aprobada</span>;
      case 'rejected':
        return <span className="bg-error/10 text-error px-sm py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-error/20">Rechazada</span>;
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
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Solicitudes de Reposición</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Gestión y cálculo simple de reabastecimiento por diferencia de inventario</p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={exportReplenishmentPdf}
            className="h-10 px-md rounded bg-primary text-on-primary font-semibold text-xs flex items-center gap-xs"
            type="button"
          >
            <FileDown size={16} />
            Exportar PDF
          </button>
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

      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Cálculo Simple de Reposición</h3>
          <button onClick={() => loadData(true)} className="p-2 hover:bg-surface-container-high rounded-full text-primary transition-colors flex items-center justify-center" type="button">
            <span className="material-symbols-outlined text-[20px]">sync</span>
          </button>
        </div>

        {replenishmentRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-high/40 border-b border-outline-variant">
                <tr>
                  <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Código del Medicamento</th>
                  <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant">Medicamento</th>
                  <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant text-right">Cuota (Stock Inicial)</th>
                  <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant text-right">Saldo Inventario</th>
                  <th className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant text-right">Cantidad a Reponer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {replenishmentRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-highest transition-colors">
                    <td className="px-md py-md font-data-mono text-data-mono text-primary font-semibold">{row.code}</td>
                    <td className="px-md py-md text-on-surface">{row.medication}</td>
                    <td className="px-md py-md text-on-surface text-right">{row.cuota}</td>
                    <td className="px-md py-md text-on-surface text-right">{row.saldo}</td>
                    <td className="px-md py-md text-right font-bold text-secondary">{row.aReponer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-lg text-on-surface-variant italic">No hay medicamentos para calcular reposición.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
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
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
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

        <div className="lg:col-span-2 bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm flex flex-col h-[550px]">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-xs">
              <span className="material-symbols-outlined">assignment_returned</span>
              Listado Histórico de Solicitudes
            </h3>
            <button onClick={() => loadData(true)} className="p-2 hover:bg-surface-container-high rounded-full text-primary transition-colors flex items-center justify-center" type="button">
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
                        <td className="px-md py-md font-data-mono text-data-mono font-bold text-primary">#SR-{req.id}</td>
                        <td className="px-md py-md">
                          <p className="font-semibold text-on-surface leading-none">{req.medication_name}</p>
                          <span className="text-[10px] text-on-surface-variant">{req.active_principle}</span>
                        </td>
                        <td className="px-md py-md font-data-mono text-data-mono font-bold text-on-surface">{req.quantity} {req.unit}</td>
                        <td className="px-md py-md text-on-surface-variant">{req.user_name}</td>
                        <td className="px-md py-md text-on-surface-variant max-w-[150px] truncate" title={req.notes}>{req.notes || '-'}</td>
                        <td className="px-md py-md">{getStatusBadge(req.status)}</td>
                        {user.role === 'admin' && (
                          <td className="px-md py-md text-right">
                            {req.status === 'pending' ? (
                              <div className="flex gap-xs justify-end">
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  className="bg-secondary-container/20 text-secondary border border-secondary/30 px-2 py-1 rounded text-xs hover:bg-secondary hover:text-on-secondary transition-all font-semibold"
                                  type="button"
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => handleReject(req.id)}
                                  className="bg-error-container/20 text-error border border-error/30 px-2 py-1 rounded text-xs hover:bg-error hover:text-on-error transition-all font-semibold"
                                  type="button"
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

                {hasMore && (
                  <div className="flex justify-center p-md border-t border-outline-variant">
                    <button
                      onClick={() => loadData(false)}
                      className="h-9 px-md rounded bg-surface-container-high border border-outline-variant text-on-surface font-semibold text-xs"
                      type="button"
                    >
                      Cargar más
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-xl text-on-surface-variant italic">No hay solicitudes de reposición registradas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseMedicationCodeAndLabel(medication) {
  const explicitCode = String(medication?.code || '').trim();
  const rawName = String(medication?.name || '').trim();
  const fallbackLabel = rawName || '-';

  if (explicitCode) {
    return { code: explicitCode, label: fallbackLabel };
  }

  const match = rawName.match(/^([0-9]{2,4}-[0-9]{2,6}-[0-9]{2,6})\s*(.*)$/);
  if (match) {
    const code = match[1];
    const rest = (match[2] || '').trim();
    return { code, label: rest || code };
  }

  return { code: '-', label: fallbackLabel };
}
