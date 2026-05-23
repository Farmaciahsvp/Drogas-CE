import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite de Drogas CE.');
  }
});

// Convertir llamadas de base de datos a promesas para usar async/await
export const dbQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Inicialización del esquema
export const initDatabase = async () => {
  try {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    // 1. Tabla de Usuarios
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'medico', 'farmaceutico')) NOT NULL
      )
    `);

    // 2. Tabla de Medicamentos (Inventario)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active_principle TEXT NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        min_stock INTEGER NOT NULL DEFAULT 10,
        shelf_location TEXT NOT NULL
      )
    `);

    // 3. Tabla de Recetas Médicas (Prescriptions)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        patient_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        doctor_id INTEGER,
        doctor_name TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'dispensed', 'cancelled')) NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      )
    `);

    // 4. Tabla de Detalles de Receta (Prescription Items)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS prescription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL,
        medication_id INTEGER NOT NULL,
        quantity_prescribed INTEGER NOT NULL,
        quantity_dispensed INTEGER DEFAULT 0,
        instructions TEXT,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
        FOREIGN KEY (medication_id) REFERENCES medications(id)
      )
    `);

    // 5. Tabla de Transacciones de Inventario (Kárdex)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('ingreso', 'egreso')) NOT NULL,
        quantity INTEGER NOT NULL,
        reference_type TEXT CHECK(reference_type IN ('manual', 'prescription')) NOT NULL,
        reference_id TEXT,
        user_id INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (medication_id) REFERENCES medications(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 6. Tabla de Solicitud de Reposición (Replenishment Requests)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS replenishment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        notes TEXT,
        user_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (medication_id) REFERENCES medications(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 7. Indices para consultas frecuentes y trazabilidad
    await dbRun('CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_prescriptions_code ON prescriptions(code)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_prescriptions_status_created ON prescriptions(status, created_at DESC)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_replenish_status_created ON replenishment_requests(status, created_at DESC)');

    console.log('Esquema de base de datos validado correctamente.');

    // Semilla de usuarios por defecto (solo en desarrollo)
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (isDevelopment && userCount.count === 0) {
      console.log('Insertando usuarios semilla...');
      const salt = await bcrypt.genSalt(10);
      const hashAdmin = await bcrypt.hash('admin123', salt);
      const hashMedico = await bcrypt.hash('medico123', salt);
      const hashFarma = await bcrypt.hash('farma123', salt);

      await dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [
        'admin', hashAdmin, 'Carlos ADMINISTRADOR', 'admin'
      ]);
      await dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [
        'medico', hashMedico, 'Dra. Ana MEDICA', 'medico'
      ]);
      await dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [
        'farma', hashFarma, 'Luis FARMACEUTICO', 'farmaceutico'
      ]);
      console.log('Usuarios semilla creados.');
    }

    // Semilla de medicamentos por defecto (solo en desarrollo)
    const medCount = await dbGet('SELECT COUNT(*) as count FROM medications');
    if (isDevelopment && medCount.count === 0) {
      console.log('Insertando medicamentos semilla...');
      const meds = [
        ['Paracetamol 500mg', 'Paracetamol', 'Analgésico', 150, 'Tabletas', 30, 'Estante A-1'],
        ['Amoxicilina 500mg', 'Amoxicilina', 'Antibiótico', 80, 'Cápsulas', 25, 'Estante B-3'],
        ['Ibuprofeno 400mg', 'Ibuprofeno', 'Antiinflamatorio', 200, 'Tabletas', 40, 'Estante A-2'],
        ['Loratadina 10mg', 'Loratadina', 'Antihistamínico', 120, 'Tabletas', 20, 'Estante C-1'],
        ['Metformina 850mg', 'Metformina', 'Antidiabético', 90, 'Tabletas', 30, 'Estante D-2'],
        ['Omeprazol 20mg', 'Omeprazol', 'Antiácido', 250, 'Cápsulas', 50, 'Estante E-1'],
        ['Losartán 50mg', 'Losartán', 'Antihipertensivo', 110, 'Tabletas', 25, 'Estante D-4'],
        ['Salbutamol Inhalador 100mcg', 'Salbutamol', 'Broncodilatador', 45, 'Frascos', 10, 'Estante F-2'],
        ['Atorvastatina 20mg', 'Atorvastatina', 'Cardiovascular', 75, 'Tabletas', 20, 'Estante D-1'],
        ['Azitromicina 500mg', 'Azitromicina', 'Antibiótico', 35, 'Tabletas', 15, 'Estante B-4']
      ];

      for (const med of meds) {
        await dbRun(
          'INSERT INTO medications (name, active_principle, category, stock, unit, min_stock, shelf_location) VALUES (?, ?, ?, ?, ?, ?, ?)',
          med
        );
      }
      console.log('Medicamentos semilla creados.');
    }

  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
};

export default db;
