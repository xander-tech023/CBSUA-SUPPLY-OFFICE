(() => {
  interface ClassificationDetails {
    fundCluster?: string;
    unitCost?: number | string | null;
    usefulLifeYears?: number | string | null;
    estimatedUsefulLifeYears?: number | string | null;
    supplier?: string;
    deliveryReceiptDate?: string;
    purchaseOrderNumber?: string;
    purchaseOrderDate?: string;
    iarNumber?: string;
    iarDate?: string;
    amount?: number | string | null;
    estimatedAmount?: number | string | null;
    estimatedUnitCost?: number | string | null;
    specifications?: string;
    propertyNumber?: string;
    dateAcquired?: string;
  }

  interface RequestRecord {
    id: string;
    itemId: string;
    office: string;
    recipient: string;
    employeeId?: string;
    requesterId?: string | number | null;
    status: string;
    quantity: number | string;
    documentType?: string;
    supplyClassification?: string;
    date?: string;
    createdAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    remarks?: string;
    classificationDetails?: ClassificationDetails;
  }

  interface InventoryItem {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unit: string;
    minimum: number;
    unitCost?: number | string | null;
    supplier?: string;
    propertyNumber?: string;
    dateAcquired?: string;
  }

  interface IssuanceRecord {
    id: string;
    requestId: string;
    itemId: string;
    quantity: number;
    date: string;
    createdAt?: string;
    recipientEmployeeId?: string;
    handledBy?: string;
  }

  interface PublicProfile {
    id?: string | number;
    name?: string;
    title?: string;
    role?: string;
  }

  type PdfColor = object;

  interface PdfFont {
    widthOfTextAtSize(text: string, size: number): number;
  }

  interface PdfPage {
    drawText(text: string, options: {
      x: number;
      y: number;
      size: number;
      font: PdfFont;
      color: PdfColor;
    }): void;
    drawRectangle(options: {
      x: number;
      y: number;
      width: number;
      height: number;
      color: PdfColor;
    }): void;
  }

  interface PdfDocument {
    getPages(): PdfPage[];
    getPageCount(): number;
    embedFont(font: unknown): Promise<PdfFont>;
    save(): Promise<Uint8Array>;
  }

  interface PdfLibrary {
    PDFDocument: { load(bytes: ArrayBuffer): Promise<PdfDocument> };
    StandardFonts: { TimesRoman: unknown };
    rgb(red: number, green: number, blue: number): PdfColor;
  }

  interface RequisitionPrintOptions {
    request: RequestRecord;
    item: InventoryItem;
    quantity: number;
    requestedQuantity: number;
    issueDate: string;
    reference: string;
    requestedBy: string;
    approvedBy: string;
    supplyOfficeHead: PublicProfile;
    remarks: string;
  }

  interface InventoryPrintOptions {
    type: 'ICS' | 'PAR';
    request: RequestRecord;
    item: InventoryItem;
    quantity: number;
    issueDate: string;
    reference: string;
    requestedBy: string;
    requestingAccount: PublicProfile | null;
    supplyOfficeHead: PublicProfile;
  }

  interface IssueIMS {
    pageFeatures: Array<() => void>;
    currentUser: { name: string; title: string };
    getLocalRecords(resource: 'requests'): RequestRecord[];
    getLocalRecords(resource: 'items'): InventoryItem[];
    getLocalRecords(resource: 'issuances'): IssuanceRecord[];
    getRemainingRequestQuantity(request: RequestRecord): number;
    nextRecordId(resource: string, prefix: string, initialValue: number): string;
    showToast(message: string): void;
    accounts: {
      findAccountById(id: string | number): PublicProfile | null;
      findEndUserByName(name: string, office: string): PublicProfile | null;
      getSupplyOfficeHead(): PublicProfile | null;
    };
  }

  const browser = window as Window & { IMS?: IssueIMS; PDFLib?: PdfLibrary };
  browser.IMS!.pageFeatures.push(() => {
  const { getLocalRecords, getRemainingRequestQuantity, showToast } = browser.IMS!;
  const formElement = document.getElementById('issueForm') as HTMLFormElement | null;
  if (!formElement) return;
  const form = formElement;

  const requestSelect = form.querySelector<HTMLSelectElement>('#issueRequest')!;
  const quantityInput = form.querySelector<HTMLInputElement>('#issueQuantity')!;
  const itemInput = form.querySelector<HTMLInputElement>('#issueItem')!;
  const itemIdInput = form.querySelector<HTMLInputElement>('#issueItemId')!;
  const requestedInput = form.querySelector<HTMLInputElement>('#issueRequested')!;
  const officeInput = form.querySelector<HTMLInputElement>('#issueOffice')!;
  const recipientInput = form.querySelector<HTMLInputElement>('#issueRecipient')!;
  const recipientIdInput = form.querySelector<HTMLInputElement>('#issueRecipientId')!;
  const issueButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const balanceCard = Array.from(document.querySelectorAll('.stat-card'))
    .find(card => card.querySelector('h5')?.textContent!.trim() === 'Stock after issuance');
  const balanceRows = Array.from(balanceCard?.querySelectorAll('.flex.justify-between') || []);
  const stockStatus = balanceCard?.querySelector<HTMLElement>('.bg-green-50');
  const audit = {
    reference: document.getElementById('issueReference'),
    request: document.getElementById('issueAuditRequest'),
    recipient: document.getElementById('issueAuditRecipient'),
    office: document.getElementById('issueAuditOffice'),
    handler: document.getElementById('issueAuditHandler'),
    date: document.getElementById('issueAuditDate')
  };
  const officialFormButton = document.querySelector<HTMLButtonElement>('[data-issue-document="form"]');
  const receiptButton = document.querySelector<HTMLButtonElement>('[data-issue-document="receipt"]');
  const officialFormNames: Record<string, string> = {
    RIS: 'Requisition and Issue Slip',
    ICS: 'Inventory Custodian Slip',
    PAR: 'Property Acknowledgment Receipt'
  };
  const header = document.querySelector<HTMLElement>('main .border-2');
  let selectedItem: InventoryItem | null | undefined = null;
  let selectedRequest: RequestRecord | null | undefined = null;
  let lastIssuance = [...getLocalRecords('issuances')]
    .sort((left, right) => new Date(right.createdAt as string).getTime() - new Date(left.createdAt as string).getTime())[0] || null;
  const printDocument = document.createElement('article');
  printDocument.id = 'imsPrintDocument';
  printDocument.className = 'ims-print-document';
  printDocument.hidden = true;
  document.body.append(printDocument);
  if (receiptButton) receiptButton.disabled = !lastIssuance;
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.querySelector<HTMLInputElement>('#issueDate')!.value = today.toISOString().slice(0, 10);
  form.querySelector<HTMLInputElement>('#issueHandler')!.value = `${browser.IMS!.currentUser.name} — ${browser.IMS!.currentUser.title}`;

  function updatePreview(resetQuantity = false): void {
    selectedRequest = getLocalRecords('requests').find(request => request.id === requestSelect.value);
    const request = selectedRequest;
    selectedItem = request && getLocalRecords('items').find(item => item.id === request.itemId);
    const documentType = selectedRequest?.documentType || 'RIS';
    if (officialFormButton) {
      officialFormButton.textContent = `Print ${documentType} — ${officialFormNames[documentType] || 'official form'}`;
      officialFormButton.disabled = !selectedRequest || !selectedItem || !officialFormNames[documentType];
    }
    if (!selectedRequest || !selectedItem) {
      itemInput.value = '';
      itemIdInput.value = '';
      requestedInput.value = '';
      officeInput.value = '';
      recipientInput.value = '';
      recipientIdInput.value = '';
      quantityInput.value = '';
      quantityInput.removeAttribute('max');
      issueButton.disabled = true;
      if (header) {
        header.querySelector('span')!.textContent = 'No approved requests';
        header.querySelector('h5')!.textContent = 'No approved request selected';
        const details = header.querySelector('p');
        if (details) details.textContent = 'Approve a request before recording an issuance.';
      }
      balanceRows.forEach(row => {
        const output = row.querySelector('span:last-child');
        if (output) output.textContent = '—';
      });
      if (stockStatus) stockStatus.textContent = 'No approved request selected';
      Object.values(audit).forEach(element => { if (element) element.textContent = '—'; });
      return;
    }

    const remaining = getRemainingRequestQuantity(selectedRequest);
    const maximumIssue = Math.min(remaining, selectedItem.quantity);
    itemInput.value = `${selectedItem.id} — ${selectedItem.name}`;
    itemIdInput.value = selectedItem.id;
    requestedInput.value = `${remaining} ${selectedItem.unit} remaining`;
    officeInput.value = selectedRequest.office;
    recipientInput.value = selectedRequest.recipient;
    recipientIdInput.value = selectedRequest.employeeId || 'Not recorded for this request';
    if (audit.reference) audit.reference.textContent = browser.IMS!.nextRecordId('issuances', 'ISS-2026-', 20);
    if (audit.request) audit.request.textContent = selectedRequest.id;
    if (audit.recipient) audit.recipient.textContent = selectedRequest.employeeId
      ? `${selectedRequest.recipient} · ${selectedRequest.employeeId}`
      : selectedRequest.recipient;
    if (audit.office) audit.office.textContent = selectedRequest.office;
    if (audit.handler) audit.handler.textContent = browser.IMS!.currentUser.name;
    if (audit.date) audit.date.textContent = form.querySelector<HTMLInputElement>('#issueDate')!.value;
    if (resetQuantity || !quantityInput.value) {
      quantityInput.value = maximumIssue > 0 ? String(maximumIssue) : '';
    }
    quantityInput.max = String(maximumIssue);
    const quantity = Number(quantityInput.value) || 0;
    issueButton.disabled = quantity <= 0 || quantity > maximumIssue;
    if (header) {
      header.querySelector('span')!.textContent = 'Approved · Ready to issue';
      header.querySelector('h5')!.textContent = `${selectedRequest.id} — ${selectedItem.name}`;
      const details = header.querySelector('p');
      if (details) details.textContent = `${selectedRequest.documentType || 'RIS'} · Approved by ${selectedRequest.reviewedBy || 'Supply Office'} · ${selectedRequest.date} · Remaining ${remaining} ${selectedItem.unit}`;
    }

    const currentBalance = selectedItem.quantity;
    const issueQuantity = Number(quantityInput.value) || 0;
    const newBalance = currentBalance - issueQuantity;
    const currentItem = selectedItem;
    const values = [currentBalance, `−${issueQuantity}`, newBalance, currentItem.minimum];
    values.forEach((value, index) => {
      const output = balanceRows[index]?.querySelector('span:last-child');
      if (output) output.textContent = `${value} ${currentItem.unit}`;
    });
    if (stockStatus) {
      stockStatus.textContent = issueQuantity > 0 && issueQuantity <= currentBalance
        ? 'Sufficient stock'
        : 'Quantity exceeds available stock';
      stockStatus.classList.toggle('bg-green-50', issueQuantity > 0 && issueQuantity <= currentBalance);
      stockStatus.classList.toggle('text-green-700', issueQuantity > 0 && issueQuantity <= currentBalance);
      stockStatus.classList.toggle('bg-red-50', issueQuantity <= 0 || issueQuantity > currentBalance);
      stockStatus.classList.toggle('text-red-700', issueQuantity <= 0 || issueQuantity > currentBalance);
    }
  }

  function refreshRequests(): void {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - currentDate.getTimezoneOffset());
    form.querySelector<HTMLInputElement>('#issueDate')!.value = currentDate.toISOString().slice(0, 10);
    form.querySelector<HTMLInputElement>('#issueHandler')!.value = `${browser.IMS!.currentUser.name} — ${browser.IMS!.currentUser.title}`;
    const requestedId = new URLSearchParams(location.search).get('request');
    const requests = getLocalRecords('requests')
      .filter(request => request.status === 'Approved' && getLocalRecords('items').some(item => item.id === request.itemId));
    requestSelect.replaceChildren();
    requests.forEach(request => {
      const item = getLocalRecords('items').find(entry => entry.id === request.itemId);
      const option = document.createElement('option');
      option.value = request.id;
      option.textContent = `${request.id} · ${request.documentType || 'RIS'} · ${item!.name} · ${request.quantity}`;
      requestSelect.append(option);
    });
    if (!requests.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No approved requests available';
      requestSelect.append(option);
      showToast('There are no approved requests ready to issue.');
    } else {
      requestSelect.value = requests.some(request => request.id === requestedId)
        ? requestedId!
        : requests[0].id;
    }
    updatePreview(true);
  }

  function makeTextElement(
    tag: keyof HTMLElementTagNameMap,
    className: string,
    text: string | number | null | undefined
  ): HTMLElement {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text as string | null;
    return element;
  }

  function formatDocumentDate(value: string | undefined): string {
    if (!value) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  }

  function createPdfTextHelpers(
    page: PdfPage,
    font: PdfFont,
    rgb: PdfLibrary['rgb']
  ): {
    fitText: (value: unknown, x: number, y: number, width: number, size?: number, minSize?: number) => void;
    fitCellText: (value: unknown, left: number, right: number, y: number, size?: number) => void;
    drawLinedValue: (value: unknown, x: number, y: number, width: number, size?: number) => void;
  } {
    const ink = rgb(0, 0, 0);
    const fitText = (value: unknown, x: number, y: number, width: number, size = 8, minSize = 5): void => {
      let text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
      if (!text) return;
      let fontSize = size;
      while (fontSize > minSize && font.widthOfTextAtSize(text, fontSize) > width) {
        fontSize = Math.max(minSize, fontSize - 0.25);
      }
      if (font.widthOfTextAtSize(text, fontSize) > width) {
        const suffix = '...';
        while (text && font.widthOfTextAtSize(`${text}${suffix}`, fontSize) > width) {
          text = text.slice(0, -1);
        }
        text = `${text}${suffix}`;
      }
      page.drawText(text, { x, y, size: fontSize, font, color: ink });
    };
    const fitCellText = (value: unknown, left: number, right: number, y: number, size = 7): void => {
      const text = String(value ?? '').trim();
      if (!text) return;
      const width = right - left - 6;
      let fontSize = size;
      while (fontSize > 5 && font.widthOfTextAtSize(text, fontSize) > width) {
        fontSize = Math.max(5, fontSize - 0.25);
      }
      const textWidth = Math.min(font.widthOfTextAtSize(text, fontSize), width);
      fitText(text, left + 3 + (width - textWidth) / 2, y, width, fontSize);
    };
    const drawLinedValue = (value: unknown, x: number, y: number, width: number, size = 8): void => {
      if (!String(value ?? '').trim()) return;
      page.drawRectangle({
        x, y: y - 2, width, height: 13,
        color: rgb(1, 1, 1)
      });
      fitText(value, x + 2, y, width - 4, size);
    };
    return { fitText, fitCellText, drawLinedValue };
  }

  async function printRequisitionIssueSlip({
    request, item, quantity, requestedQuantity, issueDate, reference,
    requestedBy, approvedBy, supplyOfficeHead, remarks
  }: RequisitionPrintOptions): Promise<void> {
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      showToast('Allow pop-ups to open and print the Requisition and Issue Slip.');
      return;
    }

    printWindow.document.title = `CBSUA-Requisition-and-Issue-Slip-${reference}`;
    printWindow.document.body.textContent = 'Preparing the Requisition and Issue Slip...';
    let pdfUrl: string | undefined;
    try {
      if (window.location.protocol === 'file:') {
        throw new Error('Open this app through XAMPP/localhost so the supplied PDF can be read.');
      }
      if (!browser.PDFLib) {
        throw new Error('The PDF form library did not load. Run npm install and reload this page.');
      }

      const templateUrl = new URL('../Forms/Requisition_and_Issue_Slip.pdf', window.location.href);
      const response = await fetch(templateUrl);
      if (!response.ok) {
        throw new Error(`Could not load the supplied RIS form (HTTP ${response.status}).`);
      }

      const { PDFDocument, StandardFonts, rgb } = browser.PDFLib!;
      const pdfDocument = await PDFDocument.load(await response.arrayBuffer());
      const page = pdfDocument.getPages()[0];
      if (!page || pdfDocument.getPageCount() !== 1) {
        throw new Error('The supplied RIS form must contain exactly one page.');
      }

      const font = await pdfDocument.embedFont(StandardFonts.TimesRoman);
      const { fitText, fitCellText } = createPdfTextHelpers(page, font, rgb);

      page.drawRectangle({
        x: 98, y: 632, width: 300, height: 10,
        color: rgb(1, 1, 1)
      });
      page.drawRectangle({
        x: 449, y: 632, width: 112, height: 10,
        color: rgb(1, 1, 1)
      });
      fitText(request.office || '—', 101, 633.75, 290, 8, 6);
      fitText(reference, 452, 633.75, 105, 8, 5);

      const description = [item.name, item.description]
        .filter(Boolean)
        .join(' — ');
      const available = Number(item.quantity) >= requestedQuantity;
      const issuanceRemarks = remarks || '';
      const firstRowBaseline = 557.13;
      fitCellText(item.id, 28.8, 64.42, firstRowBaseline, 7.4);
      fitCellText(item.unit, 64.83, 95.83, firstRowBaseline, 7.4);
      fitText(description, 100, firstRowBaseline, 248, 8, 5);
      fitCellText(String(requestedQuantity), 352.9, 397.52, firstRowBaseline, 8);
      fitCellText(available ? 'X' : '', 397.93, 424.52, firstRowBaseline, 8);
      fitCellText(available ? '' : 'X', 424.93, 455.95, firstRowBaseline, 8);
      fitCellText(String(quantity), 456.55, 505.55, firstRowBaseline, 8);
      fitText(issuanceRemarks, 508, firstRowBaseline, 55, 7, 5);

      const purpose = String(request.remarks || '—').replace(/[\r\n\t]+/g, ' ').trim();
      const purposeSize = 8;
      const purposeLines = [];
      let currentLine = '';
      let purposeTruncated = false;
      for (const word of purpose.split(/\s+/)) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(nextLine, purposeSize) > 465 && currentLine) {
          if (purposeLines.length === 0) {
            purposeLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = `${currentLine}...`;
            purposeTruncated = true;
            break;
          }
        } else {
          currentLine = nextLine;
        }
      }
      if (currentLine) purposeLines.push(currentLine);
      if (purposeTruncated && purposeLines.length === 1) purposeLines[0] += '...';
      fitText(purposeLines[0] || '—', 108, 366.47, 461, purposeSize);
      if (purposeLines[1]) fitText(purposeLines[1], 108, 354.5, 461, purposeSize);

      const requestedDate = formatDocumentDate(request.date || request.createdAt);
      const approvedDate = formatDocumentDate(request.reviewedAt || issueDate);
      const issuedDate = formatDocumentDate(issueDate);
      const signatureNames: Array<[string, number, number, number]> = [
        [requestedBy, 109, 292.27, 180],
        [approvedBy, 337, 292.27, 181],
        [supplyOfficeHead.name!, 110, 209.45, 180],
        [requestedBy, 337, 209.45, 181]
      ];
      signatureNames.forEach(([name, x, y, width]) => fitText(name, x, y, width, 9, 4.5));
      fitText(requestedDate, 103, 265.05, 186, 8, 6);
      fitText(approvedDate, 330, 265.05, 187, 8, 6);
      fitText(issuedDate, 103, 173.65, 186, 8, 6);
      fitText(issuedDate, 330, 180.25, 187, 8, 6);
      if (request.classificationDetails?.fundCluster) {
        page.drawRectangle({
          x: 490, y: 644, width: 68, height: 12,
          color: rgb(1, 1, 1)
        });
        fitText(request.classificationDetails.fundCluster, 492, 647.75, 63, 8, 5);
      }

      const bytes = await pdfDocument.save();
      pdfUrl = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
      printWindow.location.href = pdfUrl;
      printWindow.addEventListener('load', () => {
        window.setTimeout(() => {
          if (printWindow.closed) return;
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            showToast(`The filled PDF is open, but printing could not start: ${(error as Error).message}`);
          }
        }, 800);
      }, { once: true });

      let closeMonitor: number | undefined;
      const cleanup = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        if (closeMonitor) window.clearInterval(closeMonitor);
      };
      closeMonitor = window.setInterval(() => {
        if (printWindow.closed) {
          cleanup();
        }
      }, 1000);
    } catch (error) {
      if (!printWindow.closed) printWindow.close();
      throw error;
    }
  }

  async function printInventoryTemplate({
    type, request, item, quantity, issueDate, reference,
    requestedBy, requestingAccount, supplyOfficeHead
  }: InventoryPrintOptions): Promise<void> {
    const templateNames: Record<'ICS' | 'PAR', string> = {
      ICS: 'ICS.pdf',
      PAR: 'PAR.pdf'
    };
    const templateName = templateNames[type];
    if (!templateName) throw new Error('The selected request has no supported inventory form.');

    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      showToast(`Allow pop-ups to open and print the ${type} form.`);
      return;
    }

    printWindow.document.title = `CBSUA-${type}-${reference}`;
    printWindow.document.body.textContent = `Preparing the ${type} form...`;
    try {
      if (window.location.protocol === 'file:') {
        throw new Error('Open this app through XAMPP/localhost so the supplied PDF can be read.');
      }
      if (!browser.PDFLib) {
        throw new Error('The PDF form library did not load. Run npm install and reload this page.');
      }

      const templateUrl = new URL(`../Forms/${templateName}`, window.location.href);
      const response = await fetch(templateUrl);
      if (!response.ok) {
        throw new Error(`Could not load the supplied ${type} form (HTTP ${response.status}).`);
      }

      const { PDFDocument, StandardFonts, rgb } = browser.PDFLib!;
      const pdfDocument = await PDFDocument.load(await response.arrayBuffer());
      const page = pdfDocument.getPages()[0];
      if (!page || pdfDocument.getPageCount() !== 1) {
        throw new Error(`The supplied ${type} form must contain exactly one page.`);
      }

      const font = await pdfDocument.embedFont(StandardFonts.TimesRoman);
      const { fitText, fitCellText, drawLinedValue } = createPdfTextHelpers(page, font, rgb);
      const details = request.classificationDetails || {};
      const formattedDate = (value: string | undefined): string => value ? formatDocumentDate(value) : '';

      if (type === 'ICS') {
        const unitCostValue = details.unitCost ?? item.unitCost;
        const parsedUnitCost = unitCostValue === undefined ? null : Number(unitCostValue);
        const unitCost = parsedUnitCost !== null && Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0 ? parsedUnitCost : null;
        const totalCost = unitCost === null ? null : unitCost * quantity;
        const usefulLife = details.estimatedUsefulLifeYears ?? details.usefulLifeYears;
        const description = [item.name, item.description].filter(Boolean).join(' — ');
        const supplier = details.supplier || item.supplier || '';

        page.drawRectangle({ x: 443, y: 686, width: 103, height: 15, color: rgb(1, 1, 1) });
        fitText(reference, 446, 691.17, 96, 8, 5);
        fitCellText(String(quantity), 51.23, 87.63, 628, 7);
        fitCellText(item.unit, 88.22, 121.64, 628, 7);
        fitCellText(unitCost === null ? '' : unitCost.toFixed(2), 122.25, 175.45, 628, 7);
        fitCellText(totalCost === null ? '' : totalCost.toFixed(2), 176.05, 229.47, 628, 7);
        fitText(description, 232, 628, 174, 7, 5);
        fitCellText(item.id, 411.33, 478.95, 628, 7);
        fitCellText(usefulLife === null || usefulLife === undefined ? '' : `${usefulLife} years`, 479.35, 544.18, 628, 7);

        fitText(supplier, 280, 379.1, 264, 8, 5);
        fitText(formattedDate(details.deliveryReceiptDate), 280, 351.47, 264, 8, 5);
        fitText(details.purchaseOrderNumber, 280, 323.88, 264, 8, 5);
        fitText(formattedDate(details.purchaseOrderDate), 280, 296.28, 264, 8, 5);
        fitText(details.iarNumber, 280, 268.65, 264, 8, 5);
        fitText(formattedDate(details.iarDate), 280, 241.05, 264, 8, 5);

        const requesterPosition = [requestingAccount?.title, request.office].filter(Boolean).join(' / ');
        drawLinedValue(requestedBy, 58.62, 168.65, 235, 8);
        drawLinedValue(requesterPosition, 58.62, 131.83, 235, 8);
        drawLinedValue(formattedDate(issueDate), 95.42, 95.03, 203, 8);
        drawLinedValue(supplyOfficeHead.name, 305.3, 168.65, 238, 8);
        drawLinedValue(supplyOfficeHead.title || 'Supply Office', 305.3, 131.83, 238, 8);
        drawLinedValue(formattedDate(issueDate), 342.1, 95.03, 202, 8);
      } else {
        const amountValue = details.amount ?? details.estimatedAmount;
        const parsedAmount = amountValue === undefined || amountValue === null
          ? null
          : Number(amountValue);
        const unitCostValue = details.estimatedUnitCost ?? item.unitCost;
        const parsedUnitCost = unitCostValue === undefined || unitCostValue === null
          ? null
          : Number(unitCostValue);
        const amount = parsedAmount !== null && Number.isFinite(parsedAmount) && parsedAmount >= 0
          ? parsedAmount
          : parsedUnitCost !== null && Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0
            ? parsedUnitCost * quantity
            : null;
        const description = [item.name, details.specifications || item.description]
          .filter(Boolean)
          .join(' — ');
        const supplier = details.supplier || item.supplier || '';

        page.drawRectangle({ x: 460, y: 685, width: 98, height: 15, color: rgb(1, 1, 1) });
        fitText(reference, 463, 690.78, 91, 8, 5);
        fitCellText(String(quantity), 33.6, 88.22, 644, 7);
        fitCellText(item.unit, 88.62, 139.24, 644, 7);
        fitText(description, 142, 644, 235, 7, 5);
        fitCellText(details.propertyNumber || item.propertyNumber, 380.33, 445.55, 644, 7);
        fitCellText(formattedDate(details.dateAcquired || item.dateAcquired), 445.95, 505.15, 644, 7);
        fitCellText(amount === null ? '' : amount.toFixed(2), 505.55, 561.78, 644, 7);
        drawLinedValue(supplier, 81.62, 351.67, 477, 8);

        const requesterPosition = [requestingAccount?.title, request.office].filter(Boolean).join(' / ');
        drawLinedValue(requestedBy, 58.62, 283.27, 235, 8);
        drawLinedValue(requesterPosition, 58.62, 246.45, 235, 8);
        drawLinedValue(formattedDate(issueDate), 95.42, 209.65, 203, 8);
        drawLinedValue(supplyOfficeHead.name, 305.3, 283.27, 238, 8);
        drawLinedValue(supplyOfficeHead.title || 'Supply Office', 305.3, 246.45, 238, 8);
        drawLinedValue(formattedDate(issueDate), 342.1, 209.65, 202, 8);
      }

      const bytes = await pdfDocument.save();
      const pdfUrl = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
      printWindow.location.href = pdfUrl;
      printWindow.addEventListener('load', () => {
        window.setTimeout(() => {
          if (printWindow.closed) return;
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            showToast(`The filled ${type} form is open, but printing could not start: ${(error as Error).message}`);
          }
        }, 800);
      }, { once: true });

      const closeMonitor = window.setInterval(() => {
        if (printWindow.closed) {
          URL.revokeObjectURL(pdfUrl);
          window.clearInterval(closeMonitor);
        }
      }, 1000);
    } catch (error) {
      if (!printWindow.closed) printWindow.close();
      throw error;
    }
  }

  async function printSupplyDocument(type: string | undefined): Promise<void> {
    if (type !== 'receipt' && type !== 'form' && type !== 'ris') {
      showToast('This document type cannot be printed.');
      return;
    }

    let request: RequestRecord | null | undefined = null;
    let item: InventoryItem | null | undefined = null;
    let issuance: IssuanceRecord | null = null;
    let quantity = 0;
    let issueDate = '';
    let reference = '';
    let requestingAccount: PublicProfile | null = null;
    let requestedBy = '';
    let approvedBy = '';
    let supplyOfficeHead: PublicProfile | null = null;
    if (type === 'receipt') {
      issuance = lastIssuance;
      request = issuance && getLocalRecords('requests').find(entry => entry.id === issuance!.requestId);
      item = issuance && getLocalRecords('items').find(entry => entry.id === issuance!.itemId);
      if (!issuance || !request || !item) {
        showToast('Record an issuance before exporting a receipt.');
        return;
      }
      quantity = issuance.quantity;
      issueDate = issuance.date;
      reference = issuance.id;
    } else {
      request = selectedRequest;
      item = selectedItem;
      quantity = Number(quantityInput.value);
      const remaining = request ? getRemainingRequestQuantity(request) : 0;
      if (!request || request.status !== 'Approved' || !item) {
        showToast('Select an approved request before printing the Requisition and Issue Slip.');
        return;
      }
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > remaining || quantity > item.quantity) {
        showToast('Enter a valid issue quantity before printing the Requisition and Issue Slip.');
        return;
      }
      const requesterById = request.requesterId
        ? browser.IMS!.accounts.findAccountById(request.requesterId)
        : null;
      requestingAccount = requesterById?.role === 'end-user'
        ? requesterById
        : browser.IMS!.accounts.findEndUserByName(request.recipient, request.office);
      requestedBy = requestingAccount?.name || request.recipient || requesterById?.name || '—';
      const requesterIsOfficeHead = requestingAccount?.title && /\bhead\b/i.test(requestingAccount.title);
      approvedBy = requesterIsOfficeHead
        ? requestedBy
        : 'Atty. Engr. Arch. Emerson P. Elopre';
      supplyOfficeHead = browser.IMS!.accounts.getSupplyOfficeHead();
      if (!supplyOfficeHead?.name) {
        showToast('The Head of Supply Office account is not configured.');
        return;
      }
      issueDate = form.querySelector<HTMLInputElement>('#issueDate')!.value;
      reference = request.id;
    }

    if (type === 'form' || type === 'ris') {
      const documentType = type === 'ris' ? 'RIS' : request!.documentType || 'RIS';
      if (!officialFormNames[documentType]) {
        showToast('This request has an unsupported official form type.');
        return;
      }
      const requestedQuantity = Number.parseFloat(String(request!.quantity));
      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        showToast('The approved request does not contain a valid requested quantity.');
        return;
      }
      if (documentType === 'RIS') {
        await printRequisitionIssueSlip({
          request: request!,
          item: item!,
          quantity,
          requestedQuantity,
          issueDate,
          reference,
          requestedBy,
          approvedBy,
          supplyOfficeHead: supplyOfficeHead!,
          remarks: form.querySelector('textarea')?.value.trim() || ''
        });
      } else {
        await printInventoryTemplate({
          type: documentType as 'ICS' | 'PAR',
          request: request!,
          item: item!,
          quantity,
          issueDate,
          reference,
          requestedBy,
          requestingAccount,
          supplyOfficeHead: supplyOfficeHead!
        });
      }
      return;
    }

    const title = 'SUPPLY ISSUANCE RECEIPT';
    printDocument.replaceChildren();
    printDocument.classList.remove('ims-print-ris-document');
    const masthead = document.createElement('header');
    masthead.className = 'ims-print-masthead';
    const logo = document.createElement('img');
    logo.src = '../Image/logo.png';
    logo.alt = 'CBSUA';
    const school = document.createElement('div');
    school.append(
      makeTextElement('p', 'ims-print-university', 'Central Bicol State University of Agriculture'),
      makeTextElement('p', '', 'Sipocot Campus'),
      makeTextElement('p', 'ims-print-office', 'SUPPLY OFFICE')
    );
    masthead.append(logo, school);
    printDocument.append(masthead, makeTextElement('h1', 'ims-print-title', title));

    const metadata = document.createElement('dl');
    metadata.className = 'ims-print-metadata';
    const metadataRows: Array<[string, string | number | undefined]> = [
      ['Document reference', reference],
      ['Issuance reference', issuance!.id],
      ['Request reference', request!.id],
      ['Date', formatDocumentDate(issueDate)],
      ['Requesting office', request!.office],
      ['Recipient', request!.recipient],
      ['Employee ID', request!.employeeId || issuance!.recipientEmployeeId || '—'],
      ['Approved by', request!.reviewedBy || 'Supply Office'],
      ['Released by', issuance!.handledBy || form.querySelector<HTMLInputElement>('#issueHandler')!.value]
    ];
    metadataRows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ims-print-metadata-row';
      row.append(makeTextElement('dt', '', label), makeTextElement('dd', '', value));
      metadata.append(row);
    });
    printDocument.append(metadata);

    const table = document.createElement('table');
    table.className = 'ims-print-items';
    const head = document.createElement('thead');
    const body = document.createElement('tbody');
    const headingRow = document.createElement('tr');
    ['Item code', 'Description', 'Quantity', 'Unit'].forEach(label =>
      headingRow.append(makeTextElement('th', '', label)));
    head.append(headingRow);
    const itemRow = document.createElement('tr');
    [
      item!.id,
      `${item!.name}${item!.description ? ` — ${item!.description}` : ''}`,
      String(quantity),
      item!.unit
    ].forEach(value => itemRow.append(makeTextElement('td', '', value)));
    body.append(itemRow);
    table.append(head, body);
    printDocument.append(table);
    printDocument.append(makeTextElement(
      'p',
      'ims-print-note',
      'This document confirms the supply issuance recorded by the CBSUA Supply Office.'
    ));

    const signatures = document.createElement('section');
    signatures.className = 'ims-print-signatures';
    const signatories: Array<[string, string | undefined, string]> = [
      ['Received by', request!.recipient, 'Signature / Date'],
      ['Released by', issuance!.handledBy || form.querySelector<HTMLInputElement>('#issueHandler')!.value, 'Signature / Date'],
      ['Approved by', request!.reviewedBy || 'Supply Office', 'Signature / Date']
    ];
    signatories.forEach(([label, name, caption]) => {
      const block = document.createElement('div');
      block.className = 'ims-print-signature';
      block.append(
        makeTextElement('p', 'ims-print-signature-label', label),
        makeTextElement('p', 'ims-print-signature-name', name),
        makeTextElement('p', 'ims-print-signature-caption', caption)
      );
      signatures.append(block);
    });
    printDocument.append(signatures);

    const originalTitle = document.title;
    document.title = `CBSUA-Receipt-${reference}`;
    printDocument.hidden = false;
    window.addEventListener('afterprint', () => {
      printDocument.hidden = true;
      document.title = originalTitle;
    }, { once: true });
    window.print();
  }

  document.querySelectorAll<HTMLButtonElement>('[data-issue-document]').forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.issueDocument;
      printSupplyDocument(type).catch(error => {
        console.error('Could not generate the requested print document.', error);
        const documentType = selectedRequest?.documentType || 'RIS';
        const documentName = type === 'receipt'
          ? 'receipt'
          : officialFormNames[documentType] || 'official form';
        showToast(`Could not create the ${documentName}: ${(error as Error).message}`);
      });
    });
  });
  window.addEventListener('ims:issuance-saved', event => {
    lastIssuance = (event as CustomEvent<IssuanceRecord>).detail;
    if (receiptButton) receiptButton.disabled = !lastIssuance;
  });
  requestSelect.addEventListener('change', () => updatePreview(true));
  quantityInput.addEventListener('input', () => updatePreview());
  window.addEventListener('ims:records-updated', refreshRequests);
  refreshRequests();
});
})();
