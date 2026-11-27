import { getIssuedAssetQrRecords } from './asset-qr-data.js';

window.IMS.pageFeatures.push(() => {
  const button = document.querySelector('[data-share-asset-scanner]');
  const link = document.querySelector('[data-asset-scanner-link]');
  const sharePanel = document.querySelector('[data-asset-scanner-share-panel]');
  const { getLocalRecords, showToast } = window.IMS;
  if (!button || !link) return;

  const closeButton = document.querySelector('[data-close-asset-scanner-share]');
  const qrContainer = document.querySelector('[data-asset-scanner-qr]');
  const copyButton = document.querySelector('[data-copy-asset-scanner-link]');
  const whatsappLink = document.querySelector('[data-share-asset-scanner-whatsapp]');
  const emailLink = document.querySelector('[data-share-asset-scanner-email]');
  const assetSelect = document.querySelector('[data-share-asset-qr-select]');
  const status = document.querySelector('[data-asset-qr-status]');
  let scannerUrl = '';

  function clearAssetQr(message) {
    scannerUrl = '';
    qrContainer.replaceChildren();
    link.hidden = true;
    copyButton.disabled = true;
    whatsappLink.hidden = true;
    emailLink.hidden = true;
    status.textContent = message;
  }

  async function createAssetQr() {
    const asset = getIssuedAssetQrRecords(getLocalRecords)
      .find(record => record.issuanceReference === assetSelect.value);
    if (!asset) {
      clearAssetQr('No issued ICS or PAR records are available to create a memorandum receipt QR.');
      return;
    }

    button.disabled = true;
    assetSelect.disabled = true;
    clearAssetQr('Preparing the QR code…');
    try {
      const response = await fetch('/api/scanner-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: location.origin, asset })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Scanner API returned ${response.status}.`);
      if (!window.QRCode) throw new Error('The QR code generator did not load. Check your internet connection and reload.');

      scannerUrl = result.url;
      link.href = scannerUrl;
      link.textContent = `Open details for ${asset.itemName}`;
      link.hidden = false;
      whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(`Memorandum receipt for ${asset.holderName || 'recipient'} — ${asset.itemName}\n${scannerUrl}`)}`;
      emailLink.href = `mailto:?subject=${encodeURIComponent(`Memorandum receipt — ${asset.itemName}`)}&body=${encodeURIComponent(`Holder: ${asset.holderName || 'Not recorded'}\nSpecifications: ${asset.specifications || 'Not recorded'}\nEstimated useful life: ${asset.estimatedUsefulLifeYears || 'Not recorded'} years\n${scannerUrl}`)}`;
      whatsappLink.hidden = false;
      emailLink.hidden = false;
      copyButton.disabled = false;
      qrContainer.replaceChildren();
      new window.QRCode(qrContainer, {
        text: scannerUrl,
        width: 144,
        height: 144,
        correctLevel: window.QRCode.CorrectLevel.M
      });
      status.textContent = `Scan to view the memorandum receipt for ${asset.holderName || 'the recorded recipient'}, including item specifications and useful life.`;
    } catch (error) {
      clearAssetQr(`Could not create the QR code: ${error.message}`);
      showToast(`Could not create the memorandum receipt QR: ${error.message}`);
      console.error('Memorandum receipt QR request failed.', error);
    } finally {
      button.disabled = false;
      assetSelect.disabled = false;
    }
  }

  function refreshAssetOptions() {
    const previousValue = assetSelect.value;
    const records = getIssuedAssetQrRecords(getLocalRecords);
    assetSelect.replaceChildren();
    if (!records.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No issued ICS/PAR records';
      assetSelect.append(option);
      assetSelect.disabled = true;
      clearAssetQr('Issue an ICS or PAR first to generate a QR with its memorandum receipt details.');
      return null;
    }

    records.forEach(asset => {
      const option = document.createElement('option');
      option.value = asset.issuanceReference;
      option.textContent = `${asset.documentType} · ${asset.holderName || 'No holder recorded'} · ${asset.itemName}`;
      assetSelect.append(option);
    });
    assetSelect.disabled = false;
    assetSelect.value = records.some(asset => asset.issuanceReference === previousValue)
      ? previousValue
      : records[0].issuanceReference;
    return records.find(asset => asset.issuanceReference === assetSelect.value);
  }

  closeButton?.addEventListener('click', () => {
    sharePanel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });

  assetSelect?.addEventListener('change', () => {
    createAssetQr();
  });

  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(scannerUrl);
      showToast('Memorandum receipt link copied.');
    } catch (error) {
      showToast(`Could not copy the memorandum receipt link: ${error.message}`);
      console.error('Memorandum receipt link copy failed.', error);
    }
  });

  button.addEventListener('click', async () => {
    if (sharePanel) {
      if (!sharePanel.hidden) {
        sharePanel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        return;
      }
      sharePanel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      const selectedAsset = refreshAssetOptions();
      if (selectedAsset) await createAssetQr();
      return;
    }

    button.disabled = true;
    try {
      const response = await fetch(`/api/scanner-link?appUrl=${encodeURIComponent(location.origin)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Scanner API returned ${response.status}.`);

      scannerUrl = result.url;
      link.href = scannerUrl;
      link.textContent = scannerUrl;
      link.hidden = false;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'CBSUA asset scanner', url: scannerUrl });
          showToast('Scanner link shared.');
        } catch (error) {
          if (error.name !== 'AbortError') throw error;
          showToast('Sharing canceled. The scanner link is still available here.');
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(scannerUrl);
        showToast('Scanner link copied. You can also open the link shown here.');
      } else {
        showToast('Scanner link is ready. Open or copy the link shown here.');
      }
    } catch (error) {
      showToast(`Could not create or share the scanner link: ${error.message}`);
      console.error('Scanner link request failed.', error);
    } finally {
      button.disabled = false;
    }
  });
});
