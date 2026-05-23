import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { 
  initDatabase, 
  dbGet, 
  dbRun, 
  dbQuery 
} from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const AUTH_COOKIE_NAME = 'drogas_ce_session';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no esta configurado. Defina la variable de entorno antes de iniciar el servidor.');
}

const parseAllowedOrigins = (origins) =>
  (origins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0) {
      return callback(new Error('CORS bloqueado: CORS_ALLOWED_ORIGINS no esta configurado.'));
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  }
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

const unauthorized = (res, message = 'No autenticado.') =>
  res.status(401).json({ error: message });
const forbidden = (res, message = 'No autorizado para este recurso.') =>
  res.status(403).json({ error: message });

// Inicializar la base de datos
await initDatabase();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticacion. Intente nuevamente en 15 minutos.' }
});

const sensitiveOpsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes sensibles. Espere unos minutos e intente de nuevo.' }
});

// Middleware de Autenticación
const authenticateToken = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return unauthorized(res);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return forbidden(res);
    }
    req.user = user;
    next();
  });
};

// Middleware de Autorización por Roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return forbidden(res);
    }
    next();
  };
};

// --- RUTAS DE AUTENTICACIÓN ---

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor durante el login.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/'
  });
  res.json({ message: 'Sesion cerrada correctamente.' });
});

// Obtener datos del usuario en sesión
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, name, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la sesión.' });
  }
});


// --- REGISTRO Y GESTIÓN DE USUARIOS (Solo Admin) ---

// Registrar un nuevo usuario (Solo Admin)
app.post('/api/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { username, password, name, role } = req.body;

  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  if (!['admin', 'farmaceutico'].includes(role)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    // Cifrar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar el usuario
    const result = await dbRun(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, role]
    );

    res.status(201).json({ id: result.id, message: 'Usuario registrado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el usuario en el servidor.' });
  }
});

// Obtener lista de farmacéuticos (para ver a quién hemos registrado)
app.get('/api/users/pharmacists', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const pharmacists = await dbQuery("SELECT id, username, name, role FROM users WHERE role = 'farmaceutico' ORDER BY name ASC");
    res.json(pharmacists);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener farmacéuticos.' });
  }
});


// --- RUTAS DE INVENTARIO ---

// Obtener todos los medicamentos
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const medications = await dbQuery('SELECT * FROM medications ORDER BY name ASC');
    res.json(medications);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el inventario.' });
  }
});

// Agregar un nuevo medicamento (Solo Admin)
app.post('/api/inventory', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { name, active_principle, category, stock, unit, min_stock, shelf_location } = req.body;

  if (!name || !active_principle || !category || stock === undefined || !unit || min_stock === undefined || !shelf_location) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO medications (name, active_principle, category, stock, unit, min_stock, shelf_location) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, active_principle, category, stock, unit, min_stock, shelf_location]
    );

    // Si tiene stock inicial, registrar la transacción de ingreso
    if (stock > 0) {
      await dbRun(
        'INSERT INTO transactions (medication_id, type, quantity, reference_type, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [result.id, 'ingreso', stock, 'manual', req.user.id, 'Ingreso inicial por registro de medicamento']
      );
    }

    res.status(201).json({ id: result.id, message: 'Medicamento registrado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el medicamento.' });
  }
});

// Cargar/Ingresar stock adicional (Admin y Farmacéutico)
app.post('/api/inventory/refill', authenticateToken, authorizeRoles('admin', 'farmaceutico'), async (req, res) => {
  const { medication_id, quantity, notes } = req.body;
  const refillQty = Number(quantity);
  if (!medication_id || !Number.isFinite(refillQty) || refillQty <= 0 || !Number.isInteger(refillQty)) {
    return res.status(400).json({ error: 'ID de medicamento y cantidad válida (mayor a 0) son requeridos.' });
  }

  try {
    const medication = await dbGet('SELECT * FROM medications WHERE id = ?', [medication_id]);
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado.' });
    }

    // Actualizar stock
    await dbRun(
      'UPDATE medications SET stock = stock + ? WHERE id = ?',
      [refillQty, medication_id]
    );

    // Registrar transacción
    await dbRun(
      'INSERT INTO transactions (medication_id, type, quantity, reference_type, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [medication_id, 'ingreso', refillQty, 'manual', req.user.id, notes || 'Ingreso manual de stock']
    );

    res.json({ message: 'Stock actualizado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al reabastecer el stock.' });
  }
});

// Modificar datos de medicamento (Solo Admin)
app.put('/api/inventory/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, active_principle, category, unit, min_stock, shelf_location } = req.body;

  if (!name || !active_principle || !category || !unit || min_stock === undefined || !shelf_location) {
    return res.status(400).json({ error: 'Todos los campos son requeridos para la modificación.' });
  }

  try {
    const medication = await dbGet('SELECT * FROM medications WHERE id = ?', [id]);
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado.' });
    }

    await dbRun(
      'UPDATE medications SET name = ?, active_principle = ?, category = ?, unit = ?, min_stock = ?, shelf_location = ? WHERE id = ?',
      [name, active_principle, category, unit, min_stock, shelf_location, id]
    );

    res.json({ message: 'Medicamento modificado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al modificar el medicamento.' });
  }
});


// --- RUTAS DE RECETAS (PRESCRIPTIONS) ---

// Obtener recetas médicas (Filtradas opcionalmente por estatus)
app.get('/api/prescriptions', authenticateToken, async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT p.* FROM prescriptions p';
  const params = [];

  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY p.created_at DESC';

  try {
    const prescriptions = await dbQuery(sql, params);
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recetas.' });
  }
});

// Obtener los detalles de una receta específica por su código único
app.get('/api/prescriptions/:code', authenticateToken, async (req, res) => {
  const { code } = req.params;

  try {
    const prescription = await dbGet(
      'SELECT p.* FROM prescriptions p WHERE p.code = ?', 
      [code]
    );

    if (!prescription) {
      return res.status(404).json({ error: 'Receta no encontrada.' });
    }

    const items = await dbQuery(
      `SELECT pi.*, m.name as medication_name, m.active_principle, m.unit, m.stock as current_stock 
       FROM prescription_items pi 
       JOIN medications m ON pi.medication_id = m.id 
       WHERE pi.prescription_id = ?`,
      [prescription.id]
    );

    res.json({ ...prescription, items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los detalles de la receta.' });
  }
});

// Registrar una nueva receta (Farmacéuticos y Admins capturando receta física)
app.post('/api/prescriptions', authenticateToken, authorizeRoles('farmaceutico', 'admin'), async (req, res) => {
  const { patient_name, patient_id, doctor_name, items, dispenseImmediately } = req.body;

  if (!patient_name || !patient_id || !doctor_name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos de la receta incompletos.' });
  }

  try {
    // 1. Si se va a dispensar inmediatamente, validar existencias de stock de antemano
    if (dispenseImmediately) {
      const stockErrors = [];
      for (const item of items) {
        const medication = await dbGet('SELECT * FROM medications WHERE id = ?', [item.medication_id]);
        if (!medication) {
          return res.status(404).json({ error: `Medicamento con ID ${item.medication_id} no encontrado.` });
        }
        if (medication.stock < item.quantity_prescribed) {
          stockErrors.push(
            `${medication.name}: Solicitado ${item.quantity_prescribed}, Disponible: ${medication.stock}`
          );
        }
      }

      if (stockErrors.length > 0) {
        return res.status(400).json({ 
          error: 'Stock insuficiente para dispensar la receta de inmediato.', 
          details: stockErrors 
        });
      }
    }

    // 2. Generar código aleatorio único (REC-XXXXXX)
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      const num = Math.floor(100000 + Math.random() * 900000);
      code = `REC-${num}`;
      const existing = await dbGet('SELECT id FROM prescriptions WHERE code = ?', [code]);
      if (!existing) {
        isUnique = true;
      }
    }

    const initialStatus = dispenseImmediately ? 'dispensed' : 'pending';

    // 3. Ejecutar creación
    await dbRun('BEGIN TRANSACTION');

    try {
      // Insertar cabecera de receta
      const headerResult = await dbRun(
        'INSERT INTO prescriptions (code, patient_name, patient_id, doctor_name, status) VALUES (?, ?, ?, ?, ?)',
        [code, patient_name, patient_id, doctor_name, initialStatus]
      );

      const prescriptionId = headerResult.id;

      // Insertar cada uno de los medicamentos detallados
      for (const item of items) {
        const { medication_id, quantity_prescribed, instructions } = item;
        if (!medication_id || !quantity_prescribed || quantity_prescribed <= 0) {
          throw new Error('Datos de medicamentos inválidos en la receta.');
        }

        const quantityDispensed = dispenseImmediately ? quantity_prescribed : 0;

        await dbRun(
          'INSERT INTO prescription_items (prescription_id, medication_id, quantity_prescribed, quantity_dispensed, instructions) VALUES (?, ?, ?, ?, ?)',
          [prescriptionId, medication_id, quantity_prescribed, quantityDispensed, instructions || 'Tomar según indicaciones.']
        );

        // Si es dispensación inmediata, descontar stock e inventariar egreso
        if (dispenseImmediately) {
          await dbRun(
            'UPDATE medications SET stock = stock - ? WHERE id = ?',
            [quantity_prescribed, medication_id]
          );

          await dbRun(
            `INSERT INTO transactions (medication_id, type, quantity, reference_type, reference_id, user_id, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              medication_id,
              'egreso',
              quantity_prescribed,
              'prescription',
              code,
              req.user.id,
              `Registro y despacho inmediato de receta física ${code} de paciente ${patient_name}`
            ]
          );
        }
      }

      await dbRun('COMMIT');
      res.status(201).json({ 
        id: prescriptionId, 
        code, 
        message: dispenseImmediately 
          ? 'Receta física registrada y dispensada inmediatamente con egreso de stock.' 
          : 'Receta física registrada con éxito en cola de espera.' 
      });

    } catch (txError) {
      await dbRun('ROLLBACK');
      throw txError;
    }

  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al emitir la receta.' });
  }
});


// --- RUTA DE DISPENSACIÓN Y EGRESO (Solo Farmacéutico) ---

// Dispensar y realizar los egresos de inventario correspondientes
app.post('/api/prescriptions/dispense', sensitiveOpsLimiter, authenticateToken, authorizeRoles('farmaceutico'), async (req, res) => {
  const { prescription_id } = req.body;

  if (!prescription_id) {
    return res.status(400).json({ error: 'El ID de la receta es requerido.' });
  }

  try {
    // 1. Verificar existencia y estado de la receta
    const prescription = await dbGet('SELECT * FROM prescriptions WHERE id = ?', [prescription_id]);
    if (!prescription) {
      return res.status(404).json({ error: 'Receta no encontrada.' });
    }

    if (prescription.status !== 'pending') {
      return res.status(400).json({ error: `La receta ya no está pendiente. Estado actual: ${prescription.status}` });
    }

    // 2. Obtener items de la receta con stock actual
    const items = await dbQuery(
      `SELECT pi.*, m.name as medication_name, m.stock as current_stock 
       FROM prescription_items pi 
       JOIN medications m ON pi.medication_id = m.id 
       WHERE pi.prescription_id = ?`,
      [prescription_id]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: 'La receta no contiene medicamentos.' });
    }

    // 3. Validar stock suficiente para TODOS los medicamentos antes de operar
    const stockErrors = [];
    for (const item of items) {
      if (item.current_stock < item.quantity_prescribed) {
        stockErrors.push(
          `${item.medication_name}: Solicitado ${item.quantity_prescribed}, Stock Disponible: ${item.current_stock}`
        );
      }
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Stock insuficiente para dispensar la receta.', 
        details: stockErrors 
      });
    }

    // 4. Realizar la dispensación atómica
    // SQLite opera sobre un solo hilo de escritura por archivo, simulamos una transacción robusta
    await dbRun('BEGIN TRANSACTION');

    try {
      for (const item of items) {
        // Decrementar el stock
        await dbRun(
          'UPDATE medications SET stock = stock - ? WHERE id = ?',
          [item.quantity_prescribed, item.medication_id]
        );

        // Actualizar cantidad surtida
        await dbRun(
          'UPDATE prescription_items SET quantity_dispensed = ? WHERE id = ?',
          [item.quantity_prescribed, item.id]
        );

        // Crear la transacción de egreso
        await dbRun(
          `INSERT INTO transactions (medication_id, type, quantity, reference_type, reference_id, user_id, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.medication_id, 
            'egreso', 
            item.quantity_prescribed, 
            'prescription', 
            prescription.code, 
            req.user.id, 
            `Despacho de receta ${prescription.code} para paciente ${prescription.patient_name}`
          ]
        );
      }

      // Marcar la receta como dispensada
      await dbRun('UPDATE prescriptions SET status = "dispensed" WHERE id = ?', [prescription_id]);

      await dbRun('COMMIT');
      res.json({ message: 'Receta despachada con éxito e inventario actualizado.' });

    } catch (txError) {
      await dbRun('ROLLBACK');
      throw txError;
    }

  } catch (error) {
    res.status(500).json({ error: 'Error del servidor durante la dispensación de la receta: ' + error.message });
  }
});


// --- RUTAS DE TRANSACCIONES (HISTORIAL / KÁRDEX) ---

// Obtener todas las transacciones ordenadas cronológicamente
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await dbQuery(
      `SELECT t.*, m.name as medication_name, m.unit, u.name as user_name 
       FROM transactions t 
       JOIN medications m ON t.medication_id = m.id 
       JOIN users u ON t.user_id = u.id 
       ORDER BY t.timestamp DESC`
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de transacciones.' });
  }
});


// --- RUTAS DE SOLICITUD DE REPOSICIÓN ---

// Obtener todas las solicitudes
app.get('/api/replenish', authenticateToken, async (req, res) => {
  try {
    const requests = await dbQuery(
      `SELECT r.*, m.name as medication_name, m.active_principle, m.unit, u.name as user_name 
       FROM replenishment_requests r
       JOIN medications m ON r.medication_id = m.id
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes de reposición.' });
  }
});

// Crear una solicitud (Admin y Farmacéutico)
app.post('/api/replenish', sensitiveOpsLimiter, authenticateToken, authorizeRoles('admin', 'farmaceutico'), async (req, res) => {
  const { medication_id, quantity, notes } = req.body;
  const requestQty = Number(quantity);
  if (!medication_id || !Number.isFinite(requestQty) || requestQty <= 0 || !Number.isInteger(requestQty)) {
    return res.status(400).json({ error: 'ID de medicamento y cantidad válida (mayor a 0) son obligatorios.' });
  }

  try {
    const med = await dbGet('SELECT id FROM medications WHERE id = ?', [medication_id]);
    if (!med) {
      return res.status(404).json({ error: 'Medicamento no encontrado.' });
    }

    const result = await dbRun(
      'INSERT INTO replenishment_requests (medication_id, quantity, notes, user_id, status) VALUES (?, ?, ?, ?, ?)',
      [medication_id, requestQty, notes || '', req.user.id, 'pending']
    );

    res.status(201).json({ id: result.id, message: 'Solicitud de reposición registrada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la solicitud de reposición.' });
  }
});

// Aprobar una solicitud (Solo Admin)
app.post('/api/replenish/:id/approve', sensitiveOpsLimiter, authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const request = await dbGet('SELECT * FROM replenishment_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `La solicitud ya no está pendiente. Estado actual: ${request.status}` });
    }

    await dbRun('BEGIN TRANSACTION');
    try {
      // 1. Cambiar estado a approved
      await dbRun('UPDATE replenishment_requests SET status = "approved" WHERE id = ?', [id]);

      // 2. Incrementar stock del medicamento
      await dbRun(
        'UPDATE medications SET stock = stock + ? WHERE id = ?',
        [request.quantity, request.medication_id]
      );

      // 3. Registrar transacción de ingreso en el Kárdex
      await dbRun(
        `INSERT INTO transactions (medication_id, type, quantity, reference_type, user_id, notes) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          request.medication_id, 
          'ingreso', 
          request.quantity, 
          'manual', 
          req.user.id, 
          `Aprobación de Solicitud de Reposición #${id} (${request.notes || 'Reabastecimiento aprobado'})`
        ]
      );

      await dbRun('COMMIT');
      res.json({ message: 'Solicitud aprobada con éxito. Stock e historial Kárdex actualizados.' });
    } catch (txError) {
      await dbRun('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar la solicitud: ' + error.message });
  }
});

// Rechazar una solicitud (Solo Admin)
app.post('/api/replenish/:id/reject', sensitiveOpsLimiter, authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const request = await dbGet('SELECT * FROM replenishment_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `La solicitud ya no está pendiente. Estado actual: ${request.status}` });
    }

    await dbRun('UPDATE replenishment_requests SET status = "rejected" WHERE id = ?', [id]);
    res.json({ message: 'Solicitud rechazada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar la solicitud.' });
  }
});


// --- ESTADÍSTICAS DEL DASHBOARD ---

// Métricas agregadas y datos recientes para el panel principal
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Totales
    const medStats = await dbGet('SELECT COUNT(*) as total_meds, SUM(stock) as total_stock FROM medications');
    const lowStock = await dbGet('SELECT COUNT(*) as count FROM medications WHERE stock <= min_stock');
    const pendingRec = await dbGet('SELECT COUNT(*) as count FROM prescriptions WHERE status = "pending"');

    // Transacciones recientes (últimas 5)
    const recentTx = await dbQuery(
      `SELECT t.*, m.name as medication_name, u.name as user_name 
       FROM transactions t 
       JOIN medications m ON t.medication_id = m.id 
       JOIN users u ON t.user_id = u.id 
       ORDER BY t.timestamp DESC LIMIT 5`
    );

    // Distribución por categoría
    const categoryDistribution = await dbQuery(
      `SELECT category, COUNT(*) as count, SUM(stock) as stock 
       FROM medications 
       GROUP BY category`
    );

    // Listado de medicamentos con bajo stock crítico para alertas (hasta 5)
    const criticalMeds = await dbQuery(
      `SELECT id, name, active_principle, stock, min_stock, unit 
       FROM medications 
       WHERE stock <= min_stock 
       ORDER BY stock ASC LIMIT 5`
    );

    res.json({
      totalMedications: medStats.total_meds || 0,
      totalStock: medStats.total_stock || 0,
      lowStockAlerts: lowStock.count || 0,
      pendingPrescriptions: pendingRec.count || 0,
      recentTransactions: recentTx,
      categoryDistribution,
      criticalMeds
    });

  } catch (error) {
    res.status(500).json({ error: 'Error al compilar las estadísticas del dashboard.' });
  }
});


// Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de Drogas CE ejecutándose en http://localhost:${PORT}`);
});


