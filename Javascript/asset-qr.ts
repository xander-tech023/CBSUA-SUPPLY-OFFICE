(() => {
  interface ClassificationDetails {
    specifications?: string;
    propertyNumber?: string | number;
    estimatedUsefulLifeYears?: string | number;
    dateAcquired?: string;
  }

  interface AssetRequest {
    id: string;
    documentType?: string;
    classificationDetails?: ClassificationDetails;
    supplyClassification?: string;
    recipient?: string;
    office?: string;
    date?: string;
  }

  interface InventoryItem {
    id: string;
    name: string;
    description?: string;
    unit?: string;
  }

  interface Issuance {
    id: string;
    requestId: string;
    itemId: string;
    quantity: number | string;
    recipient?: string;
    office?: string;
    date?: string;
  }

  interface AssetData {
    reference: string;
    documentType: string;
    classification: string;
    itemCode: string;
    itemName: string;
    quantity: string;
    holder: string;
    office: string;
    issuedOn: string;
    specifications: string;
    propertyNumber: string | number;
    estimatedUsefulLifeYears: string | number;
    dateAcquired: string;
  }

  interface AssetQrIMS {
    pageFeatures: Array<() => void>;
    getLocalRecords(resource: 'requests'): AssetRequest[];
    getLocalRecords(resource: 'items'): InventoryItem[];
    getLocalRecords(resource: 'issuances'): Issuance[];
  }

  interface QRCodeOptions {
    text: string;
    width: number;
    height: number;
    correctLevel: number;
  }

  interface QRCodeConstructor {
    new (element: HTMLElement, options: QRCodeOptions): object;
    CorrectLevel: { M: number };
  }

  const typedWindow = window as Window & { IMS?: AssetQrIMS; QRCode?: QRCodeConstructor };
  typedWindow.IMS = typedWindow.IMS || {} as AssetQrIMS;
  typedWindow.IMS.pageFeatures = typedWindow.IMS.pageFeatures || [];
  const ims = typedWindow.IMS;

  ims.pageFeatures.push(() => {
  const list = document.getElementById('assetQrList')!;
  const printButton = document.getElementById('printAssetQrCodes');
  if (!list) return;

  function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatAssetDetails(asset: AssetData): string {
    return [
      'CBSUA SUPPLY OFFICE ASSET',
      `${asset.documentType} - ${asset.classification}`,
      `Item: ${asset.itemName} (${asset.itemCode})`,
      `MR holder: ${asset.holder}`,
      `Office: ${asset.office}`,
      `Quantity: ${asset.quantity}`,
      `Issued: ${asset.issuedOn || 'Not recorded'}`,
      `Specifications: ${asset.specifications}`,
      asset.propertyNumber && `Property number: ${asset.propertyNumber}`,
      asset.estimatedUsefulLifeYears && `Estimated useful life: ${asset.estimatedUsefulLifeYears} years`,
      asset.dateAcquired && `Date acquired: ${asset.dateAcquired}`,
      `Issuance reference: ${asset.reference}`
    ].filter(Boolean).join('\n');
  }

  function getIssuedAssets(): AssetData[] {
    const requests = new Map<string, AssetRequest>(ims.getLocalRecords('requests').map(request => [request.id, request] as const));
    const items = new Map<string, InventoryItem>(ims.getLocalRecords('items').map(item => [item.id, item] as const));

    return ims.getLocalRecords('issuances')
      .map(issuance => {
        const request = requests.get(issuance.requestId);
        const item = items.get(issuance.itemId);
        const documentType = String(request?.documentType || '').toUpperCase();
        if (!request || !item || !['ICS', 'PAR'].includes(documentType)) return null;

        const details: ClassificationDetails = request.classificationDetails || {};
        const specifications = [...new Set([
          details.specifications,
          item.description
        ].map(value => String(value || '').trim()).filter(Boolean))].join('\n');

        return {
          reference: issuance.id,
          documentType,
          classification: request.supplyClassification || (documentType === 'ICS' ? 'Semi Expendable' : 'Fixed Asset'),
          itemCode: item.id,
          itemName: item.name,
          quantity: `${issuance.quantity} ${item.unit || ''}`.trim(),
          holder: issuance.recipient || request.recipient || 'Not recorded',
          office: issuance.office || request.office || 'Not recorded',
          issuedOn: issuance.date || request.date || '',
          specifications: specifications || 'No specifications recorded.',
          propertyNumber: details.propertyNumber || '',
          estimatedUsefulLifeYears: details.estimatedUsefulLifeYears || '',
          dateAcquired: details.dateAcquired || ''
        };
      })
      .filter((asset): asset is AssetData => Boolean(asset))
      .sort((left, right) => new Date(right.issuedOn).getTime() - new Date(left.issuedOn).getTime());
  }

  function renderAsset(asset: AssetData): HTMLElement {
    const card = createElement('article', 'asset-qr-card rounded-xl border border-cbsua-border bg-white p-5 shadow-sm');
    const heading = createElement('div', 'mb-4');
    heading.append(
      createElement('span', 'inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800', `${asset.documentType} · ${asset.classification}`),
      createElement('h2', 'mt-2 text-lg font-semibold', asset.itemName),
      createElement('p', 'text-sm text-cbsua-muted', `${asset.itemCode} · ${asset.reference}`)
    );

    const details = createElement('div', 'mb-4 space-y-2 text-sm');
    details.append(
      createElement('p', '', `MR holder: ${asset.holder}`),
      createElement('p', '', `Office: ${asset.office}`),
      createElement('p', '', `Issued: ${asset.issuedOn || 'Not recorded'}`),
      createElement('p', '', `Quantity: ${asset.quantity}`),
      createElement('p', 'whitespace-pre-line', `Specifications: ${asset.specifications}`)
    );
    if (asset.propertyNumber) details.append(createElement('p', '', `Property number: ${asset.propertyNumber}`));
    if (asset.estimatedUsefulLifeYears) {
      details.append(createElement('p', '', `Estimated useful life: ${asset.estimatedUsefulLifeYears} years`));
    }
    if (asset.dateAcquired) details.append(createElement('p', '', `Date acquired: ${asset.dateAcquired}`));

    const qrContainer = createElement('div', 'flex min-h-48 items-center justify-center rounded-lg border border-cbsua-border bg-white p-3');
    const qr = createElement('div', 'asset-qr-code');
    qrContainer.append(qr);
    card.append(heading, details, qrContainer);

    try {
      if (!typedWindow.QRCode) throw new Error('The QR code generator did not load. Check your internet connection and reload.');
      const text = formatAssetDetails(asset);
      if (new TextEncoder().encode(text).length > 1600) {
        throw new Error('Specifications are too long to fit in a QR code. Shorten the specifications and try again.');
      }
      new typedWindow.QRCode(qr, {
        text,
        width: 240,
        height: 240,
        correctLevel: typedWindow.QRCode.CorrectLevel.M
      });
    } catch (error: unknown) {
      qrContainer.replaceChildren(createElement('p', 'text-sm text-red-700', (error as Error).message));
    }

    return card;
  }

  function render(): void {
    const assets = getIssuedAssets();
    list.replaceChildren();
    if (!assets.length) {
      const emptyState = createElement('div', 'col-span-full rounded-xl border border-cbsua-border bg-white p-6');
      emptyState.append(
        createElement('h2', 'text-lg font-semibold', 'No issued asset records to generate QR labels from'),
        createElement('p', 'mt-2 text-sm text-cbsua-muted',
          'QR labels include the actual MR holder and item specifications, so they become available after an ICS or PAR issuance is recorded.')
      );

      const steps = document.createElement('ol');
      steps.className = 'mt-4 list-decimal space-y-2 pl-5 text-sm';
      [
        ['Add the asset to Inventory if it is not already listed.', 'inventory.html', 'Open Inventory'],
        ['Create a Semi Expendable (ICS) or Fixed Asset (PAR) request and enter its specifications.', 'stock_request.html', 'Open Stock Requests'],
        ['Approve the request and record the issuance to assign its MR holder.', 'issue_supply.html', 'Open Issue Supplies']
      ].forEach(([instruction, href, linkText]) => {
        const step = document.createElement('li');
        step.append(document.createTextNode(`${instruction} `));
        const link = createElement('a', 'font-medium text-cbsua-primary underline', linkText);
        link.href = href;
        step.append(link);
        steps.append(step);
      });

      emptyState.append(steps);
      list.append(emptyState);
      return;
    }
    assets.forEach(asset => list.append(renderAsset(asset)));
  }

  printButton?.addEventListener('click', () => window.print());
  window.addEventListener('ims:records-updated', render);
  render();
});
})();
