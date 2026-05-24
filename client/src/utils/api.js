const API_URL = 'http://localhost:5000/api';
import { supabase } from './supabase';
const OFFLINE_QUEUE_KEY = 'offline_sync_queue_v1';
const DASHBOARD_TIMEOUT_MS = 10000;
const SESSION_CACHE_TTL_MS = 120000;
const SESSION_CACHE_PREFIX = 'drogasce_cache_v1:';
const WEEKLY_DISPENSE_WINDOW_DAYS = 90;

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const setCurrentUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

const readOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeOfflineQueue = (queue) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const isOfflineLikeError = (err) => {
  const msg = String(err?.message || '').toLowerCase();
  return !navigator.onLine || msg.includes('failed to fetch') || msg.includes('network');
};

const enqueueOffline = (kind, payload) => {
  const enrichedPayload = { ...payload };
  if (kind === 'prescriptions.create' && !enrichedPayload.__clientRequestId) {
    enrichedPayload.__clientRequestId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  const queue = readOfflineQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    kind,
    payload: enrichedPayload,
    created_at: new Date().toISOString()
  });
  writeOfflineQueue(queue);
};

const stableRecCodeFromClientId = (clientId) => {
  const digits = String(clientId || '').replace(/\D/g, '');
  const lastSix = digits.slice(-6).padStart(6, '0');
  return `REC-${lastSix}`;
};

const CATEGORY_FILTERS = {
  all: 'Todos',
  psychotropic: 'Psicotrópicos',
  narcotic: 'Estupefacientes',
  other: 'Otros'
};

const normalizeCategoryBucket = (rawCategory) => {
  const c = String(rawCategory || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (c.includes('psicotrop')) return 'psychotropic';
  if (c.includes('estupefac')) return 'narcotic';
  return 'other';
};

const buildWeeklyDispenseAverages = (prescriptions) => {
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const byFilter = {
    all: Array(7).fill(0),
    psychotropic: Array(7).fill(0),
    narcotic: Array(7).fill(0),
    other: Array(7).fill(0)
  };
  const dateOccurrencesByFilter = {
    all: Array.from({ length: 7 }, () => new Set()),
    psychotropic: Array.from({ length: 7 }, () => new Set()),
    narcotic: Array.from({ length: 7 }, () => new Set()),
    other: Array.from({ length: 7 }, () => new Set())
  };

  (prescriptions || []).forEach((p) => {
    const created = new Date(p.created_at);
    if (Number.isNaN(created.getTime())) return;
    const day = created.getDay();
    const dateKey = created.toISOString().slice(0, 10);
    const categories = (p.prescription_items || [])
      .map((it) => normalizeCategoryBucket(it?.medications?.category))
      .filter(Boolean);
    const filtersForRx = new Set(['all', ...categories]);

    filtersForRx.forEach((filterKey) => {
      byFilter[filterKey][day] += 1;
      dateOccurrencesByFilter[filterKey][day].add(dateKey);
    });
  });

  const output = {};
  Object.keys(byFilter).forEach((filterKey) => {
    output[filterKey] = dayLabels.map((dayLabel, dayIndex) => {
      const total = byFilter[filterKey][dayIndex];
      const occurrences = dateOccurrencesByFilter[filterKey][dayIndex].size || 1;
      return {
        day: dayLabel,
        avg: Number((total / occurrences).toFixed(2)),
        total
      };
    });
  });

  return {
    filters: CATEGORY_FILTERS,
    series: output
  };
};

const logApiError = (scope, error, extra = {}) => {
  console.error('[api-error]', {
    scope,
    message: error?.message || String(error),
    ...extra
  });
};

const cacheUserScope = () => {
  try {
    const current = getCurrentUser();
    return current?.id || 'anon';
  } catch {
    return 'anon';
  }
};
const cacheKey = (k) => `${SESSION_CACHE_PREFIX}${cacheUserScope()}:${k}`;
const readCache = (k) => {
  try {
    const raw = localStorage.getItem(cacheKey(k));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > SESSION_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};
const writeCache = (k, data) => {
  try {
    localStorage.setItem(cacheKey(k), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore cache write errors
  }
};
const clearCacheByPrefix = (prefix) => {
  try {
    const fullPrefix = `${SESSION_CACHE_PREFIX}${cacheUserScope()}:${prefix}`;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore cache clear errors
  }
};
const invalidateOperationalCache = () => {
  clearCacheByPrefix('dashboard:');
  clearCacheByPrefix('inventory:');
  clearCacheByPrefix('prescriptions:');
  clearCacheByPrefix('transactions:');
  clearCacheByPrefix('replenish:');
};

const clearAllAppCache = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SESSION_CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore cache clear errors
  }
};

export const flushOfflineQueue = async () => {
  const queue = readOfflineQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;

  for (const op of queue) {
    try {
      if (op.kind === 'inventory.create') await api.inventory.create(op.payload, true);
      else if (op.kind === 'inventory.update') await api.inventory.update(op.payload.id, op.payload.data, true);
      else if (op.kind === 'replenish.create') await api.replenish.create(op.payload, true);
      else if (op.kind === 'prescriptions.create') await api.prescriptions.create(op.payload, true);
      else remaining.push(op);
      flushed += 1;
    } catch (err) {
      if (isOfflineLikeError(err)) remaining.push(op);
    }
  }

  writeOfflineQueue(remaining);
  return { flushed, remaining: remaining.length };
};

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = {
    ...options,
    headers,
    credentials: 'include'
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      setCurrentUser(null);
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/';
      }
    }
    throw new Error(data.error || 'Algo salio mal. Intente de nuevo.');
  }

  return data;
}

const mapPrescriptionWithItems = (prescription, items) => ({
  ...prescription,
  items: items.map((it) => ({
    id: it.id,
    medication_id: it.medication_id,
    quantity_prescribed: it.quantity_prescribed,
    quantity_dispensed: it.quantity_dispensed,
    instructions: it.instructions,
    medication_name: it.medications?.name,
    active_principle: it.medications?.active_principle,
    unit: it.medications?.unit,
    current_stock: it.medications?.stock
  }))
});

export const api = {
  auth: {
    login: async (email, password) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) {
        throw new Error(authError.message || 'No fue posible iniciar sesion en Supabase.');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, name, role')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('No se pudo cargar el perfil del usuario.');
      }

      clearAllAppCache();
      const response = { user: profileData };
      setCurrentUser(response.user);
      return response;
    },
    logout: async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        clearAllAppCache();
        setCurrentUser(null);
      }
    },
    me: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        throw new Error('Sesion invalida.');
      }
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, name, role')
        .eq('id', authData.user.id)
        .single();
      if (profileError) {
        throw new Error(profileError.message || 'No se pudo cargar el perfil.');
      }
      return profileData;
    }
  },
  inventory: {
    getAll: async () => {
      const cached = readCache('inventory:all');
      if (cached) return cached;
      const { data, error } = await supabase
        .from('medications')
        .select('id, name, active_principle, category, stock, unit, min_stock, shelf_location')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message || 'Error al cargar inventario.');
      writeCache('inventory:all', data || []);
      return data;
    },
    create: async (medicationData, fromReplay = false) => {
      const payload = {
        name: medicationData.name,
        active_principle: medicationData.active_principle,
        category: medicationData.category,
        stock: Number(medicationData.stock) || 0,
        unit: medicationData.unit,
        min_stock: Number(medicationData.min_stock) || 0,
        shelf_location: medicationData.shelf_location || 'Almacen General'
      };
      try {
        const { data, error } = await supabase.from('medications').insert([payload]).select('id').single();
        if (error) throw new Error(error.message || 'Error al crear medicamento.');
        invalidateOperationalCache();
        return data;
      } catch (err) {
        if (!fromReplay && isOfflineLikeError(err)) {
          enqueueOffline('inventory.create', medicationData);
          return { queued: true };
        }
        throw err;
      }
    },
    refill: async (medication_id, quantity, notes) => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser?.user?.id;
      const qty = Number(quantity);
      if (uid && Number.isInteger(qty) && qty > 0) {
        const { data: med, error: medError } = await supabase
          .from('medications')
          .select('id, stock')
          .eq('id', medication_id)
          .single();
        if (!medError && med) {
          const { error: upError } = await supabase
            .from('medications')
            .update({ stock: med.stock + qty })
            .eq('id', medication_id);
          if (!upError) {
            await supabase.from('transactions').insert([{
              medication_id,
              type: 'ingreso',
              quantity: qty,
              reference_type: 'manual',
              user_id: uid,
              notes: notes || 'Ingreso manual de stock'
            }]);
            invalidateOperationalCache();
            return { ok: true };
          }
        }
      }
      throw new Error('No fue posible registrar el ingreso de stock en Supabase.');
    },
    update: async (id, medicationData, fromReplay = false) => {
      const payload = {
        name: medicationData.name,
        active_principle: medicationData.active_principle,
        category: medicationData.category,
        unit: medicationData.unit,
        min_stock: Number(medicationData.min_stock) || 0,
        shelf_location: medicationData.shelf_location || 'Almacen General'
      };
      try {
        const { data, error } = await supabase.from('medications').update(payload).eq('id', id).select('id').single();
        if (error) throw new Error(error.message || 'Error al actualizar medicamento.');
        invalidateOperationalCache();
        return data;
      } catch (err) {
        if (!fromReplay && isOfflineLikeError(err)) {
          enqueueOffline('inventory.update', { id, data: medicationData });
          return { queued: true };
        }
        throw err;
      }
    }
  },
  inventoryAudits: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('inventory_audits')
        .select('id, notes, created_by, created_at, profiles!inventory_audits_created_by_fkey(name), inventory_audit_items(id, medication_id, expected_stock, observed_stock, difference, medications(name, active_principle, unit))')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message || 'Error al cargar historial de tomas.');
      return (data || []).map((audit) => ({
        id: audit.id,
        notes: audit.notes,
        created_by: audit.created_by,
        created_at: audit.created_at,
        pharmacist_name: audit.profiles?.name || 'No disponible',
        items: (audit.inventory_audit_items || []).map((it) => ({
          id: it.id,
          medication_id: it.medication_id,
          expected_stock: it.expected_stock,
          observed_stock: it.observed_stock,
          difference: it.difference,
          medication_code: it.medications?.name || '',
          medication_name: it.medications?.active_principle || '',
          unit: it.medications?.unit || ''
        }))
      }));
    },
    create: async ({ notes, items }) => {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Debe ingresar la cantidad observada de al menos un medicamento.');
      }
      const normalizedItems = items.map((it) => ({
        medication_id: Number(it.medication_id),
        observed_stock: Number(it.observed_stock)
      }));
      if (normalizedItems.some((it) => !Number.isInteger(it.medication_id) || !Number.isFinite(it.observed_stock) || it.observed_stock < 0)) {
        throw new Error('Las cantidades observadas deben ser validas y mayores o iguales a 0.');
      }

      const { data, error } = await supabase.rpc('create_inventory_audit', {
        p_notes: notes || '',
        p_items: normalizedItems
      });
      if (error) throw new Error(error.message || 'No se pudo registrar la toma de inventario.');
      invalidateOperationalCache();
      return data;
    }
  },
  prescriptions: {
    getAll: async (status = '', scope = 'recent') => {
      const cKey = `prescriptions:${status || 'all'}:${scope}`;
      const cached = readCache(cKey);
      if (cached) return cached;
      const sinceIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      let query = supabase
        .from('prescriptions')
        .select('id, code, patient_name, patient_id, doctor_name, status, created_at, created_by, profiles!prescriptions_created_by_fkey(name), prescription_items(quantity_dispensed, medications(name, active_principle, unit))')
        .order('created_at', { ascending: false });
      if (scope !== 'all') query = query.gte('created_at', sinceIso);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw new Error(error.message || 'Error al cargar recetas.');
      const mapped = (data || []).map((p) => ({
        ...p,
        medication_code: p.prescription_items?.[0]?.medications?.name || '',
        medication_name: p.prescription_items?.[0]?.medications?.active_principle || '',
        medication_unit: p.prescription_items?.[0]?.medications?.unit || '',
        quantity_dispensed: p.prescription_items?.[0]?.quantity_dispensed || 0,
        pharmacist_name: p.profiles?.name || 'No disponible'
      }));
      writeCache(cKey, mapped);
      return mapped;
    },
    getByCode: async (code) => {
      const { data: presc, error: prescError } = await supabase
        .from('prescriptions')
        .select('id, code, patient_name, patient_id, doctor_name, status, created_at, created_by, profiles!prescriptions_created_by_fkey(name)')
        .eq('code', code)
        .single();
      if (!prescError) {
        const { data: items, error: itemsError } = await supabase
          .from('prescription_items')
          .select('id, medication_id, quantity_prescribed, quantity_dispensed, instructions, medications(name, active_principle, unit, stock)')
          .eq('prescription_id', presc.id);
        if (!itemsError) {
          const mapped = mapPrescriptionWithItems(presc, items || []);
          return {
            ...mapped,
            pharmacist_name: presc.profiles?.name || 'No disponible'
          };
        }
      }
      throw new Error('No se pudo cargar el detalle de receta desde Supabase.');
    },
    create: async (prescriptionData, fromReplay = false) => {
      const {
        patient_name,
        patient_id,
        doctor_name,
        items,
        dispenseImmediately,
        __clientRequestId
      } = prescriptionData;

      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser?.user?.id;
      if (!uid) throw new Error('Sesion invalida.');

      const code = __clientRequestId
        ? stableRecCodeFromClientId(__clientRequestId)
        : `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const status = 'pending';

      const { data: header, error: headerError } = await supabase
        .from('prescriptions')
        .insert([{ code, patient_name, patient_id, doctor_name, status, created_by: uid }])
        .select('id, code')
        .single();

      if (headerError && String(headerError.message || '').toLowerCase().includes('duplicate key')) {
        const { data: existing } = await supabase
          .from('prescriptions')
          .select('id, code')
          .eq('code', code)
          .single();
        if (existing?.id) {
          return { id: existing.id, code: existing.code, deduped: true };
        }
      }
      if (!headerError) {
        const rows = items.map((item) => ({
          prescription_id: header.id,
          medication_id: item.medication_id,
          quantity_prescribed: item.quantity_prescribed,
          quantity_dispensed: 0,
          instructions: item.instructions || 'Tomar segun indicaciones.'
        }));
        const { error: itemsError } = await supabase.from('prescription_items').insert(rows);
        if (!itemsError) {
          if (dispenseImmediately) {
            await api.prescriptions.dispense(header.id);
          }
          invalidateOperationalCache();
          return { id: header.id, code: header.code, status: dispenseImmediately ? 'dispensed' : 'pending' };
        }
        logApiError('prescriptions.create.itemsInsert', itemsError, { prescription_id: header.id });
      }
      if (headerError) {
        logApiError('prescriptions.create.headerInsert', headerError, { code });
      }
      const err = new Error('No se pudo registrar la receta en Supabase.');
      if (!fromReplay && !navigator.onLine) {
        enqueueOffline('prescriptions.create', prescriptionData);
        return { queued: true };
      }
      throw err;
    },
    dispense: async (prescriptionId) => {
      const { data, error } = await supabase.rpc('dispense_prescription', {
        p_prescription_id: prescriptionId
      });
      if (error) throw new Error(error.message || 'No se pudo dispensar la receta.');
      invalidateOperationalCache();
      return data;
    },
    update: async (prescriptionId, payload) => {
      const { data, error } = await supabase.rpc('update_prescription_record', {
        p_prescription_id: prescriptionId,
        p_recipe_number: payload.recipe_number,
        p_patient_id: payload.patient_id,
        p_doctor_name: payload.doctor_name || 'No especificado',
        p_medication_id: payload.medication_id,
        p_quantity: payload.quantity,
        p_instructions: payload.instructions || null
      });
      if (error) throw new Error(error.message || 'No se pudo actualizar la receta.');
      invalidateOperationalCache();
      return data;
    },
    remove: async (prescriptionId) => {
      const { data, error } = await supabase.rpc('delete_prescription_record', {
        p_prescription_id: prescriptionId
      });
      if (error) throw new Error(error.message || 'No se pudo eliminar la receta.');
      invalidateOperationalCache();
      return data;
    }
  },
  transactions: {
    getAll: async (scope = 'recent') => {
      const cKey = `transactions:${scope}`;
      const cached = readCache(cKey);
      if (cached) return cached;
      const sinceIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      let query = supabase
        .from('transactions')
        .select('id, medication_id, type, quantity, reference_type, reference_id, user_id, created_at, notes, medications(name, unit), profiles(name)')
        .order('created_at', { ascending: false });
      if (scope !== 'all') query = query.gte('created_at', sinceIso);
      let { data, error } = await query;
      if (error) {
        // Fallback when profile join permissions are stricter in a target environment.
        let fallbackQuery = supabase
          .from('transactions')
          .select('id, medication_id, type, quantity, reference_type, reference_id, user_id, created_at, notes, medications(name, unit)')
          .order('created_at', { ascending: false });
        if (scope !== 'all') fallbackQuery = fallbackQuery.gte('created_at', sinceIso);
        const retry = await fallbackQuery;
        data = retry.data;
        error = retry.error;
      }
      if (!error) {
        const txRows = data || [];
        const rxCodes = [...new Set(
          txRows
            .filter((t) => t.reference_type === 'prescription' && t.reference_id)
            .map((t) => t.reference_id)
        )];

        let rxMap = {};
        if (rxCodes.length > 0) {
          const { data: rxRows } = await supabase
            .from('prescriptions')
            .select('code, patient_name')
            .in('code', rxCodes);
          rxMap = (rxRows || []).reduce((acc, r) => {
            acc[r.code] = String(r.patient_name || '').replace(/^Receta\s*/i, '').trim();
            return acc;
          }, {});
        }

        const mapped = txRows.map((t) => ({
          id: t.id,
          medication_id: t.medication_id,
          type: t.type,
          quantity: t.quantity,
          reference_type: t.reference_type,
          reference_id: t.reference_id,
          user_id: t.user_id,
          timestamp: t.created_at,
          notes: t.notes,
          reference_recipe_number: t.reference_type === 'prescription' ? (rxMap[t.reference_id] || null) : null,
          medication_name: t.medications?.name,
          unit: t.medications?.unit,
          user_name: t.profiles?.name || 'Usuario'
        }));
        writeCache(cKey, mapped);
        return mapped;
      }
      throw new Error(error.message || 'Error al cargar transacciones.');
    }
  },
  users: {
    create: async (userData) => {
      const payload = {
        name: userData.name,
        username: userData.username,
        password: userData.password
      };
      const { data, error } = await supabase.functions.invoke('create-pharmacist', {
        body: payload
      });
      if (error) {
        const detailed =
          data?.error ||
          error?.context?.error ||
          error?.message ||
          'Error al crear farmacéutico.';
        throw new Error(detailed);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    getPharmacists: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, role')
        .eq('role', 'farmaceutico')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message || 'Error al obtener farmacÃ©uticos.');
      return data || [];
    }
  },
  replenish: {
    getAll: async (scope = 'recent') => {
      const cKey = `replenish:${scope}`;
      const cached = readCache(cKey);
      if (cached) return cached;
      const sinceIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      let query = supabase
        .from('replenishment_requests')
        .select('id, medication_id, quantity, notes, user_id, status, created_at, medications(name, active_principle, unit), profiles!replenishment_requests_user_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (scope !== 'all') query = query.gte('created_at', sinceIso);
      const { data, error } = await query;
      if (!error) {
        const mapped = (data || []).map((r) => ({
          id: r.id,
          medication_id: r.medication_id,
          quantity: r.quantity,
          notes: r.notes,
          user_id: r.user_id,
          status: r.status,
          created_at: r.created_at,
          medication_name: r.medications?.name,
          active_principle: r.medications?.active_principle,
          unit: r.medications?.unit,
          user_name: r.profiles?.name
        }));
        writeCache(cKey, mapped);
        return mapped;
      }
      throw new Error(error.message || 'Error al cargar solicitudes de reposicion.');
    },
    create: async (requestData, fromReplay = false) => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser?.user?.id;
      if (!uid) throw new Error('Sesion invalida.');
      const payload = { ...requestData, user_id: uid, status: 'pending' };
      try {
        const { data, error } = await supabase.from('replenishment_requests').insert([payload]).select('id').single();
        if (error) throw new Error(error.message || 'Error al crear solicitud.');
        invalidateOperationalCache();
        return data;
      } catch (err) {
        if (!fromReplay && isOfflineLikeError(err)) {
          enqueueOffline('replenish.create', requestData);
          return { queued: true };
        }
        throw err;
      }
    },
    approve: async (id) => {
      const { data, error } = await supabase.rpc('review_replenishment_request', {
        p_request_id: id,
        p_decision: 'approved'
      });
      if (error) throw new Error(error.message || 'Error al aprobar solicitud.');
      invalidateOperationalCache();
      return data;
    },
    reject: async (id) => {
      const { data, error } = await supabase.rpc('review_replenishment_request', {
        p_request_id: id,
        p_decision: 'rejected'
      });
      if (error) throw new Error(error.message || 'Error al rechazar solicitud.');
      invalidateOperationalCache();
      return data;
    }
  },
  dashboard: {
    getStats: async () => {
      const cached = readCache('dashboard:stats');
      if (cached) return cached;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado al cargar dashboard.')), DASHBOARD_TIMEOUT_MS);
      });

      const mapRecentTransactions = (txRows) => (txRows || []).map((t) => ({
        id: t.id,
        type: t.type,
        quantity: t.quantity,
        timestamp: t.created_at,
        medication_name: t.medications?.active_principle || t.medications?.name,
        unit: t.medications?.unit,
        user_name: t.profiles?.name || 'Usuario',
        notes: t.notes
      }));

      const loadPromise = (async () => {
        const sinceIso = new Date(Date.now() - (WEEKLY_DISPENSE_WINDOW_DAYS * 24 * 60 * 60 * 1000)).toISOString();
        const [statsRes, txRes, dispensedRes] = await Promise.all([
          supabase.rpc('get_dashboard_stats'),
          supabase
            .from('transactions')
            .select('id, type, quantity, created_at, medications(name, active_principle, unit), profiles(name), notes')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('prescriptions')
            .select('id, created_at, status, prescription_items(medications(category))')
            .eq('status', 'dispensed')
            .gte('created_at', sinceIso)
        ]);
        let txRows = txRes.data;
        let txErr = txRes.error;
        if (txErr) {
          const fallbackTx = await supabase
            .from('transactions')
            .select('id, type, quantity, created_at, medications(name, active_principle, unit), notes')
            .order('created_at', { ascending: false })
            .limit(5);
          txRows = fallbackTx.data;
          txErr = fallbackTx.error;
        }
        if (txErr) throw new Error(txErr.message || 'Error al cargar transacciones recientes.');
        const recentTx = mapRecentTransactions(txRows);
        const weeklyDispenseAverages = dispensedRes.error
          ? { filters: CATEGORY_FILTERS, series: { all: [], psychotropic: [], narcotic: [], other: [] } }
          : buildWeeklyDispenseAverages(dispensedRes.data || []);
        if (dispensedRes.error) {
          logApiError('dashboard.weeklyDispenseAverages', dispensedRes.error);
        }

        if (statsRes.error) {
          const [medRes, prescRes] = await Promise.all([
            supabase.from('medications').select('id, name, active_principle, category, stock, min_stock, unit'),
            supabase.from('prescriptions').select('id, status')
          ]);

          if (medRes.error) throw new Error(medRes.error.message || 'Error al cargar inventario.');
          if (prescRes.error) throw new Error(prescRes.error.message || 'Error al cargar recetas.');

          const meds = medRes.data || [];
          const prescs = prescRes.data || [];

          const byCategory = meds.reduce((acc, m) => {
            if (!acc[m.category]) acc[m.category] = { category: m.category, count: 0, stock: 0 };
            acc[m.category].count += 1;
            acc[m.category].stock += m.stock || 0;
            return acc;
          }, {});

          const payload = {
            totalMedications: meds.length,
            totalStock: meds.reduce((acc, m) => acc + (m.stock || 0), 0),
            totalAmpollas: meds.filter((m) => (m.unit || '').toLowerCase() === 'ampollas').reduce((acc, m) => acc + (m.stock || 0), 0),
            totalTabletas: meds.filter((m) => (m.unit || '').toLowerCase() === 'tabletas').reduce((acc, m) => acc + (m.stock || 0), 0),
            lowStockAlerts: meds.filter((m) => (m.stock || 0) <= (m.min_stock || 0)).length,
            pendingPrescriptions: prescs.filter((p) => p.status === 'pending').length,
            categoryDistribution: Object.values(byCategory),
            criticalMeds: meds
              .filter((m) => (m.stock || 0) <= (m.min_stock || 0))
              .sort((a, b) => (a.stock || 0) - (b.stock || 0))
              .slice(0, 5),
            recentTransactions: recentTx,
            weeklyDispenseAverages
          };
          writeCache('dashboard:stats', payload);
          return payload;
        }

        const payload = {
          ...(statsRes.data || {}),
          recentTransactions: recentTx,
          weeklyDispenseAverages
        };
        writeCache('dashboard:stats', payload);
        return payload;
      })();

      return Promise.race([loadPromise, timeoutPromise]);
    }
  },
  warmup: {
    primeAfterLogin: async () => {
      await Promise.allSettled([
        api.dashboard.getStats(),
        api.inventory.getAll(),
        api.prescriptions.getAll('', 'recent'),
        api.transactions.getAll('recent'),
        api.replenish.getAll('recent')
      ]);
    }
  }
};


