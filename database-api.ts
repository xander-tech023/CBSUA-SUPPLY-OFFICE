const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const SESSION_COOKIE = 'cbsua_supply_session';
const SEQUENCES_TABLE = 'record_sequences';

class ApiError extends Error {
  status;

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function route(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function createErrorHandler() {
  return (error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error.code === '23505') {
      return response.status(409).json({ error: 'A record with that code or name already exists.' });
    }
    if (error.code === '23503' || error.code === '23502') {
      return response.status(400).json({ error: 'The submitted record references missing or incomplete data.' });
    }
    const status = Number(error.status) || 500;
    if (status >= 500) console.error('Database API request failed.', error);
    return response.status(status).json({
      error: status >= 500 ? 'The database operation failed. Check the API log for details.' : error.message
    });
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const key = part.slice(0, separator).trim();
    try {
      return [key, decodeURIComponent(part.slice(separator + 1).trim())];
    } catch {
      return [key, ''];
    }
  }).filter(([key]) => key));
}

function profileFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: [row.first_name, row.middle_name, row.surname].filter(Boolean).join(' '),
    title: row.position || '',
    role: row.role,
    employeeId: row.employee_id || '',
    office: row.office || '',
    officeId: row.office_code || '',
    email: row.email || ''
  };
}

async function findSession(pool, request) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.role, u.first_name, u.middle_name, u.surname, u.employee_id,
            u.position, u.email, o.name AS office, o.office_code
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN offices o ON o.id = u.office_id
      WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.is_active = 1
      LIMIT 1`,
    [tokenHash]
  );
  return profileFromRow(rows[0]);
}

function requireAuth(pool) {
  return route(async (request, response, next) => {
    request.user = await findSession(pool, request);
    if (!request.user) throw new ApiError(401, 'Your session has expired. Please sign in again.');
    return next();
  });
}

function requireRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user?.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

function issueCookie(response, request, token, maxAge, remember) {
  const secure = request.secure ? '; Secure' : '';
  const persistence = remember ? `; Max-Age=${maxAge}` : '';
  response.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${persistence}${secure}`);
}

function clearCookie(response, request) {
  const secure = request.secure ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function normaliseSupplyClassification(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+item$/, '');
  const classifications = {
    consumable: 'Consumable',
    'semi-expendable': 'Semi-expendable',
    'fixed asset': 'Fixed Asset'
  };
  return classifications[normalized] || '';
}

function toDocumentType(value) {
  const type = String(value || '').toUpperCase();
  if (['RIS', 'ICS', 'PAR'].includes(type)) return type;
  throw new ApiError(400, 'Choose a valid document type.');
}

function dateOnly(value, label = 'Date') {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new ApiError(400, `${label} must be a valid calendar date.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])) {
    throw new ApiError(400, `${label} must be a valid calendar date.`);
  }
  return text;
}

function optionalDate(value, label) {
  return value === null || value === undefined || value === '' ? null : dateOnly(value, label);
}

function numericValue(value, label, { minimum = 0, allowEmpty = false } = {}) {
  if ((value === null || value === undefined || value === '') && allowEmpty) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) {
    const requirement = minimum === 0
      ? 'zero or greater'
      : minimum < 1
        ? 'greater than zero'
        : `at least ${minimum}`;
    throw new ApiError(400, `${label} must be ${requirement}.`);
  }
  return number;
}

function requestedQuantity(value) {
  const quantity = Number.parseFloat(String(value || ''));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Enter a valid request quantity.');
  }
  return quantity;
}

function allocationInteger(value, label, { minimum = 0 } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new ApiError(400, `${label} is required.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new ApiError(400, `${label} must be a whole number of at least ${minimum}.`);
  }
  return number;
}

function quarterlyAllocation(annualLimit, quarter) {
  const base = Math.floor(annualLimit / 4);
  const remainder = annualLimit % 4;
  return base + (quarter <= remainder ? 1 : 0);
}

function makeReference(prefix, year, month, number) {
  return `${prefix}-${year}-${month}-${String(number).padStart(3, '0')}`;
}

function makeYearCode(prefix, year, number) {
  return `${prefix}-${year}-${String(number).padStart(3, '0')}`;
}

async function withTransaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('The database transaction could not be rolled back.', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function nextSequence(connection, key, minimum = 0) {
  await connection.execute(
    `INSERT INTO ${SEQUENCES_TABLE} (sequence_key, next_value) VALUES (?, 0)
     ON CONFLICT (sequence_key) DO NOTHING`,
    [key]
  );
  const [rows] = await connection.execute(
    `SELECT next_value FROM ${SEQUENCES_TABLE} WHERE sequence_key = ? FOR UPDATE`,
    [key]
  );
  const next = Math.max(Number(rows[0].next_value), minimum) + 1;
  await connection.execute(
    `UPDATE ${SEQUENCES_TABLE} SET next_value = ? WHERE sequence_key = ?`,
    [next, key]
  );
  return next;
}

async function nextCodeNumber(connection, key, table, column, prefix) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(split_part(${column}, '-', array_length(string_to_array(${column}, '-'), 1))::BIGINT), 0) AS maximum
       FROM ${table} WHERE ${column} LIKE ?`,
    [`${prefix}%`]
  );
  return nextSequence(connection, key, Number(rows[0].maximum));
}

async function insertCategory(connection, name) {
  const normalizedName = String(name || '').trim();
  if (normalizedName.length < 2 || normalizedName.length > 50) {
    throw new ApiError(400, 'Category names must contain 2-50 characters.');
  }
  const [existing] = await connection.execute(
    'SELECT id, category_code FROM item_categories WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
    [normalizedName]
  );
  if (existing[0]) return existing[0];
  const temporaryCode = `TMP-${crypto.randomBytes(8).toString('hex')}`;
  const [result] = await connection.execute(
    'INSERT INTO item_categories (category_code, name, is_active) VALUES (?, ?, 1)',
    [temporaryCode, normalizedName]
  );
  const categoryCode = `CAT-${String(result.insertId).padStart(3, '0')}`;
  await connection.execute('UPDATE item_categories SET category_code = ? WHERE id = ?', [
    categoryCode,
    result.insertId
  ]);
  return { id: result.insertId, category_code: categoryCode };
}

async function supplierIdByName(connection, name) {
  const supplierName = String(name || '').trim();
  if (!supplierName) throw new ApiError(400, 'Choose a valid active supplier.');
  const [rows] = await connection.execute(
    'SELECT id FROM suppliers WHERE name = ? AND is_active = 1 LIMIT 1',
    [supplierName]
  );
  if (!rows[0]) throw new ApiError(400, 'Choose a valid active supplier.');
  return rows[0].id;
}

async function officeByName(connection, name) {
  const officeName = String(name || '').trim();
  const [rows] = await connection.execute(
    'SELECT id, office_code, name FROM offices WHERE name = ? AND is_active = 1 LIMIT 1',
    [officeName]
  );
  if (!rows[0]) throw new ApiError(400, 'Choose a valid active office.');
  return rows[0];
}

async function getItemByCode(connection, code, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, item_code, name, unit, quantity_on_hand, minimum_quantity, expiry_date, supply_classification
       FROM inventory_items WHERE item_code = ? AND is_active = 1${lock ? ' FOR UPDATE' : ''}`,
    [String(code || '')]
  );
  if (!rows[0]) throw new ApiError(404, 'The inventory item could not be found.');
  return rows[0];
}

async function enforceOfficeItemQuota(connection, officeId, item, quantity, year, quarter, excludedRequestId = null) {
  const [quotaRows] = await connection.execute(
    `SELECT annual_limit FROM office_item_request_quotas
      WHERE office_id = ? AND item_id = ? AND allocation_year = ? FOR UPDATE`,
    [officeId, item.id, year]
  );
  if (!quotaRows[0]) {
    throw new ApiError(409, `No ${year} request allocation has been assigned to this office for ${item.name}.`);
  }

  const annualLimit = Number(quotaRows[0].annual_limit);
  const quarterLimit = quarterlyAllocation(annualLimit, quarter);
  const exclusion = excludedRequestId === null ? '' : ' AND id <> ?';
  const usageParameters = [quarter, officeId, item.id, year];
  if (excludedRequestId !== null) usageParameters.push(excludedRequestId);
  const [usageRows] = await connection.execute(
    `SELECT COALESCE(SUM(quantity), 0) AS annual_used,
            COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM created_at)::int = ? THEN quantity ELSE 0 END), 0) AS quarter_used
       FROM stock_requests
      WHERE office_id = ? AND item_id = ? AND EXTRACT(YEAR FROM created_at)::int = ?
        AND status NOT IN ('Rejected', 'Cancelled')${exclusion}`,
    usageParameters
  );
  const annualUsed = Number(usageRows[0].annual_used);
  const quarterUsed = Number(usageRows[0].quarter_used);
  if (annualUsed + quantity > annualLimit) {
    throw new ApiError(409,
      `The annual allocation for ${item.name} is ${annualLimit} ${item.unit}; ${Math.max(0, annualLimit - annualUsed)} remain.`);
  }
  if (quarterUsed + quantity > quarterLimit) {
    throw new ApiError(409,
      `The Q${quarter} allocation for ${item.name} is ${quarterLimit} ${item.unit}; ${Math.max(0, quarterLimit - quarterUsed)} remain.`);
  }
}

async function setOfficeItemQuota(connection, record, user) {
  if (user.role !== 'admin') {
    throw new ApiError(403, 'Only an administrator can assign office request allocations.');
  }
  const [calendarRows] = await connection.execute(
    'SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS allocation_year'
  );
  const year = allocationInteger(record.year, 'Allocation year', { minimum: 2000 });
  if (year !== Number(calendarRows[0].allocation_year)) {
    throw new ApiError(400, 'Allocations can only be changed for the current year.');
  }
  const annualBudget = allocationInteger(record.annualBudget, 'Campus annual budget');
  const officeAnnualLimit = allocationInteger(record.officeAnnualLimit, 'Office annual allocation');
  if (officeAnnualLimit > annualBudget) {
    throw new ApiError(400, 'An office allocation cannot exceed the campus annual budget.');
  }

  const item = await getItemByCode(connection, record.itemId, true);
  const [officeRows] = await connection.execute(
    'SELECT id, name FROM offices WHERE office_code = ? AND is_active = 1 FOR UPDATE',
    [String(record.officeId || '')]
  );
  if (!officeRows[0]) throw new ApiError(400, 'Choose a valid active office.');
  const office = officeRows[0];

  await connection.execute(
    `INSERT INTO item_annual_request_budgets (item_id, allocation_year, annual_limit, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (item_id, allocation_year)
     DO UPDATE SET annual_limit = EXCLUDED.annual_limit, updated_by = EXCLUDED.updated_by`,
    [item.id, year, annualBudget, user.id]
  );
  const [budgetRows] = await connection.execute(
    `SELECT annual_limit FROM item_annual_request_budgets
      WHERE item_id = ? AND allocation_year = ? FOR UPDATE`,
    [item.id, year]
  );
  const [otherAllocationRows] = await connection.execute(
    `SELECT COALESCE(SUM(annual_limit), 0) AS allocated
       FROM office_item_request_quotas
      WHERE item_id = ? AND allocation_year = ? AND office_id <> ?`,
    [item.id, year, office.id]
  );
  const totalAllocated = Number(otherAllocationRows[0].allocated) + officeAnnualLimit;
  if (totalAllocated > Number(budgetRows[0].annual_limit)) {
    throw new ApiError(409,
      `This would allocate ${totalAllocated} ${item.unit}, exceeding the campus budget of ${Number(budgetRows[0].annual_limit)}.`);
  }

  await connection.execute(
    `SELECT annual_limit FROM office_item_request_quotas
      WHERE office_id = ? AND item_id = ? AND allocation_year = ? FOR UPDATE`,
    [office.id, item.id, year]
  );
  await connection.execute(
    `INSERT INTO office_item_request_quotas
      (office_id, item_id, allocation_year, annual_limit, updated_by)
     VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (office_id, item_id, allocation_year)
      DO UPDATE SET annual_limit = EXCLUDED.annual_limit, updated_by = EXCLUDED.updated_by`,
    [office.id, item.id, year, officeAnnualLimit, user.id]
  );
  const [usageRows] = await connection.execute(
    `SELECT COALESCE(SUM(quantity), 0) AS annual_used,
            COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM created_at)::int = 1 THEN quantity ELSE 0 END), 0) AS q1_used,
            COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM created_at)::int = 2 THEN quantity ELSE 0 END), 0) AS q2_used,
            COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM created_at)::int = 3 THEN quantity ELSE 0 END), 0) AS q3_used,
            COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM created_at)::int = 4 THEN quantity ELSE 0 END), 0) AS q4_used
       FROM stock_requests
      WHERE office_id = ? AND item_id = ? AND EXTRACT(YEAR FROM created_at)::int = ?
        AND status NOT IN ('Rejected', 'Cancelled')`,
    [office.id, item.id, year]
  );
  const usage = usageRows[0];
  if (Number(usage.annual_used) > officeAnnualLimit
    || [1, 2, 3, 4].some(quarter =>
      Number(usage[`q${quarter}_used`]) > quarterlyAllocation(officeAnnualLimit, quarter))) {
    throw new ApiError(409, 'The new allocation cannot be lower than requests already recorded for this office and item.');
  }
  return `${office.office_code}:${item.item_code}:${year}`;
}

async function saveCategory(connection, record) {
  const category = await insertCategory(connection, record.name);
  return category.category_code;
}

async function saveItem(connection, record, user) {
  const name = String(record.name || '').trim();
  const unit = String(record.unit || '').trim();
  if (!name || name.length > 200 || !unit || unit.length > 40) {
    throw new ApiError(400, 'Enter a valid item name and unit.');
  }
  const quantity = numericValue(record.quantity, 'Opening quantity');
  const minimum = numericValue(record.minimum, 'Minimum quantity');
  const category = await insertCategory(connection, record.category);
  const supplier = await supplierIdByName(connection, record.supplier);
  const classification = normaliseSupplyClassification(record.supplyClassification);
  if (!classification) throw new ApiError(400, 'Choose a valid supply classification.');
  const itemCode = `ITM-${String(await nextCodeNumber(
    connection, 'ITM', 'inventory_items', 'item_code', 'ITM-'
  )).padStart(3, '0')}`;

  const [result] = await connection.execute(
    `INSERT INTO inventory_items
      (item_code, name, description, category_id, supplier_id, supply_classification, unit,
       quantity_on_hand, minimum_quantity, expiry_date, property_number, specifications,
       estimated_useful_life_years, unit_cost, date_acquired, created_by, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      itemCode, name, String(record.description || '').trim() || null, category?.id || null, supplier,
      classification, unit, quantity, minimum, optionalDate(record.expiry, 'Expiry date'),
      record.propertyNumber || null,
      record.specifications || null, numericValue(record.estimatedUsefulLifeYears, 'Useful life', { allowEmpty: true }),
      numericValue(record.unitCost, 'Unit cost', { allowEmpty: true }),
      optionalDate(record.dateAcquired, 'Acquisition date'), user.id
    ]
  );
  if (quantity > 0) {
    await connection.execute(
      `INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_after, performed_by, notes)
       VALUES (?, 'Opening', ?, ?, ?, ?)`,
      [result.insertId, quantity, quantity, user.id, 'Opening inventory balance']
    );
  }
  return itemCode;
}

async function saveSupplier(connection, record) {
  const name = String(record.name || '').trim();
  if (!name || name.length > 150) {
    throw new ApiError(400, 'Enter a valid supplier name.');
  }
  if (String(record.category || '').length > 150 || String(record.contact || '').length > 150
    || String(record.phone || '').length > 50 || String(record.email || '').length > 254) {
    throw new ApiError(400, 'Supplier contact details exceed the allowed length.');
  }
  const supplierCode = `SUP-${String(await nextCodeNumber(
    connection, 'SUP', 'suppliers', 'supplier_code', 'SUP-'
  )).padStart(3, '0')}`;
  await connection.execute(
    `INSERT INTO suppliers (supplier_code, name, category, contact_person, phone, email, address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [supplierCode, name, record.category || null, record.contact || null, record.phone || null,
      record.email || null, record.address || null]
  );
  return supplierCode;
}

async function saveRequest(connection, record, user) {
  const item = await getItemByCode(connection, record.itemId, true);
  const quantity = requestedQuantity(record.quantity);
  if (!Number.isSafeInteger(quantity)) {
    throw new ApiError(400, 'Enter a whole-number request quantity.');
  }
  if (user.role === 'end-user' && quantity > Number(item.quantity_on_hand)) {
    throw new ApiError(409, `Only ${Number(item.quantity_on_hand)} ${item.unit} are currently available.`);
  }
  const supply = normaliseSupplyClassification(record.supplyClassification);
  const documentType = toDocumentType(record.documentType);
  if (!supply || (documentType === 'RIS' && supply !== 'Consumable')
    || (documentType === 'ICS' && supply !== 'Semi-expendable')
    || (documentType === 'PAR' && supply !== 'Fixed Asset')) {
    throw new ApiError(400, 'The supply classification and document type do not match.');
  }
  if (normaliseSupplyClassification(item.supply_classification) !== supply) {
    throw new ApiError(400, 'The selected inventory item does not match the supply classification.');
  }
  const office = await officeByName(connection, user.role === 'end-user' ? user.office : record.office);
  const recipient = user.role === 'end-user' ? user.name : String(record.recipient || '').trim();
  const employeeId = user.role === 'end-user' ? user.employeeId : String(record.employeeId || '').trim().toUpperCase();
  if (!recipient || recipient.length > 150 || !/^[A-Z0-9-]{3,24}$/.test(employeeId)) {
    throw new ApiError(400, 'Enter a valid recipient name and employee ID.');
  }

  const requestDate = dateOnly(record.date, 'Request date');
  const [quotaPeriodRows] = await connection.execute(
    'SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS allocation_year, EXTRACT(QUARTER FROM CURRENT_DATE)::int AS allocation_quarter'
  );
  await enforceOfficeItemQuota(
    connection, office.id, item, quantity,
    Number(quotaPeriodRows[0].allocation_year), Number(quotaPeriodRows[0].allocation_quarter)
  );
  const date = new Date(`${requestDate}T00:00:00Z`);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  const requestNumber = await nextCodeNumber(
    connection, `REQ-${year}-${month}`, 'stock_requests', 'request_code', `REQ-${year}-${month}-`
  );
  const requestCode = makeReference('REQ', year, month, requestNumber);
  const classificationDetails = record.classificationDetails || {};
  const fundCluster = makeReference('FC', year, month, await nextCodeNumber(
    connection, `FC-${year}`, 'stock_requests', 'fund_cluster', `FC-${year}-`
  ));
  const purchaseOrderNumber = makeReference('PO', year, month, await nextCodeNumber(
    connection, `PO-${year}`, 'stock_requests', 'purchase_order_number', `PO-${year}-`
  ));
  const iarNumber = makeReference('IAR', year, month, await nextCodeNumber(
    connection, `IAR-${year}`, 'stock_requests', 'iar_number', `IAR-${year}-`
  ));
  const [result] = await connection.execute(
    `INSERT INTO stock_requests
      (request_code, request_date, office_id, requester_id, recipient_name, recipient_employee_id,
       item_id, quantity, supply_classification, document_type, fund_cluster, specifications,
       estimated_useful_life_years, unit_cost, supplier_name, delivery_receipt_date,
       purchase_order_number, purchase_order_date, iar_number, iar_date, property_number,
       date_acquired, amount, status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    [
      requestCode, requestDate, office.id, user.id, recipient, employeeId, item.id, quantity, supply,
      documentType, fundCluster, classificationDetails.specifications || null,
      numericValue(classificationDetails.estimatedUsefulLifeYears, 'Useful life', { minimum: 1, allowEmpty: true }),
      numericValue(classificationDetails.unitCost, 'Unit cost', { allowEmpty: true }),
      classificationDetails.supplier || null,
      optionalDate(classificationDetails.deliveryReceiptDate, 'Delivery receipt date'),
      purchaseOrderNumber, optionalDate(classificationDetails.purchaseOrderDate, 'Purchase order date'), iarNumber,
      optionalDate(classificationDetails.iarDate, 'IAR date'), classificationDetails.propertyNumber || null,
      optionalDate(classificationDetails.dateAcquired, 'Acquisition date'),
      numericValue(classificationDetails.amount, 'Amount', { allowEmpty: true }),
      String(record.remarks || '').trim() || null
    ]
  );
  await connection.execute(
    `INSERT INTO request_status_history (request_id, old_status, new_status, changed_by)
     VALUES (?, NULL, 'Pending', ?)`,
    [result.insertId, user.id]
  );
  return requestCode;
}

async function updatePendingRequest(connection, requestCode, record, user) {
  if (user.role !== 'end-user') {
    throw new ApiError(403, 'Only end-users can edit their own pending requests.');
  }
  const [requestRows] = await connection.execute(
    `SELECT id, request_date, office_id, requester_id, status,
            EXTRACT(YEAR FROM created_at)::int AS allocation_year, EXTRACT(QUARTER FROM created_at)::int AS allocation_quarter
       FROM stock_requests WHERE request_code = ? FOR UPDATE`,
    [String(requestCode || '')]
  );
  const request = requestRows[0];
  if (!request) throw new ApiError(404, 'The stock request could not be found.');
  const office = await officeByName(connection, user.office);
  if (String(request.requester_id) !== String(user.id)
    || String(request.office_id) !== String(office.id)) {
    throw new ApiError(403, 'You can only edit requests submitted by your account for your office.');
  }
  if (request.status !== 'Pending') {
    throw new ApiError(409, 'Only pending requests can be edited.');
  }

  const item = await getItemByCode(connection, record.itemId, true);
  const quantity = requestedQuantity(record.quantity);
  if (!Number.isSafeInteger(quantity)) {
    throw new ApiError(400, 'Enter a whole-number request quantity.');
  }
  if (quantity > Number(item.quantity_on_hand)) {
    throw new ApiError(409, `Only ${Number(item.quantity_on_hand)} ${item.unit} are currently available.`);
  }
  const supply = normaliseSupplyClassification(record.supplyClassification);
  const documentType = toDocumentType(record.documentType);
  if (!supply || (documentType === 'RIS' && supply !== 'Consumable')
    || (documentType === 'ICS' && supply !== 'Semi-expendable')
    || (documentType === 'PAR' && supply !== 'Fixed Asset')) {
    throw new ApiError(400, 'The supply classification and document type do not match.');
  }
  if (normaliseSupplyClassification(item.supply_classification) !== supply) {
    throw new ApiError(400, 'The selected inventory item does not match the supply classification.');
  }

  dateOnly(request.request_date, 'Request date');
  await enforceOfficeItemQuota(
    connection, office.id, item, quantity,
    Number(request.allocation_year), Number(request.allocation_quarter), request.id
  );

  const details = record.classificationDetails && typeof record.classificationDetails === 'object'
    && !Array.isArray(record.classificationDetails)
    ? record.classificationDetails
    : {};
  const specifications = String(details.specifications || '').trim();
  if (documentType !== 'RIS' && !specifications) {
    throw new ApiError(400, 'Enter the specifications required for this request.');
  }
  const recipient = String(user.name || '').trim();
  const employeeId = String(user.employeeId || '').trim().toUpperCase();
  if (!recipient || recipient.length > 150 || !/^[A-Z0-9-]{3,24}$/.test(employeeId)) {
    throw new ApiError(400, 'Your account must have a valid name and employee ID to edit this request.');
  }
  const supplier = String(details.supplier || '').trim();
  const propertyNumber = String(details.propertyNumber || '').trim();
  const remarks = String(record.remarks || '').trim();
  if (supplier.length > 150 || propertyNumber.length > 80 || remarks.length > 2000) {
    throw new ApiError(400, 'Request details exceed the allowed length.');
  }

  await connection.execute(
    `UPDATE stock_requests
        SET item_id = ?, quantity = ?, supply_classification = ?, document_type = ?,
            recipient_name = ?, recipient_employee_id = ?, specifications = ?,
            estimated_useful_life_years = ?, unit_cost = ?, supplier_name = ?,
            delivery_receipt_date = ?, purchase_order_date = ?, iar_date = ?,
            property_number = ?, date_acquired = ?, amount = ?, remarks = ?
      WHERE id = ?`,
    [
      item.id, quantity, supply, documentType, recipient, employeeId, specifications || null,
      numericValue(details.estimatedUsefulLifeYears, 'Useful life', { minimum: 1, allowEmpty: true }),
      numericValue(details.unitCost, 'Unit cost', { allowEmpty: true }),
      supplier || null,
      optionalDate(details.deliveryReceiptDate, 'Delivery receipt date'),
      optionalDate(details.purchaseOrderDate, 'Purchase order date'),
      optionalDate(details.iarDate, 'IAR date'),
      propertyNumber || null,
      optionalDate(details.dateAcquired, 'Acquisition date'),
      numericValue(details.amount, 'Amount', { allowEmpty: true }),
      remarks || null,
      request.id
    ]
  );
  return String(requestCode);
}

async function saveReceipt(connection, record, user) {
  const item = await getItemByCode(connection, record.itemId, true);
  const quantity = numericValue(record.quantity, 'Receipt quantity', { minimum: Number.MIN_VALUE });
  const supplierId = await supplierIdByName(connection, record.supplier);
  const deliveryReference = String(record.deliveryReference || '').trim();
  if (!deliveryReference || deliveryReference.length > 100) {
    throw new ApiError(400, 'Enter a delivery reference of no more than 100 characters.');
  }
  const receivedDate = dateOnly(record.receivedDate, 'Receipt date');
  const expiryDate = optionalDate(record.expiryDate, 'Expiry date');
  const year = receivedDate.slice(0, 4);
  const receiptCode = makeYearCode('RCV', year, await nextCodeNumber(
    connection, `RCV-${year}`, 'stock_receipts', 'receipt_code', `RCV-${year}-`
  ));
  const [inserted] = await connection.execute(
    `INSERT INTO stock_receipts
      (receipt_code, item_id, supplier_id, quantity, received_date, received_by, delivery_reference,
       batch_number, expiry_date, remarks, attachment_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receiptCode, item.id, supplierId, quantity, receivedDate, user.id,
      deliveryReference, record.batchNumber || null,
      expiryDate, record.remarks || null, record.attachmentName || null
    ]
  );
  const newQuantity = Number(item.quantity_on_hand) + quantity;
  await connection.execute(
    'UPDATE inventory_items SET quantity_on_hand = ?, expiry_date = COALESCE(?, expiry_date) WHERE id = ?',
    [newQuantity, expiryDate, item.id]
  );
  await connection.execute(
    `INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_after, receipt_id, performed_by, notes)
     VALUES (?, 'Receipt', ?, ?, ?, ?, ?)`,
    [item.id, quantity, newQuantity, inserted.insertId, user.id, record.remarks || null]
  );
  return receiptCode;
}

async function saveIssuance(connection, record, user) {
  const [requests] = await connection.execute(
    `SELECT r.id, r.request_code, r.item_id, r.quantity, r.status, r.office_id,
            r.recipient_name, r.recipient_employee_id
       FROM stock_requests r WHERE r.request_code = ? FOR UPDATE`,
    [String(record.requestId || '')]
  );
  const request = requests[0];
  if (!request || request.status !== 'Approved') throw new ApiError(409, 'Choose an approved request.');
  const [items] = await connection.execute(
    'SELECT id, item_code, name, unit, quantity_on_hand FROM inventory_items WHERE id = ? AND is_active = 1 FOR UPDATE',
    [request.item_id]
  );
  const item = items[0];
  if (!item) throw new ApiError(404, 'The inventory item could not be found.');
  const quantity = numericValue(record.quantity, 'Issue quantity', { minimum: Number.MIN_VALUE });
  const [issuedRows] = await connection.execute(
    'SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_issuances WHERE request_id = ?',
    [request.id]
  );
  const remaining = Number(request.quantity) - Number(issuedRows[0].total);
  if (quantity > remaining || quantity > Number(item.quantity_on_hand)) {
    throw new ApiError(409, 'The issue quantity exceeds the remaining request or available stock.');
  }

  const issueDate = dateOnly(record.date, 'Issue date');
  const year = issueDate.slice(0, 4);
  const issuanceCode = makeYearCode('ISS', year, await nextCodeNumber(
    connection, `ISS-${year}`, 'stock_issuances', 'issuance_code', `ISS-${year}-`
  ));
  const [inserted] = await connection.execute(
    `INSERT INTO stock_issuances
      (issuance_code, request_id, item_id, quantity, issued_date, office_id,
       recipient_name, recipient_employee_id, handled_by, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      issuanceCode, request.id, item.id, quantity, issueDate, request.office_id,
      request.recipient_name, request.recipient_employee_id, user.id, record.remarks || null
    ]
  );
  const newQuantity = Number(item.quantity_on_hand) - quantity;
  await connection.execute('UPDATE inventory_items SET quantity_on_hand = ? WHERE id = ?', [newQuantity, item.id]);
  await connection.execute(
    `INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_after, issuance_id, performed_by, notes)
     VALUES (?, 'Issuance', ?, ?, ?, ?, ?)`,
    [item.id, -quantity, newQuantity, inserted.insertId, user.id, record.remarks || null]
  );
  if (quantity >= remaining) {
    await connection.execute("UPDATE stock_requests SET status = 'Issued' WHERE id = ?", [request.id]);
    await connection.execute(
      `INSERT INTO request_status_history (request_id, old_status, new_status, changed_by)
       VALUES (?, 'Approved', 'Issued', ?)`,
      [request.id, user.id]
    );
  }
  return issuanceCode;
}

async function updateItem(connection, itemCode, changes, user) {
  const item = await getItemByCode(connection, itemCode, true);
  const name = String(changes.name || '').trim();
  const unit = String(changes.unit || '').trim();
  if (!name || name.length > 200 || !unit || unit.length > 40) {
    throw new ApiError(400, 'Enter a valid item name and unit.');
  }
  const category = await insertCategory(connection, changes.category);
  const supplier = await supplierIdByName(connection, changes.supplier);
  const quantity = numericValue(changes.quantity, 'Quantity');
  const minimum = numericValue(changes.minimum, 'Minimum quantity');
  const supplyClassification = normaliseSupplyClassification(changes.supplyClassification);
  if (!supplyClassification) throw new ApiError(400, 'Choose a valid supply classification.');
  const delta = quantity - Number(item.quantity_on_hand);
  await connection.execute(
    `UPDATE inventory_items SET name = ?, description = ?, category_id = ?, supplier_id = ?,
       supply_classification = ?, unit = ?, quantity_on_hand = ?, minimum_quantity = ?,
       expiry_date = ?, property_number = ?, specifications = ?, estimated_useful_life_years = ?,
       unit_cost = ?, date_acquired = ? WHERE id = ?`,
    [
      name, String(changes.description || '').trim() || null,
      category?.id || null, supplier, supplyClassification, String(changes.unit || '').trim(),
      quantity, minimum, optionalDate(changes.expiry, 'Expiry date'), changes.propertyNumber || null,
      changes.specifications || null,
      numericValue(changes.estimatedUsefulLifeYears, 'Useful life', { minimum: 1, allowEmpty: true }),
      numericValue(changes.unitCost, 'Unit cost', { allowEmpty: true }),
      optionalDate(changes.dateAcquired, 'Acquisition date'), item.id
    ]
  );
  if (delta !== 0) {
    await connection.execute(
      `INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_after, performed_by, notes)
       VALUES (?, 'Adjustment', ?, ?, ?, ?)`,
      [item.id, delta, quantity, user.id, 'Inventory quantity adjusted during item edit']
    );
  }
}

async function updateSupplier(connection, supplierCode, changes) {
  const name = String(changes.name || '').trim();
  if (!name || name.length > 150 || String(changes.category || '').length > 150
    || String(changes.contact || '').length > 150 || String(changes.phone || '').length > 50
    || String(changes.email || '').length > 254) {
    throw new ApiError(400, 'Enter valid supplier details within the allowed lengths.');
  }
  const [result] = await connection.execute(
    `UPDATE suppliers SET name = ?, category = ?, contact_person = ?, phone = ?, email = ?, address = ?
      WHERE supplier_code = ? AND is_active = 1`,
    [
      name, changes.category || null, changes.contact || null,
      changes.phone || null, changes.email || null, changes.address || null, supplierCode
    ]
  );
  if (!result.affectedRows) throw new ApiError(404, 'The supplier could not be found.');
}

async function setRequestStatus(connection, requestId, status, user) {
  if (user.role !== 'admin') throw new ApiError(403, 'Only the Supply Office head can review requests.');
  if (!['Approved', 'Rejected'].includes(status)) throw new ApiError(400, 'Choose a valid request status.');
  const [requests] = await connection.execute(
    'SELECT id, status, item_id, quantity FROM stock_requests WHERE request_code = ? FOR UPDATE',
    [requestId]
  );
  const request = requests[0];
  if (!request || request.status !== 'Pending') throw new ApiError(409, 'This request is no longer awaiting review.');
  if (status === 'Approved') {
    const [items] = await connection.execute(
      'SELECT quantity_on_hand FROM inventory_items WHERE id = ? FOR UPDATE',
      [request.item_id]
    );
    const [reservedRows] = await connection.execute(
      `SELECT COALESCE(SUM(r.quantity - COALESCE(i.issued, 0)), 0) AS reserved
         FROM stock_requests r
         LEFT JOIN (SELECT request_id, SUM(quantity) AS issued FROM stock_issuances GROUP BY request_id) i
           ON i.request_id = r.id
        WHERE r.item_id = ? AND r.status = 'Approved'`,
      [request.item_id]
    );
    const available = Number(items[0]?.quantity_on_hand || 0) - Number(reservedRows[0].reserved || 0);
    if (Number(request.quantity) > available) {
      throw new ApiError(409, 'There is not enough unreserved stock to approve this request.');
    }
  }
  await connection.execute(
    'UPDATE stock_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [status, user.id, request.id]
  );
  await connection.execute(
    'INSERT INTO request_status_history (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
    [request.id, request.status, status, user.id]
  );
}

async function cancelRequest(connection, requestId, user) {
  if (user.role !== 'end-user') throw new ApiError(403, 'Only the requesting office can cancel this request.');
  const [rows] = await connection.execute(
    `SELECT r.id, r.status, r.requester_id, r.office_id
       FROM stock_requests r WHERE r.request_code = ? FOR UPDATE`,
    [requestId]
  );
  const request = rows[0];
  if (!request) throw new ApiError(404, 'The stock request could not be found.');
  if (String(request.requester_id) !== String(user.id)) {
    throw new ApiError(403, 'You can only cancel requests submitted by your account.');
  }
  if (request.status !== 'Pending') throw new ApiError(409, 'Only pending requests can be cancelled.');
  await connection.execute(
    "UPDATE stock_requests SET status = 'Cancelled', cancelled_by = ?, cancelled_at = NOW() WHERE id = ?",
    [user.id, request.id]
  );
  await connection.execute(
    `INSERT INTO request_status_history (request_id, old_status, new_status, changed_by)
     VALUES (?, 'Pending', 'Cancelled', ?)`,
    [request.id, user.id]
  );
}

function inventoryStatus(item) {
  const quantity = Number(item.quantity_on_hand);
  const minimum = Number(item.minimum_quantity);
  const expiry = item.expiry_date ? new Date(`${item.expiry_date}T00:00:00`) : null;
  const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : Infinity;
  if (quantity <= 0) return 'Out of stock';
  if (daysUntilExpiry <= 45) return 'Expiring soon';
  return quantity <= minimum ? 'Low stock' : 'In stock';
}

async function readRecords(pool, user) {
  const [items, requests, suppliers, receipts, issuances, categories, quotas, annualBudgets] = await Promise.all([
    pool.execute(
      `SELECT i.*, c.name AS category, s.name AS supplier
         FROM inventory_items i
         LEFT JOIN item_categories c ON c.id = i.category_id
         LEFT JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.is_active = 1 ORDER BY i.id`
    ),
    pool.execute(
      `SELECT r.request_code, r.request_date, r.office_id, r.requester_id, r.recipient_name,
              r.recipient_employee_id, r.quantity, r.supply_classification, r.document_type,
              r.fund_cluster, r.specifications, r.estimated_useful_life_years, r.unit_cost,
              r.supplier_name, r.delivery_receipt_date, r.purchase_order_number, r.purchase_order_date,
              r.iar_number, r.iar_date, r.property_number, r.date_acquired, r.amount, r.status,
              r.reviewed_at, r.cancelled_at, r.remarks, r.created_at, o.name AS office,
              i.item_code, i.name AS item_name, i.unit, reviewer.first_name AS reviewer_first,
              reviewer.middle_name AS reviewer_middle, reviewer.surname AS reviewer_surname
         FROM stock_requests r
         LEFT JOIN offices o ON o.id = r.office_id
         JOIN inventory_items i ON i.id = r.item_id
         LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
        WHERE (? <> 'end-user' OR r.requester_id = ?)
        ORDER BY r.created_at DESC`,
      [user.role, user.id]
    ),
    pool.execute(
      `SELECT s.supplier_code, s.name, s.category, s.contact_person, s.phone, s.email, s.address,
              (SELECT COUNT(*) FROM inventory_items i WHERE i.supplier_id = s.id AND i.is_active = 1) AS item_count,
              (SELECT COUNT(*) FROM stock_receipts r WHERE r.supplier_id = s.id) AS delivery_count
         FROM suppliers s WHERE s.is_active = 1 ORDER BY s.id`
    ),
    pool.execute(
      `SELECT r.receipt_code, r.quantity, r.received_date, r.delivery_reference, r.batch_number,
              r.expiry_date, r.remarks, r.attachment_name, r.created_at, i.item_code, i.name AS item_name,
              i.unit, s.name AS supplier, receiver.first_name, receiver.middle_name, receiver.surname
         FROM stock_receipts r JOIN inventory_items i ON i.id = r.item_id
         LEFT JOIN suppliers s ON s.id = r.supplier_id
         LEFT JOIN users receiver ON receiver.id = r.received_by
        ORDER BY r.created_at DESC`
    ),
    pool.execute(
      `SELECT x.issuance_code, x.request_id, x.quantity, x.issued_date, x.recipient_name,
              x.recipient_employee_id, x.remarks, x.created_at, r.request_code,
              i.item_code, i.name AS item_name, i.unit, o.name AS office,
              handler.first_name, handler.middle_name, handler.surname, handler.position
         FROM stock_issuances x JOIN stock_requests r ON r.id = x.request_id
         JOIN inventory_items i ON i.id = x.item_id
         LEFT JOIN offices o ON o.id = x.office_id
         LEFT JOIN users handler ON handler.id = x.handled_by
        ORDER BY x.created_at DESC`
    ),
    pool.execute(
      'SELECT category_code, name FROM item_categories WHERE is_active = 1 ORDER BY id'
    ),
    pool.execute(
      `SELECT q.office_id, q.item_id, q.allocation_year, q.annual_limit,
              o.office_code, o.name AS office, i.item_code, i.name AS item_name, i.unit,
              b.annual_limit AS campus_annual_budget,
              COALESCE(SUM(r.quantity), 0) AS annual_used,
              COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM r.created_at)::int = 1 THEN r.quantity ELSE 0 END), 0) AS q1_used,
              COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM r.created_at)::int = 2 THEN r.quantity ELSE 0 END), 0) AS q2_used,
              COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM r.created_at)::int = 3 THEN r.quantity ELSE 0 END), 0) AS q3_used,
              COALESCE(SUM(CASE WHEN EXTRACT(QUARTER FROM r.created_at)::int = 4 THEN r.quantity ELSE 0 END), 0) AS q4_used,
              EXTRACT(QUARTER FROM CURRENT_DATE)::int AS current_quarter
         FROM office_item_request_quotas q
         JOIN offices o ON o.id = q.office_id
         JOIN inventory_items i ON i.id = q.item_id
         JOIN item_annual_request_budgets b
           ON b.item_id = q.item_id AND b.allocation_year = q.allocation_year
         LEFT JOIN stock_requests r
           ON r.office_id = q.office_id AND r.item_id = q.item_id
          AND EXTRACT(YEAR FROM r.created_at)::int = q.allocation_year
          AND r.status NOT IN ('Rejected', 'Cancelled')
        WHERE ((? <> 'end-user' AND q.allocation_year = EXTRACT(YEAR FROM CURRENT_DATE)::int)
          OR (? = 'end-user' AND o.name = ?))
        GROUP BY q.office_id, q.item_id, q.allocation_year, q.annual_limit,
                 o.office_code, o.name, i.item_code, i.name, i.unit, b.annual_limit
        ORDER BY o.name, i.name`,
      [user.role, user.role, user.office || '']
    ),
    pool.execute(
      `SELECT b.item_id, b.allocation_year, b.annual_limit,
              i.item_code, i.name AS item_name, i.unit,
              COALESCE(SUM(q.annual_limit), 0) AS allocated
         FROM item_annual_request_budgets b
         JOIN inventory_items i ON i.id = b.item_id
         LEFT JOIN office_item_request_quotas q
           ON q.item_id = b.item_id AND q.allocation_year = b.allocation_year
        WHERE b.allocation_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
        GROUP BY b.item_id, b.allocation_year, b.annual_limit, i.item_code, i.name, i.unit
        ORDER BY i.name`
    )
  ]);
  const mappedItems = items[0].map(item => ({
    id: item.item_code,
    name: item.name,
    description: item.description || '',
    category: item.category || '',
    quantity: Number(item.quantity_on_hand),
    unit: item.unit,
    supplier: item.supplier || '',
    minimum: Number(item.minimum_quantity),
    expiry: item.expiry_date || null,
    status: inventoryStatus(item),
    supplyClassification: item.supply_classification || '',
    propertyNumber: item.property_number || '',
    specifications: item.specifications || '',
    estimatedUsefulLifeYears: item.estimated_useful_life_years === null ? null : Number(item.estimated_useful_life_years),
    unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
    dateAcquired: item.date_acquired || ''
  }));
  const mappedRequests = requests[0].map(request => {
    const classificationDetails = {};
    for (const [field, value] of Object.entries({
      fundCluster: request.fund_cluster,
      purchaseOrderNumber: request.purchase_order_number,
      iarNumber: request.iar_number,
      specifications: request.specifications,
      estimatedUsefulLifeYears: request.estimated_useful_life_years,
      unitCost: request.unit_cost,
      supplier: request.supplier_name,
      deliveryReceiptDate: request.delivery_receipt_date,
      purchaseOrderDate: request.purchase_order_date,
      iarDate: request.iar_date,
      propertyNumber: request.property_number,
      dateAcquired: request.date_acquired,
      amount: request.amount
    })) {
      if (value !== null && value !== undefined && value !== '') {
        classificationDetails[field] = typeof value === 'number' ? value : value;
      }
    }
    return {
      id: request.request_code,
      date: request.request_date,
      createdAt: request.created_at,
      office: request.office || '',
      recipient: request.recipient_name,
      employeeId: request.recipient_employee_id || '',
      requesterId: request.requester_id,
      item: `${request.item_name} (${request.item_code})`,
      itemId: request.item_code,
      quantity: `${Number(request.quantity)} ${request.unit}`,
      supplyClassification: request.supply_classification,
      documentType: request.document_type,
      classificationDetails,
      status: request.status,
      reviewedBy: [request.reviewer_first, request.reviewer_middle, request.reviewer_surname].filter(Boolean).join(' '),
      reviewedAt: request.reviewed_at,
      cancelledAt: request.cancelled_at,
      remarks: request.remarks || ''
    };
  });
  const mappedSuppliers = suppliers[0].map(supplier => ({
    id: supplier.supplier_code,
    name: supplier.name,
    category: supplier.category || '',
    contact: supplier.contact_person || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    items: Number(supplier.item_count),
    deliveries: Number(supplier.delivery_count)
  }));
  const mappedReceipts = receipts[0].map(receipt => ({
    id: receipt.receipt_code,
    itemId: receipt.item_code,
    itemName: receipt.item_name,
    quantity: Number(receipt.quantity),
    unit: receipt.unit,
    supplier: receipt.supplier || '',
    receivedBy: [receipt.first_name, receipt.middle_name, receipt.surname].filter(Boolean).join(' '),
    receivedDate: receipt.received_date,
    deliveryReference: receipt.delivery_reference,
    batchNumber: receipt.batch_number || '',
    expiryDate: receipt.expiry_date || null,
    remarks: receipt.remarks || '',
    attachmentName: receipt.attachment_name || '',
    createdAt: receipt.created_at
  }));
  const mappedIssuances = issuances[0].map(issuance => ({
    id: issuance.issuance_code,
    requestId: issuance.request_code,
    itemId: issuance.item_code,
    itemName: issuance.item_name,
    quantity: Number(issuance.quantity),
    unit: issuance.unit,
    office: issuance.office || '',
    recipient: issuance.recipient_name,
    recipientEmployeeId: issuance.recipient_employee_id || '',
    handledBy: [issuance.first_name, issuance.middle_name, issuance.surname, issuance.position]
      .filter(Boolean).join(' — '),
    date: issuance.issued_date,
    remarks: issuance.remarks || '',
    createdAt: issuance.created_at
  }));
  const mappedQuotas = quotas[0].map(quota => {
    const annualLimit = Number(quota.annual_limit);
    const quarterUsage = [quota.q1_used, quota.q2_used, quota.q3_used, quota.q4_used]
      .map(value => Number(value));
    const currentQuarter = Number(quota.current_quarter);
    return {
      id: `${quota.office_code}:${quota.item_code}:${quota.allocation_year}`,
      officeId: quota.office_code,
      office: quota.office,
      itemId: quota.item_code,
      itemName: quota.item_name,
      unit: quota.unit,
      year: Number(quota.allocation_year),
      annualLimit,
      annualUsed: Number(quota.annual_used),
      quarterLimits: [1, 2, 3, 4].map(quarter => quarterlyAllocation(annualLimit, quarter)),
      quarterUsage,
      currentQuarter,
      currentQuarterLimit: quarterlyAllocation(annualLimit, currentQuarter),
      currentQuarterUsed: quarterUsage[currentQuarter - 1],
      campusAnnualBudget: Number(quota.campus_annual_budget)
    };
  });
  const mappedAnnualBudgets = annualBudgets[0].map(budget => ({
    id: `${budget.item_code}:${budget.allocation_year}`,
    itemId: budget.item_code,
    itemName: budget.item_name,
    unit: budget.unit,
    year: Number(budget.allocation_year),
    annualBudget: Number(budget.annual_limit),
    allocated: Number(budget.allocated)
  }));
  return {
    items: mappedItems,
    requests: mappedRequests,
    suppliers: user.role === 'end-user' ? [] : mappedSuppliers,
    receipts: user.role === 'end-user' ? [] : mappedReceipts,
    issuances: user.role === 'end-user' ? [] : mappedIssuances,
    categories: user.role === 'end-user'
      ? []
      : categories[0].map(category => ({ id: category.category_code, name: category.name })),
    officeQuotas: mappedQuotas,
    itemAnnualBudgets: user.role === 'end-user' ? [] : mappedAnnualBudgets
  };
}

async function updateProfileEmployeeId(pool, user, employeeId) {
  if (user.role !== 'end-user') throw new ApiError(403, 'Only end-user accounts can update their employee ID here.');
  const normalized = String(employeeId || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(normalized)) {
    throw new ApiError(400, 'Enter an employee ID using 3-24 letters, numbers, or hyphens.');
  }
  try {
    await pool.execute('UPDATE users SET employee_id = ? WHERE id = ?', [normalized, user.id]);
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'That employee ID is already used by another account.');
    throw error;
  }
  return normalized;
}

function validateRegistration(registration) {
  const firstName = String(registration.firstName || '').trim();
  const middleName = String(registration.middleName || '').trim();
  const surname = String(registration.surname || '').trim();
  const employeeId = String(registration.employeeId || '').trim().toUpperCase();
  const username = String(registration.username || '').trim().toLowerCase();
  const position = String(registration.position || '').trim();
  const office = String(registration.office || '').trim();
  const email = String(registration.email || '').trim().toLowerCase();
  const password = registration.password;
  if (!firstName || !surname || !employeeId || !position || !office || !email || !username) {
    throw new ApiError(400, 'Complete all required account details.');
  }
  if (!/^[A-Za-z0-9._-]{4,30}$/.test(username)) throw new ApiError(400, 'Username must be 4-30 valid characters.');
  if (!/^[A-Z0-9-]{2,24}$/.test(employeeId)) throw new ApiError(400, 'Enter a valid employee ID.');
  if (!/^[A-Za-zÑñ .'-]{2,40}$/.test(firstName) || !/^[A-Za-zÑñ .'-]{2,40}$/.test(surname)
    || (middleName && !/^[A-Za-zÑñ .'-]{1,40}$/.test(middleName))) {
    throw new ApiError(400, 'Enter valid names using letters, spaces, apostrophes, periods, or hyphens.');
  }
  if (position.length < 2 || position.length > 100) throw new ApiError(400, 'Employee position must be 2-100 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid institutional email address.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 64
    || Buffer.byteLength(password, 'utf8') > 72
    || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ApiError(400, 'Password must be 8-64 characters and contain at least one letter and one number.');
  }
  if (registration.acceptedTerms !== true) throw new ApiError(400, 'You must accept the Terms and Conditions to create an account.');
  return { firstName, middleName, surname, employeeId, username, position, office, email, password };
}

async function fetchAccountById(pool, id) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.role, u.first_name, u.middle_name, u.surname, u.employee_id,
            u.position, u.email, o.name AS office, o.office_code
       FROM users u LEFT JOIN offices o ON o.id = u.office_id
      WHERE u.id = ? LIMIT 1`,
    [id]
  );
  return profileFromRow(rows[0]);
}

function accountIsSupplyOfficeHead(account) {
  return account?.role === 'admin'
    && /\bhead\b/i.test(account.title || '')
    && /supply office/i.test(`${account.title || ''} ${account.office || ''}`);
}

function registerDatabaseApi(app, pool) {
  const authenticated = requireAuth(pool);

  app.get('/api/health', route(async (request, response) => {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  }));

  app.get('/api/auth/session', route(async (request, response) => {
    response.json({ user: await findSession(pool, request) });
  }));

  app.post('/api/auth/login', route(async (request, response) => {
    const username = String(request.body?.username || '').trim().toLowerCase();
    const password = request.body?.password;
    if (!username || typeof password !== 'string') throw new ApiError(400, 'Enter your username and password.');
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.password_hash, u.role, u.first_name, u.middle_name, u.surname,
              u.employee_id, u.position, u.email, o.name AS office, o.office_code, u.is_active
         FROM users u LEFT JOIN offices o ON o.id = u.office_id
        WHERE LOWER(u.username) = LOWER(?) LIMIT 1`,
      [username]
    );
    const account = rows[0];
    if (!account || !account.is_active || !account.password_hash
      || !(await bcrypt.compare(password, account.password_hash))) {
      throw new ApiError(401, 'Username or password is incorrect.');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const remember = request.body?.remember === true;
    const maxAge = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
    await pool.execute('DELETE FROM user_sessions WHERE expires_at <= NOW()');
    await pool.execute(
      "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, NOW() + (? * INTERVAL '1 second'))",
      [account.id, tokenHash, maxAge]
    );
    issueCookie(response, request, token, maxAge, remember);
    response.json({ ok: true, user: profileFromRow(account) });
  }));

  app.post('/api/auth/logout', route(async (request, response) => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);
    }
    clearCookie(response, request);
    response.json({ ok: true });
  }));

  app.post('/api/auth/register', route(async (request, response) => {
    const registration = validateRegistration(request.body || {});
    const [offices] = await pool.execute(
      'SELECT id FROM offices WHERE name = ? AND is_active = 1 LIMIT 1',
      [registration.office]
    );
    if (!offices[0]) throw new ApiError(400, 'Choose a valid active office.');
    const passwordHash = await bcrypt.hash(registration.password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users
        (username, password_hash, role, first_name, middle_name, surname, employee_id,
         position, office_id, email, must_change_password, is_active)
       VALUES (?, ?, 'end-user', ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        registration.username, passwordHash, registration.firstName, registration.middleName || null,
        registration.surname, registration.employeeId, registration.position, offices[0].id, registration.email
      ]
    );
    response.status(201).json({ ok: true, account: await fetchAccountById(pool, result.insertId) });
  }));

  app.get('/api/accounts/find', authenticated, requireRoles('admin', 'staff'), route(async (request, response) => {
    const name = String(request.query.name || '').trim();
    const office = String(request.query.office || '').trim();
    if (!name) return response.json({ account: null });
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.role, u.first_name, u.middle_name, u.surname, u.employee_id,
              u.position, u.email, o.name AS office, o.office_code
         FROM users u LEFT JOIN offices o ON o.id = u.office_id
        WHERE u.role = 'end-user' AND LOWER(CONCAT_WS(' ', u.first_name, u.middle_name, u.surname)) = LOWER(?)
          AND (? = '' OR LOWER(o.name) = LOWER(?))
        ORDER BY u.id LIMIT 1`,
      [name, office, office]
    );
    response.json({ account: profileFromRow(rows[0]) });
  }));

  app.get('/api/accounts/head', authenticated, requireRoles('admin', 'staff'), route(async (request, response) => {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.role, u.first_name, u.middle_name, u.surname, u.employee_id,
              u.position, u.email, o.name AS office, o.office_code
         FROM users u LEFT JOIN offices o ON o.id = u.office_id
        WHERE u.role = 'admin' AND u.is_active = 1 ORDER BY u.id`
    );
    const accounts = rows.map(profileFromRow);
    const account = accounts.find(accountIsSupplyOfficeHead) || accounts[0] || null;
    response.json({ account });
  }));

  app.get('/api/accounts/:id', authenticated, requireRoles('admin', 'staff'), route(async (request, response) => {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.role, u.first_name, u.middle_name, u.surname, u.employee_id,
              u.position, u.email, o.name AS office, o.office_code
         FROM users u LEFT JOIN offices o ON o.id = u.office_id WHERE u.id = ? LIMIT 1`,
      [request.params.id]
    );
    response.json({ account: profileFromRow(rows[0]) });
  }));

  app.put('/api/accounts/me/employee-id', authenticated, route(async (request, response) => {
    const employeeId = await updateProfileEmployeeId(pool, request.user, request.body?.employeeId);
    response.json({ ok: true, employeeId });
  }));

  app.get('/api/records', authenticated, route(async (request, response) => {
    response.json({ records: await readRecords(pool, request.user) });
  }));

  app.post('/api/records/mutation', authenticated, route(async (request, response) => {
    const { action, payload = {} } = request.body || {};
    if (!['save-record', 'update-record', 'update-request-status', 'update-pending-request',
      'cancel-request', 'set-office-item-quota'].includes(action)) {
      throw new ApiError(400, 'Unknown record operation.');
    }
    let resource = '';
    let savedId = '';
    const result = await withTransaction(pool, async connection => {
      if (action === 'save-record') {
        resource = String(payload.resource || '');
        const record = payload.record || {};
        if (resource === 'categories') {
          if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can manage item categories.');
          savedId = await saveCategory(connection, record);
        } else if (resource === 'items') {
          if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can manage inventory.');
          savedId = await saveItem(connection, record, request.user);
        } else if (resource === 'suppliers') {
          if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can manage suppliers.');
          savedId = await saveSupplier(connection, record);
        } else if (resource === 'requests') {
          savedId = await saveRequest(connection, record, request.user);
        } else if (resource === 'receipts') {
          if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can receive stock.');
          savedId = await saveReceipt(connection, record, request.user);
        } else if (resource === 'issuances') {
          if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can issue supplies.');
          savedId = await saveIssuance(connection, record, request.user);
        } else {
          throw new ApiError(400, 'A valid record type is required.');
        }
      } else if (action === 'update-record') {
        if (!['admin', 'staff'].includes(request.user.role)) throw new ApiError(403, 'Only staff can update records.');
        resource = String(payload.resource || '');
        savedId = String(payload.recordId || '');
        if (resource === 'items') await updateItem(connection, savedId, payload.changes || {}, request.user);
        else if (resource === 'suppliers') await updateSupplier(connection, savedId, payload.changes || {});
        else throw new ApiError(400, 'The record update is invalid.');
      } else if (action === 'update-request-status') {
        resource = 'requests';
        savedId = String(payload.requestId || '');
        await setRequestStatus(connection, savedId, payload.status, request.user);
      } else if (action === 'update-pending-request') {
        resource = 'requests';
        savedId = String(payload.requestId || '');
        await updatePendingRequest(connection, savedId, payload.record || {}, request.user);
      } else if (action === 'set-office-item-quota') {
        resource = 'officeQuotas';
        savedId = await setOfficeItemQuota(connection, payload, request.user);
      } else {
        resource = 'requests';
        savedId = String(payload.requestId || '');
        await cancelRequest(connection, savedId, request.user);
      }
      const records = await readRecords(connection, request.user);
      const record = resource
        ? records[resource]?.find(entry => String(entry.id) === String(savedId)) || null
        : null;
      return { records, record };
    });
    response.json({ ok: true, record: result.record, records: result.records });
  }));

  app.get('/api/password-resets', route(async (request, response) => {
    const user = await findSession(pool, request);
    const username = String(request.query.username || '').trim().toLowerCase();
    if (!user && !username) throw new ApiError(401, 'Enter the account username to check reset status.');
    if (user?.role === 'admin' && !username) {
      const [rows] = await pool.execute(
        `SELECT p.id, u.username, u.role,
                CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.surname) AS account_name,
                p.status, p.requested_at, p.reviewed_at, p.completed_at
           FROM password_reset_requests p JOIN users u ON u.id = p.user_id
          ORDER BY p.requested_at DESC`
      );
      return response.json({ requests: rows.map(row => ({
        id: String(row.id), username: row.username, role: row.role, accountName: row.account_name,
        status: row.status, requestedAt: row.requested_at, reviewedAt: row.reviewed_at, completedAt: row.completed_at
      })) });
    }
    if (user && user.role !== 'admin' && username !== user.username.toLowerCase()) {
      throw new ApiError(403, 'You can only check your own password reset status.');
    }
    const [rows] = await pool.execute(
      `SELECT p.id, u.username, u.role,
              CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.surname) AS account_name,
              p.status, p.requested_at, p.reviewed_at, p.completed_at
         FROM password_reset_requests p JOIN users u ON u.id = p.user_id
        WHERE LOWER(u.username) = LOWER(?) ORDER BY p.requested_at DESC`,
      [username]
    );
    response.json({ requests: rows.map(row => ({
      id: String(row.id), username: row.username, role: row.role, accountName: row.account_name,
      status: row.status, requestedAt: row.requested_at, reviewedAt: row.reviewed_at, completedAt: row.completed_at
    })) });
  }));

  app.post('/api/password-resets', route(async (request, response) => {
    const username = String(request.body?.username || '').trim().toLowerCase();
    if (!username) throw new ApiError(400, 'Enter the username for the account.');
    const resetRequest = await withTransaction(pool, async connection => {
      const [accounts] = await connection.execute(
        'SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1 LIMIT 1 FOR UPDATE',
        [username]
      );
      const account = accounts[0];
      if (!account) throw new ApiError(404, 'No account was found with that username.');
      if (!['staff', 'end-user'].includes(account.role)) {
        throw new ApiError(400, 'Password resets are available only for staff and end-user accounts.');
      }
      const [active] = await connection.execute(
        `SELECT id FROM password_reset_requests WHERE user_id = ? AND status IN ('Pending', 'Approved') LIMIT 1`,
        [account.id]
      );
      if (active[0]) throw new ApiError(409, 'A password reset request is already active for this account.');
      const [result] = await connection.execute(
        "INSERT INTO password_reset_requests (user_id, status) VALUES (?, 'Pending')",
        [account.id]
      );
      return { id: String(result.insertId), username: account.username, role: account.role };
    });
    response.status(201).json({
      ok: true,
      request: {
        id: resetRequest.id,
        username: resetRequest.username,
        role: resetRequest.role,
        accountName: '',
        status: 'Pending',
        requestedAt: new Date().toISOString()
      }
    });
  }));

  app.post('/api/password-resets/:id/review', authenticated, requireRoles('admin'), route(async (request, response) => {
    const status = request.body?.status;
    if (!['Approved', 'Rejected'].includes(status)) throw new ApiError(400, 'Choose Approved or Rejected.');
    await withTransaction(pool, async connection => {
      const [rows] = await connection.execute(
        'SELECT id, status FROM password_reset_requests WHERE id = ? FOR UPDATE',
        [request.params.id]
      );
      if (!rows[0] || rows[0].status !== 'Pending') {
        throw new ApiError(409, 'This password reset request is no longer pending.');
      }
      await connection.execute(
        'UPDATE password_reset_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
        [status, request.user.id, request.params.id]
      );
    });
    const [rows] = await pool.execute(
      `SELECT p.id, u.username, u.role,
              CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.surname) AS account_name,
              p.status, p.requested_at, p.reviewed_at
         FROM password_reset_requests p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
      [request.params.id]
    );
    const row = rows[0];
    response.json({ ok: true, request: {
      id: String(row.id), username: row.username, role: row.role, accountName: row.account_name,
      status: row.status, requestedAt: row.requested_at, reviewedAt: row.reviewed_at
    } });
  }));

  app.post('/api/password-resets/complete', route(async (request, response) => {
    const username = String(request.body?.username || '').trim().toLowerCase();
    const password = request.body?.password;
    if (typeof password !== 'string' || password.length < 8 || password.length > 64
      || Buffer.byteLength(password, 'utf8') > 72
      || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new ApiError(400, 'Password must be 8-64 characters and contain at least one letter and one number.');
    }
    await withTransaction(pool, async connection => {
      const [accounts] = await connection.execute(
        'SELECT id, role FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1 FOR UPDATE',
        [username]
      );
      const account = accounts[0];
      if (!account || !['staff', 'end-user'].includes(account.role)) {
        throw new ApiError(404, 'No eligible account was found for this reset request.');
      }
      const [requests] = await connection.execute(
        `SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'Approved'
          ORDER BY requested_at DESC LIMIT 1 FOR UPDATE`,
        [account.id]
      );
      if (!requests[0]) throw new ApiError(409, 'This password reset request has not been approved.');
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute(
        'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
        [passwordHash, account.id]
      );
      await connection.execute(
        "UPDATE password_reset_requests SET status = 'Completed', completed_at = NOW() WHERE id = ?",
        [requests[0].id]
      );
      await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [account.id]);
    });
    response.json({ ok: true });
  }));
}

module.exports = { registerDatabaseApi, createErrorHandler, ApiError };

export {};
