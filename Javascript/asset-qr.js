"use strict";
(() => {
    const typedWindow = window;
    typedWindow.IMS = typedWindow.IMS || {};
    typedWindow.IMS.pageFeatures = typedWindow.IMS.pageFeatures || [];
    const ims = typedWindow.IMS;
    ims.pageFeatures.push(() => {
        const list = document.getElementById('assetQrList');
        const printButton = document.getElementById('printAssetQrCodes');
        if (!list)
            return;
        function createElement(tag, className, text) {
            const element = document.createElement(tag);
            if (className)
                element.className = className;
            if (text !== undefined)
                element.textContent = text;
            return element;
        }
        function formatAssetDetails(asset) {
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
        function getIssuedAssets() {
            const requests = new Map(ims.getLocalRecords('requests').map(request => [request.id, request]));
            const items = new Map(ims.getLocalRecords('items').map(item => [item.id, item]));
            return ims.getLocalRecords('issuances')
                .map(issuance => {
                const request = requests.get(issuance.requestId);
                const item = items.get(issuance.itemId);
                const documentType = String(request?.documentType || '').toUpperCase();
                if (!request || !item || !['ICS', 'PAR'].includes(documentType))
                    return null;
                const details = request.classificationDetails || {};
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
                .filter((asset) => Boolean(asset))
                .sort((left, right) => new Date(right.issuedOn).getTime() - new Date(left.issuedOn).getTime());
        }
        function renderAsset(asset) {
            const card = createElement('article', 'asset-qr-card rounded-xl border border-cbsua-border bg-white p-5 shadow-sm');
            const heading = createElement('div', 'mb-4');
            heading.append(createElement('span', 'inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800', `${asset.documentType} · ${asset.classification}`), createElement('h2', 'mt-2 text-lg font-semibold', asset.itemName), createElement('p', 'text-sm text-cbsua-muted', `${asset.itemCode} · ${asset.reference}`));
            const details = createElement('div', 'mb-4 space-y-2 text-sm');
            details.append(createElement('p', '', `MR holder: ${asset.holder}`), createElement('p', '', `Office: ${asset.office}`), createElement('p', '', `Issued: ${asset.issuedOn || 'Not recorded'}`), createElement('p', '', `Quantity: ${asset.quantity}`), createElement('p', 'whitespace-pre-line', `Specifications: ${asset.specifications}`));
            if (asset.propertyNumber)
                details.append(createElement('p', '', `Property number: ${asset.propertyNumber}`));
            if (asset.estimatedUsefulLifeYears) {
                details.append(createElement('p', '', `Estimated useful life: ${asset.estimatedUsefulLifeYears} years`));
            }
            if (asset.dateAcquired)
                details.append(createElement('p', '', `Date acquired: ${asset.dateAcquired}`));
            const qrContainer = createElement('div', 'flex min-h-48 items-center justify-center rounded-lg border border-cbsua-border bg-white p-3');
            const qr = createElement('div', 'asset-qr-code');
            qrContainer.append(qr);
            card.append(heading, details, qrContainer);
            try {
                if (!typedWindow.QRCode)
                    throw new Error('The QR code generator did not load. Check your internet connection and reload.');
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
            }
            catch (error) {
                qrContainer.replaceChildren(createElement('p', 'text-sm text-red-700', error.message));
            }
            return card;
        }
        function render() {
            const assets = getIssuedAssets();
            list.replaceChildren();
            if (!assets.length) {
                const emptyState = createElement('div', 'col-span-full rounded-xl border border-cbsua-border bg-white p-6');
                emptyState.append(createElement('h2', 'text-lg font-semibold', 'No issued asset records to generate QR labels from'), createElement('p', 'mt-2 text-sm text-cbsua-muted', 'QR labels include the actual MR holder and item specifications, so they become available after an ICS or PAR issuance is recorded.'));
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
