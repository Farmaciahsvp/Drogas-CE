const API_URL = 'http://localhost:5000/api';
import { supabase } from './supabase';
const OFFLINE_QUEUE_KEY = 'offline_sync_queue_v1';

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

      const response = { user: profileData };
      setCurrentUser(response.user);
      return response;
    },
    logout: async () => {
      try {
        await supabase.auth.signOut();
      } finally {
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
      const { data, error } = await supabase
        .from('medications')
        .select('id, name, active_principle, category, stock, unit, min_stock, shelf_location')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message || 'Error al cargar inventario.');
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
  prescriptions: {
    getAll: async (status = '') => {
      let query = supabase
        .from('prescriptions')
        .select('id, code, patient_name, patient_id, doctor_name, status, created_at, prescription_items(medications(name, active_principle))')
        .order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw new Error(error.message || 'Error al cargar recetas.');
      return (data || []).map((p) => ({
        ...p,
        medication_code: p.prescription_items?.[0]?.medications?.name || '',
        medication_name: p.prescription_items?.[0]?.medications?.active_principle || ''
      }));
    },
    getByCode: async (code) => {
      const { data: presc, error: prescError } = await supabase
        .from('prescriptions')
        .select('id, code, patient_name, patient_id, doctor_name, status, created_at')
        .eq('code', code)
        .single();
      if (!prescError) {
        const { data: items, error: itemsError } = await supabase
          .from('prescription_items')
          .select('id, medication_id, quantity_prescribed, quantity_dispensed, instructions, medications(name, active_principle, unit, stock)')
          .eq('prescription_id', presc.id);
        if (!itemsError) return mapPrescriptionWithItems(presc, items || []);
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
          await api.prescriptions.dispense(header.id);
          return { id: header.id, code: header.code };
        }
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
      return data;
    }
  },
  transactions: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, medication_id, type, quantity, reference_type, reference_id, user_id, created_at, notes, medications(name, unit), profiles(name)')
        .order('created_at', { ascending: false });
      if (!error) {
        return (data || []).map((t) => ({
          id: t.id,
          medication_id: t.medication_id,
          type: t.type,
          quantity: t.quantity,
          reference_type: t.reference_type,
          reference_id: t.reference_id,
          user_id: t.user_id,
          timestamp: t.created_at,
          notes: t.notes,
          medication_name: t.medications?.name,
          unit: t.medications?.unit,
          user_name: t.profiles?.name
        }));
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
    getAll: async () => {
      const { data, error } = await supabase
        .from('replenishment_requests')
        .select('id, medication_id, quantity, notes, user_id, status, created_at, medications(name, active_principle, unit), profiles!replenishment_requests_user_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (!error) {
        return (data || []).map((r) => ({
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
      return data;
    },
    reject: async (id) => {
      const { data, error } = await supabase.rpc('review_replenishment_request', {
        p_request_id: id,
        p_decision: 'rejected'
      });
      if (error) throw new Error(error.message || 'Error al rechazar solicitud.');
      return data;
    }
  },
  dashboard: {
    getStats: async () => {
      const [medRes, prescRes, txRes] = await Promise.all([
        supabase.from('medications').select('id, name, active_principle, category, stock, min_stock, unit'),
        supabase.from('prescriptions').select('id, status'),
        supabase.from('transactions').select('id, type, quantity, created_at, medications(name, active_principle, unit), profiles(name), notes').order('created_at', { ascending: false }).limit(5)
      ]);
      if (!medRes.error && !prescRes.error && !txRes.error) {
        const meds = medRes.data || [];
        const prescs = prescRes.data || [];
        const recentTx = (txRes.data || []).map((t) => ({
          id: t.id,
          type: t.type,
          quantity: t.quantity,
          timestamp: t.created_at,
          medication_name: t.medications?.active_principle || t.medications?.name,
          unit: t.medications?.unit,
          user_name: t.profiles?.name,
          notes: t.notes
        }));

        const totalMedications = meds.length;
        const totalStock = meds.reduce((acc, m) => acc + (m.stock || 0), 0);
        const totalAmpollas = meds
          .filter((m) => (m.unit || '').toLowerCase() === 'ampollas')
          .reduce((acc, m) => acc + (m.stock || 0), 0);
        const totalTabletas = meds
          .filter((m) => (m.unit || '').toLowerCase() === 'tabletas')
          .reduce((acc, m) => acc + (m.stock || 0), 0);
        const lowStockAlerts = meds.filter((m) => (m.stock || 0) <= (m.min_stock || 0)).length;
        const pendingPrescriptions = prescs.filter((p) => p.status === 'pending').length;

        const byCategory = meds.reduce((acc, m) => {
          if (!acc[m.category]) acc[m.category] = { category: m.category, count: 0, stock: 0 };
          acc[m.category].count += 1;
          acc[m.category].stock += m.stock || 0;
          return acc;
        }, {});
        const categoryDistribution = Object.values(byCategory);

        const criticalMeds = meds
          .filter((m) => (m.stock || 0) <= (m.min_stock || 0))
          .sort((a, b) => (a.stock || 0) - (b.stock || 0))
          .slice(0, 5);

        return {
          totalMedications,
          totalStock,
          totalAmpollas,
          totalTabletas,
          lowStockAlerts,
          pendingPrescriptions,
          recentTransactions: recentTx,
          categoryDistribution,
          criticalMeds
        };
      }
      throw new Error('No se pudieron calcular estadisticas desde Supabase.');
    }
  }
};


