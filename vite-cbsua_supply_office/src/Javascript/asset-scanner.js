const statusMessage = document.getElementById('scannerStatus');
const detailsSection = document.getElementById('assetDetails');
const cameraPanel = document.getElementById('cameraPanel');
const detailList = document.getElementById('assetDetailList');
let cameraScanner = null;

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('border-red-300', isError);
  statusMessage.classList.toggle('text-red-700', isError);
}

function decodeAssetPayload(encoded) {
  const unpadded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (payload.version !== 1 || !['ICS', 'PAR'].includes(payload.documentType)
    || !payload.itemCode || !payload.itemName || !payload.issuanceReference) {
    throw new Error('This QR code does not contain a valid asset record.');
  }
  return payload;
}

function renderAsset(asset) {
  const fields = [
    ['Classification', asset.classification],
    ['Description', asset.description],
    ['Specifications', asset.specifications],
    ['Quantity', [asset.quantity, asset.unit].filter(Boolean).join(' ')],
    ['Property number', asset.propertyNumber],
    ['Estimated useful life', asset.estimatedUsefulLifeYears && `${asset.estimatedUsefulLifeYears} years`],
    ['Date acquired', asset.dateAcquired],
    ['Amount', asset.amount],
    ['Unit cost', asset.unitCost],
    ['Supplier', asset.supplier],
    ['Delivery receipt date', asset.deliveryReceiptDate],
    ['P.O. No.', asset.purchaseOrderNumber],
    ['P.O. date', asset.purchaseOrderDate],
    ['IAR No.', asset.iarNumber],
    ['IAR date', asset.iarDate],
    ['Fund Cluster', asset.fundCluster],
    ['Issued on', asset.issuedOn],
    ['Issuance reference', asset.issuanceReference]
  ];

  document.getElementById('assetDocumentType').textContent = `${asset.documentType} · ${asset.classification || 'Asset'}`;
  document.getElementById('assetName').textContent = asset.itemName;
  document.getElementById('assetCode').textContent = asset.itemCode;
  detailList.replaceChildren();
  fields.filter(([, value]) => value).forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'min-w-0';
    const term = document.createElement('dt');
    term.className = 'text-xs text-cbsua-muted';
    term.textContent = label;
    const description = document.createElement('dd');
    description.className = 'mt-1 whitespace-pre-line break-words text-sm font-medium';
    description.textContent = value;
    row.append(term, description);
    detailList.append(row);
  });
  detailsSection.classList.remove('hidden');
  cameraPanel.classList.add('hidden');
  showStatus('Asset details are embedded in this QR code.');
}

async function startCameraScanner() {
  if (!window.Html5QrcodeScanner) {
    showStatus('The camera scanner could not load. Check your internet connection and reload.', true);
    return;
  }
  cameraPanel.classList.remove('hidden');
  detailsSection.classList.add('hidden');
  showStatus('Allow camera access to scan an asset QR code.');

  cameraScanner = new window.Html5QrcodeScanner('qrReader', {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  }, false);
  cameraScanner.render(decodedText => {
    let destination;
    try {
      destination = new URL(decodedText);
    } catch {
      showStatus('This QR code is not a valid CBSUA asset link.', true);
      return;
    }
    if (destination.origin !== location.origin || destination.pathname !== location.pathname
      || !destination.searchParams.has('asset')) {
      showStatus('This QR code is not a CBSUA asset link.', true);
      return;
    }
    location.assign(destination.href);
  }, () => {});
}

document.getElementById('scanAnotherAsset').addEventListener('click', () => {
  location.href = `${location.pathname}?scan=1`;
});

const query = new URLSearchParams(location.search);
const encodedAsset = query.get('asset');
if (encodedAsset) {
  try {
    renderAsset(decodeAssetPayload(encodedAsset));
  } catch (error) {
    showStatus(error.message || 'This QR code contains invalid asset details.', true);
  }
} else if (query.get('scan') === '1') {
  startCameraScanner();
} else {
  showStatus('Open this link on a phone and allow camera access to scan asset QR codes.');
  startCameraScanner();
}
