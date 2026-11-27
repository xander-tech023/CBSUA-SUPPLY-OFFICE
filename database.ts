import process from 'node:process';
try { process.loadEnvFile('.env'); } catch {}

const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

const databaseName = process.env.DB_NAME || 'cbsua_supply_office';
types.setTypeParser(types.builtins.DATE, value => value);
types.setTypeParser(types.builtins.TIMESTAMP, value => value);
const idTables = new Set([
  'offices', 'users', 'user_sessions', 'item_categories', 'suppliers', 'inventory_items',
  'stock_requests', 'stock_receipts', 'stock_issuances', 'stock_movements',
  'request_status_history', 'password_reset_requests'
]);
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

function toPostgresQuery(sql) {
  let parameterIndex = 0;
  let query = sql.replace(/\?/g, () => `$${++parameterIndex}`);

  const insert = /^\s*INSERT\s+INTO\s+([a-z_]+)/i.exec(query);
  if (insert && idTables.has(insert[1].toLowerCase()) && !/\bRETURNING\b/i.test(query)) {
    query = query.replace(/;\s*$/, '') + ' RETURNING id';
  }
  return query;
}

function createExecutor(client) {
  async function execute(sql, parameters = []) {
    const result = await client.query(toPostgresQuery(sql), parameters);
    if (result.command === 'SELECT') return [result.rows, result.fields];
    const firstRow = result.rows && result.rows[0];
    return [{
      insertId: firstRow?.id,
      affectedRows: result.rowCount
    }, result.fields];
  }

  return {
    execute,
    query: execute,
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    release() {
      client.release();
    }
  };
}

function createPool(options) {
  const pool = new Pool(options);
  return {
    execute: (sql, parameters = []) => createExecutor(pool).execute(sql, parameters),
    query: (sql, parameters = []) => createExecutor(pool).query(sql, parameters),
    async getConnection() {
      return createExecutor(await pool.connect());
    },
    end: () => pool.end()
  };
}

function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = '';
  let dollarQuote = '';
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = '';
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (quote === "'" && sql[index + 1] === "'") index += 1;
        else quote = '';
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '$') {
      const delimiter = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
      if (delimiter) dollarQuote = delimiter[0];
    } else if (character === ';') {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const remainder = sql.slice(start).trim();
  if (remainder) statements.push(remainder);
  return statements;
}

async function initializeSchema(pool) {
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  for (const statement of splitSqlStatements(schema)) {
    await pool.query(statement);
  }

  let lowStockViewDefinition;
  const [inventoryActiveColumns] = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'inventory_items' AND column_name = 'is_active'`
  );
  if (inventoryActiveColumns[0]?.data_type === 'boolean') {
    const [views] = await pool.query(
      `SELECT pg_get_viewdef(to_regclass('v_low_stock_items'), true) AS definition`
    );
    if (views[0]?.definition) {
      lowStockViewDefinition = views[0].definition.replace(
        /\bWHERE\s+i\.is_active\b/i,
        'WHERE i.is_active <> 0'
      );
      if (lowStockViewDefinition === views[0].definition) {
        throw new Error('Cannot migrate inventory_items.is_active because v_low_stock_items has an unsupported definition.');
      }
      await pool.query('DROP VIEW v_low_stock_items');
    }
  }

  const booleanColumns = [
    ['offices', 'is_active'],
    ['users', 'must_change_password'],
    ['users', 'is_active'],
    ['item_categories', 'is_active'],
    ['suppliers', 'is_active'],
    ['inventory_items', 'is_active']
  ];
  for (const [table, column] of booleanColumns) {
    const [columns] = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (columns[0]?.data_type !== 'boolean') continue;

    await pool.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
    await pool.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE SMALLINT
       USING CASE WHEN "${column}" THEN 1 ELSE 0 END`
    );
    await pool.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT 1`);
  }

  if (lowStockViewDefinition) {
    await pool.query(`CREATE VIEW v_low_stock_items AS ${lowStockViewDefinition}`);
  }

  for (const [index, name] of officeNames.entries()) {
    await pool.query(
      'INSERT INTO offices (office_code, name, is_active) VALUES ($1, $2, 1) ON CONFLICT (office_code) DO NOTHING',
      [`OFF-${String(index + 1).padStart(3, '0')}`, name]
    );
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
  const [accounts] = await pool.query(
    'SELECT id, username, password_hash, position, is_active FROM users WHERE role = $1 ORDER BY id LIMIT 1',
    [role]
  );
  const account = accounts[0];
  if (account) {
    if (!account.is_active) {
      throw new Error(`The existing ${role} account is inactive. Enable it in the database before starting the API.`);
    }
    if (!account.position) {
      await pool.query('UPDATE users SET position = $1 WHERE id = $2', [position, account.id]);
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
    port: Number(process.env.DB_PORT) || 5000,
    user: process.env.DB_USER || 'postgres',
    password: (process.env.DB_PASSWORD ?? '')
  };
  const maintenancePool = new Pool({ ...connectionOptions, database: 'postgres', max: 1 });
  try {
    const existing = await maintenancePool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );
    if (existing.rowCount === 0) {
      await maintenancePool.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await maintenancePool.end();
  }

  const pool = createPool({
    ...connectionOptions,
    database: databaseName,
    max: 10,
    idleTimeoutMillis: 30000
  });

  try {
    await initializeSchema(pool);
    await pool.query(
      'ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL'
    );

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

module.exports = { initializeDatabase };

export {};
