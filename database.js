const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

const databaseName = process.env.DB_NAME || 'cbsua_supply_office';
const officeNames = [
  'Accounting Office',
  'Admission Office',
  'Alumni Office',
  'Auxiliary Office',
  'Budget Office',
  'Bids and Awards Committee Office',
  'Business Affairs Unit',
  'Campus PIO',
  "Cashier's Office",
  'College of Engineering',
  'College of Information Technology',
  'Clinic / Infirmary',
  'College of Criminology',
  'College of Education',
  'Commission on Audit',
  'College of Industrial Technology',
  'Curriculum and Instruction Division',
  'Disaster Risk Readiness Management Office',
  'Environmental Science and Agroforestry Program',
  'Extension Services Unit',
  'Gender and Development Office',
  'General Administration and Support Services',
  'Guidance and Counseling Unit',
  'Human Resource Management Office',
  'Informations and Communications Technology Office',
  'Industry Linkages and Development Office',
  'Institutional Planning and Development Office',
  'Library',
  'Motorpool',
  'Office of Campus Administrator',
  'Office of the Student Affairs and Services',
  'Physical Plant and Development Office',
  'Publication Office',
  'Quality Assurance Office',
  'Reading Center',
  "Record's Office",
  "Registrar's Office",
  'Research and Development Center',
  'ROTC / NSTP Office',
  'Sentro ng Wika, Kultura at Sining',
  'Supply Office',
  'UMIS'
];

async function initializeSchema(pool) {
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  for (const statement of schema.split(/;\s*(?:\r?\n|$)/).map(value => value.trim()).filter(Boolean)) {
    await pool.query(statement);
  }
  await synchronizeOfficeDirectory(pool);
}

async function synchronizeOfficeDirectory(pool) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingOffices] = await connection.execute('SELECT id FROM offices ORDER BY id');
    for (const office of existingOffices) {
      await connection.execute(
        'UPDATE offices SET office_code = ? WHERE id = ?',
        [`TMP-${office.id}`, office.id]
      );
    }

    for (const [index, name] of officeNames.entries()) {
      await connection.execute(
        'INSERT IGNORE INTO offices (office_code, name, is_active) VALUES (?, ?, 1)',
        [`TMP-NEW-${index + 1}`, name]
      );
    }

    const [offices] = await connection.execute('SELECT id, name FROM offices ORDER BY id');
    for (const office of offices) {
      const officeIndex = officeNames.indexOf(office.name);
      const officeCode = officeIndex === -1
        ? `LEGACY-${office.id}`
        : `OFF-${String(officeIndex + 1).padStart(3, '0')}`;
      await connection.execute('UPDATE offices SET office_code = ? WHERE id = ?', [
        officeCode,
        office.id
      ]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function seedSampleOfficeAllocations(pool) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [yearRows] = await connection.execute('SELECT YEAR(CURRENT_DATE()) AS allocation_year');
    const allocationYear = Number(yearRows[0].allocation_year);
    const placeholders = officeNames.map(() => '?').join(', ');
    const [officeRows] = await connection.execute(
      `SELECT id, name FROM offices WHERE is_active = 1 AND name IN (${placeholders})`,
      officeNames
    );
    const officeByName = new Map(officeRows.map(office => [office.name, office]));
    const offices = officeNames.map(name => officeByName.get(name)).filter(Boolean);
    if (offices.length !== officeNames.length) {
      throw new Error('Sample allocations require every configured office to be active in the database.');
    }
    const [admins] = await connection.execute(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1"
    );
    if (!admins[0]) throw new Error('An active administrator is required to seed sample allocations.');

    const minimumAnnualPerOffice = 4;
    const minimumCampusStock = offices.length * minimumAnnualPerOffice;
    const [items] = await connection.execute(
      `SELECT id, item_code, name, unit, FLOOR(quantity_on_hand) AS stock
         FROM inventory_items
        WHERE is_active = 1 AND quantity_on_hand >= ?
        ORDER BY name, item_code`,
      [minimumCampusStock]
    );
    const seeded = [];
    const skipped = [];

    for (const item of items) {
      const [existing] = await connection.execute(
        `SELECT
           (SELECT COUNT(*) FROM item_annual_request_budgets
             WHERE item_id = ? AND allocation_year = ?) AS budget_count,
           (SELECT COUNT(*) FROM office_item_request_quotas
             WHERE item_id = ? AND allocation_year = ?) AS quota_count,
           (SELECT COUNT(*) FROM stock_requests
             WHERE item_id = ? AND YEAR(created_at) = ?
               AND status NOT IN ('Rejected', 'Cancelled')) AS request_count`,
        [item.id, allocationYear, item.id, allocationYear, item.id, allocationYear]
      );
      if (Number(existing[0].budget_count) || Number(existing[0].quota_count)
        || Number(existing[0].request_count)) {
        skipped.push({ itemCode: item.item_code, reason: 'Existing budget, allocation, or active request' });
        continue;
      }

      const stock = Number(item.stock);
      const baseAllocation = Math.floor(stock / offices.length);
      const remainder = stock % offices.length;
      if (baseAllocation < minimumAnnualPerOffice) continue;

      await connection.execute(
        `INSERT INTO item_annual_request_budgets
          (item_id, allocation_year, annual_limit, updated_by)
         VALUES (?, ?, ?, ?)`,
        [item.id, allocationYear, stock, admins[0].id]
      );
      for (const [index, office] of offices.entries()) {
        const annualLimit = baseAllocation + (index < remainder ? 1 : 0);
        await connection.execute(
          `INSERT INTO office_item_request_quotas
            (office_id, item_id, allocation_year, annual_limit, updated_by)
           VALUES (?, ?, ?, ?, ?)`,
          [office.id, item.id, allocationYear, annualLimit, admins[0].id]
        );
      }
      seeded.push({
        itemCode: item.item_code,
        itemName: item.name,
        stock,
        officeCount: offices.length,
        minimumAnnualPerOffice: baseAllocation,
        remainder
      });
    }

    await connection.commit();
    return { allocationYear, officeCount: offices.length, seeded, skipped };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function getPassword(name) {
  const password = process.env[name];
  if (!password || password.length < 12 || password.length > 64
    || Buffer.byteLength(password, 'utf8') > 72
    || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error(`${name} must be set to a 12-64 character password containing at least one letter and one number.`);
  }
  return password;
}

async function configureAccount(pool, role, envName, username, firstName, surname, position) {
  const [accounts] = await pool.execute(
    'SELECT id, username, password_hash, position, is_active FROM users WHERE role = ? ORDER BY id LIMIT 1',
    [role]
  );
  const account = accounts[0];
  if (account) {
    if (!account.is_active) {
      throw new Error(`The existing ${role} account is inactive. Enable it in the database before starting the API.`);
    }
    if (!account.position) {
      await pool.execute('UPDATE users SET position = ? WHERE id = ?', [position, account.id]);
    }
    if (account.password_hash) return;
    const passwordHash = await bcrypt.hash(getPassword(envName), 12);
    await pool.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [
      passwordHash,
      account.id
    ]);
    console.log(`Configured the existing ${role} account "${account.username}" from ${envName}.`);
    return;
  }

  const passwordHash = await bcrypt.hash(getPassword(envName), 12);
  const [offices] = await pool.execute('SELECT id FROM offices WHERE name = ? LIMIT 1', ['Supply Office']);
  await pool.execute(
    `INSERT INTO users
      (username, password_hash, role, first_name, surname, position, office_id, must_change_password, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      username,
      passwordHash,
      role,
      firstName,
      surname,
      position,
      offices[0]?.id || null
    ]
  );
  console.log(`Created the initial ${role} account "${username}" using ${envName}.`);
}

async function initializeDatabase() {
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  }

  const connectionOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };
  const connection = await mysql.createConnection(connectionOptions);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${connection.escapeId(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }

  const pool = mysql.createPool({
    ...connectionOptions,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    decimalNumbers: true
  });

  try {
    await initializeSchema(pool);
    await pool.query(`CREATE TABLE IF NOT EXISTS record_sequences (
      sequence_key VARCHAR(80) NOT NULL,
      next_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (sequence_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [attachmentColumns] = await pool.execute(
      "SHOW COLUMNS FROM stock_receipts LIKE 'attachment_name'"
    );
    if (attachmentColumns.length === 0) {
      await pool.query('ALTER TABLE stock_receipts ADD COLUMN attachment_name VARCHAR(255) NULL AFTER remarks');
    }

    await configureAccount(pool, 'admin', 'ADMIN_PASSWORD', process.env.ADMIN_USERNAME || 'admin',
      'Supply Office', 'Administrator', 'Head, Supply Office');
    await configureAccount(pool, 'staff', 'STAFF_PASSWORD', process.env.STAFF_USERNAME || 'staff',
      'Supply Office', 'Staff', 'Supply Staff Officer');

    await pool.query('SELECT 1');
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

module.exports = { initializeDatabase, seedSampleOfficeAllocations };
