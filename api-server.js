const express = require('express');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('./database');
const { registerDatabaseApi, createErrorHandler } = require('./database-api');

const app = express();
const port = Number(process.env.PORT) || 3001;
const distDirectory = path.join(__dirname, 'vite-cbsua_supply_office', 'dist');
const assetFields = [
  'documentType',
  'classification',
  'itemCode',
  'itemName',
  'description',
  'specifications',
  'quantity',
  'unit',
  'propertyNumber',
  'estimatedUsefulLifeYears',
  'dateAcquired',
  'amount',
  'unitCost',
  'supplier',
  'deliveryReceiptDate',
  'purchaseOrderNumber',
  'purchaseOrderDate',
  'iarNumber',
  'iarDate',
  'fundCluster',
  'issuedOn',
  'issuanceReference'
];

app.use(express.json({ limit: '8kb' }));

function getLanIPv4Address() {
  const addresses = Object.values(os.networkInterfaces())
    .flatMap(network => network || [])
    .filter(address => address.family === 'IPv4' && !address.internal
      && !address.address.startsWith('169.254.'));
  const privateAddress = addresses.find(({ address }) =>
    /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(address));
  return (privateAddress || addresses[0])?.address || '';
}

function createScannerUrl(appUrl, request, asset) {
  const configuredAppUrl = process.env.PUBLIC_APP_URL || appUrl || `${request.protocol}://${request.get('host')}`;
  let base;
  try {
    base = new URL(configuredAppUrl);
  } catch {
    throw new Error('The application URL must be an absolute HTTP or HTTPS base URL.');
  }
  const isLoopback = base.hostname === 'localhost'
    || base.hostname === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(base.hostname);
  if (!process.env.PUBLIC_APP_URL && isLoopback) {
    const lanAddress = getLanIPv4Address();
    if (!lanAddress) {
      throw new Error('A LAN address could not be detected. Set PUBLIC_APP_URL to an address reachable from the phone.');
    }
    base.hostname = lanAddress;
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('The application URL must be an HTTP or HTTPS base URL without credentials or query parameters.');
  }

  const appPath = base.pathname.replace(/\/+$/, '');
  const scannerUrl = new URL(`${appPath}/src/html/asset_scanner.html`, base.origin);
  if (!asset) {
    scannerUrl.searchParams.set('scan', '1');
    return scannerUrl.toString();
  }

  const documentType = String(asset.documentType || '').toUpperCase();
  if (!['ICS', 'PAR'].includes(documentType)) {
    throw new Error('Only ICS and PAR asset records can be shared as QR codes.');
  }

  const payload = { version: 1 };
  for (const field of assetFields) {
    if (asset[field] === undefined || asset[field] === null) continue;
    if (!['string', 'number', 'boolean'].includes(typeof asset[field])) {
      throw new Error(`The asset field "${field}" must be a text or numeric value.`);
    }
    const value = String(asset[field]).trim();
    if (value.length > 240) throw new Error(`The asset field "${field}" is too long.`);
    if (value) payload[field] = value;
  }
  payload.documentType = documentType;
  if (!payload.itemCode || !payload.itemName || !payload.issuanceReference) {
    throw new Error('Asset code, item name, and issuance reference are required.');
  }

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  scannerUrl.searchParams.set('asset', encoded);
  if (Buffer.byteLength(scannerUrl.toString(), 'utf8') > 1900) {
    throw new Error('The asset details are too long to fit in a QR code. Shorten the specifications and try again.');
  }
  return scannerUrl.toString();
}

app.get('/api/scanner-link', (request, response) => {
  try {
    response.json({ url: createScannerUrl(request.query.appUrl, request, null) });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/scanner-link', (request, response) => {
  try {
    response.json({ url: createScannerUrl(request.body?.appUrl, request, request.body?.asset) });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

async function startServer() {
  const pool = await initializeDatabase();
  app.set('trust proxy', process.env.TRUST_PROXY === '1');
  registerDatabaseApi(app, pool);
  app.use(express.static(distDirectory));
  app.use(createErrorHandler());
  app.listen(port, '0.0.0.0', () => {
    console.log(`Supply Office API listening on port ${port}`);
  });
}

startServer().catch(error => {
  console.error('The API could not start.', error);
  process.exitCode = 1;
});
