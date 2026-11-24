window.IMS.pageFeatures.push(() => {
  const { getLocalRecords, getRemainingRequestQuantity, showToast } = window.IMS;
  const form = document.getElementById('issueForm');
  if (!form) return;

  const requestSelect = form.querySelector('#issueRequest');
  const quantityInput = form.querySelector('#issueQuantity');
  const itemInput = form.querySelector('#issueItem');
  const itemIdInput = form.querySelector('#issueItemId');
  const requestedInput = form.querySelector('#issueRequested');
  const officeInput = form.querySelector('#issueOffice');
  const recipientInput = form.querySelector('#issueRecipient');
  const recipientIdInput = form.querySelector('#issueRecipientId');
  const issueButton = form.querySelector('button[type="submit"]');
  const balanceCard = [...document.querySelectorAll('.stat-card')]
    .find(card => card.querySelector('h5')?.textContent.trim() === 'Stock after issuance');
  const balanceRows = [...(balanceCard?.querySelectorAll('.flex.justify-between') || [])];
  const stockStatus = balanceCard?.querySelector('.bg-green-50');
  const audit = {
    reference: document.getElementById('issueReference'),
    request: document.getElementById('issueAuditRequest'),
    recipient: document.getElementById('issueAuditRecipient'),
    office: document.getElementById('issueAuditOffice'),
    handler: document.getElementById('issueAuditHandler'),
    date: document.getElementById('issueAuditDate')
  };
  const receiptButton = document.querySelector('[data-issue-document="receipt"]');
  const header = document.querySelector('main .border-2');
  let selectedItem = null;
  let selectedRequest = null;
  let lastIssuance = [...getLocalRecords('issuances')]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;
  const printDocument = document.createElement('article');
  printDocument.id = 'imsPrintDocument';
  printDocument.className = 'ims-print-document';
  printDocument.hidden = true;
  document.body.append(printDocument);
  if (receiptButton) receiptButton.disabled = !lastIssuance;
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.querySelector('#issueDate').value = today.toISOString().slice(0, 10);
  form.querySelector('#issueHandler').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;

  function updatePreview(resetQuantity = false) {
    selectedRequest = getLocalRecords('requests').find(request => request.id === requestSelect.value);
    selectedItem = selectedRequest && getLocalRecords('items').find(item => item.id === selectedRequest.itemId);
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
        header.querySelector('span').textContent = 'No approved requests';
        header.querySelector('h5').textContent = 'No approved request selected';
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
    if (audit.reference) audit.reference.textContent = window.IMS.nextRecordId('issuances', 'ISS-2026-', 20);
    if (audit.request) audit.request.textContent = selectedRequest.id;
    if (audit.recipient) audit.recipient.textContent = selectedRequest.employeeId
      ? `${selectedRequest.recipient} · ${selectedRequest.employeeId}`
      : selectedRequest.recipient;
    if (audit.office) audit.office.textContent = selectedRequest.office;
    if (audit.handler) audit.handler.textContent = window.IMS.currentUser.name;
    if (audit.date) audit.date.textContent = form.querySelector('#issueDate').value;
    if (resetQuantity || !quantityInput.value) {
      quantityInput.value = maximumIssue > 0 ? String(maximumIssue) : '';
    }
    quantityInput.max = String(maximumIssue);
    const quantity = Number(quantityInput.value) || 0;
    issueButton.disabled = quantity <= 0 || quantity > maximumIssue;
    if (header) {
      header.querySelector('span').textContent = 'Approved · Ready to issue';
      header.querySelector('h5').textContent = `${selectedRequest.id} — ${selectedItem.name}`;
      const details = header.querySelector('p');
      if (details) details.textContent = `Approved by ${selectedRequest.reviewedBy || 'Supply Office'} · ${selectedRequest.date} · Remaining ${remaining} ${selectedItem.unit}`;
    }

    const currentBalance = selectedItem.quantity;
    const issueQuantity = Number(quantityInput.value) || 0;
    const newBalance = currentBalance - issueQuantity;
    const values = [currentBalance, `−${issueQuantity}`, newBalance, selectedItem.minimum];
    values.forEach((value, index) => {
      const output = balanceRows[index]?.querySelector('span:last-child');
      if (output) output.textContent = `${value} ${selectedItem.unit}`;
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

  function refreshRequests() {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - currentDate.getTimezoneOffset());
    form.querySelector('#issueDate').value = currentDate.toISOString().slice(0, 10);
    form.querySelector('#issueHandler').value = `${window.IMS.currentUser.name} — ${window.IMS.currentUser.title}`;
    const requestedId = new URLSearchParams(location.search).get('request');
    const requests = getLocalRecords('requests')
      .filter(request => request.status === 'Approved' && getLocalRecords('items').some(item => item.id === request.itemId));
    requestSelect.replaceChildren();
    requests.forEach(request => {
      const item = getLocalRecords('items').find(entry => entry.id === request.itemId);
      const option = document.createElement('option');
      option.value = request.id;
      option.textContent = `${request.id} · ${item.name} · ${request.quantity}`;
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
        ? requestedId
        : requests[0].id;
    }
    updatePreview(true);
  }

  function makeTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function printSupplyDocument(type) {
    let request;
    let item;
    let issuance = null;
    let quantity;
    let issueDate;
    let reference;
    let requestingAccount = null;
    let requestedBy = '';
    let approvedBy = '';
    let approvedByTitle = '';
    let supplyOfficeHead = null;
    if (type === 'receipt') {
      issuance = lastIssuance;
      request = issuance && getLocalRecords('requests').find(entry => entry.id === issuance.requestId);
      item = issuance && getLocalRecords('items').find(entry => entry.id === issuance.itemId);
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
      const remaining = request && getRemainingRequestQuantity(request);
      if (!request || request.status !== 'Approved' || !item) {
        showToast('Select an approved request before printing the Requisition and Issue Slip.');
        return;
      }
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > remaining || quantity > item.quantity) {
        showToast('Enter a valid issue quantity before printing the Requisition and Issue Slip.');
        return;
      }
      const requesterById = request.requesterId
        ? window.IMS.accounts.findAccountById(request.requesterId)
        : null;
      requestingAccount = requesterById?.role === 'end-user'
        ? requesterById
        : window.IMS.accounts.findEndUserByName(request.recipient, request.office);
      requestedBy = requestingAccount?.name || request.recipient || requesterById?.name || '—';
      const requesterIsOfficeHead = requestingAccount?.title && /\bhead\b/i.test(requestingAccount.title);
      approvedBy = requesterIsOfficeHead
        ? requestedBy
        : 'Atty. Engr. Arch. Emerson P. Elopre, JD, MIT, MSM, RN, RMP, RME, LPT Jr.';
      approvedByTitle = requesterIsOfficeHead ? requestingAccount.title : 'Head of Office';
      supplyOfficeHead = window.IMS.accounts.getSupplyOfficeHead();
      if (!supplyOfficeHead?.name) {
        showToast('The Head of Supply Office account is not configured.');
        return;
      }
      issueDate = form.querySelector('#issueDate').value;
      reference = request.id;
    }

    const title = type === 'receipt' ? 'SUPPLY ISSUANCE RECEIPT' : 'REQUISITION AND ISSUE SLIP (RIS)';
    const dateText = value => {
      if (!value) return '—';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00`)
        : new Date(value);
      return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    };
    printDocument.replaceChildren();
    printDocument.classList.toggle('ims-print-ris-document', type !== 'receipt');
    const masthead = document.createElement('header');
    masthead.className = 'ims-print-masthead';
    const logo = document.createElement('img');
    logo.src = '../Image/logo.png';
    logo.alt = 'CBSUA';
    if (type === 'receipt') {
      const school = document.createElement('div');
      school.append(
        makeTextElement('p', 'ims-print-university', 'Central Bicol State University of Agriculture'),
        makeTextElement('p', '', 'Sipocot Campus'),
        makeTextElement('p', 'ims-print-office', 'SUPPLY OFFICE')
      );
      masthead.append(logo, school);
      printDocument.append(masthead, makeTextElement('h1', 'ims-print-title', title));
    } else {
      masthead.classList.add('ims-print-ris-masthead');
      logo.className = 'ims-print-ris-seal';
      const bagongPilipinasLogo = document.createElement('img');
      bagongPilipinasLogo.src = '../Image/ris-bagong-pilipinas.jpg';
      bagongPilipinasLogo.alt = 'Bagong Pilipinas';
      bagongPilipinasLogo.className = 'ims-print-ris-bagong-logo';
      const certificationLogo = document.createElement('img');
      certificationLogo.src = '../Image/ris-certification.jpg';
      certificationLogo.alt = 'TUV Rheinland ISO certification';
      certificationLogo.className = 'ims-print-ris-certification-logo';
      const school = document.createElement('div');
      school.className = 'ims-print-ris-school';
      school.append(
        makeTextElement('p', '', 'Republic of the Philippines'),
        makeTextElement('p', 'ims-print-university', 'CENTRAL BICOL STATE UNIVERSITY OF AGRICULTURE'),
        makeTextElement('p', '', 'Impig, Sipocot, Camarines Sur 4408'),
        makeTextElement('p', '', 'Website: www.cbsua.edu.ph'),
        makeTextElement('p', '', 'Email Address: cbsua.sipocot@cbsua.edu.ph'),
        makeTextElement('p', '', 'Trunkline: (054) 881-6681')
      );
      masthead.append(logo, bagongPilipinasLogo, school, certificationLogo);
      printDocument.append(
        masthead,
        makeTextElement('h1', 'ims-print-title ims-print-ris-title', 'REQUISITION AND ISSUE SLIP'),
        makeTextElement('p', 'ims-print-ris-subtitle', '(RIS)')
      );
    }

    const metadata = document.createElement('dl');
    metadata.className = type === 'receipt'
      ? 'ims-print-metadata'
      : 'ims-print-metadata ims-print-ris-metadata';
    const metadataFields = type === 'receipt'
      ? [
        ['Document reference', reference],
        ['Issuance reference', issuance.id],
        ['Request reference', request.id],
        ['Date', dateText(issueDate)],
        ['Requesting office', request.office],
        ['Recipient', request.recipient],
        ['Employee ID', request.employeeId || issuance.recipientEmployeeId || '—'],
        ['Approved by', request.reviewedBy || 'Supply Office'],
        ['Released by', issuance.handledBy || form.querySelector('#issueHandler').value]
      ]
      : [
        ['Entity/Name', 'CENTRAL BICOL STATE UNIVERSITY OF AGRICULTURE-SIPOCOT'],
        ['Fund Cluster', '____________'],
        ['Office', request.office || '—'],
        ['RIS No.', reference]
      ];
    metadataFields.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ims-print-metadata-row';
      row.append(makeTextElement('dt', '', label), makeTextElement('dd', '', value));
      metadata.append(row);
    });
    printDocument.append(metadata);

    const table = document.createElement('table');
    table.className = type === 'receipt' ? 'ims-print-items' : 'ims-print-items ims-print-ris-table';
    const head = document.createElement('thead');
    const body = document.createElement('tbody');
    if (type === 'receipt') {
      const headingRow = document.createElement('tr');
      ['Item code', 'Description', 'Quantity', 'Unit'].forEach(label =>
        headingRow.append(makeTextElement('th', '', label)));
      head.append(headingRow);
      const itemRow = document.createElement('tr');
      [
        item.id,
        `${item.name}${item.description ? ` — ${item.description}` : ''}`,
        String(quantity),
        item.unit
      ].forEach(value => itemRow.append(makeTextElement('td', '', value)));
      body.append(itemRow);
    } else {
      const groupRow = document.createElement('tr');
      const stockNumber = makeTextElement('th', '', 'Stock No.');
      stockNumber.rowSpan = 2;
      const unit = makeTextElement('th', '', 'Unit');
      unit.rowSpan = 2;
      const requisition = makeTextElement('th', '', 'Requisition');
      requisition.colSpan = 2;
      const availability = makeTextElement('th', '', 'Stock Available?');
      availability.colSpan = 2;
      const issuanceHeading = makeTextElement('th', '', 'Issuance');
      issuanceHeading.colSpan = 2;
      groupRow.append(stockNumber, unit, requisition, availability, issuanceHeading);
      const detailRow = document.createElement('tr');
      ['Particulars / Description', 'Quantity', 'Yes', 'No', 'Quantity', 'Remarks']
        .forEach(label => detailRow.append(makeTextElement('th', '', label)));
      head.append(groupRow, detailRow);

      const requestedQuantity = Number.parseFloat(String(request.quantity));
      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        showToast('The approved request does not contain a valid requested quantity.');
        return;
      }
      const columns = document.createElement('colgroup');
      ['9%', '7%', '41%', '8%', '4%', '4%', '10%', '17%'].forEach(width => {
        const column = document.createElement('col');
        column.style.width = width;
        columns.append(column);
      });
      table.append(columns);
      for (let rowNumber = 1; rowNumber <= 10; rowNumber += 1) {
        const itemRow = document.createElement('tr');
        const values = rowNumber === 1
          ? [
            String(rowNumber),
            item.unit,
            `${item.id} — ${item.name}${item.description ? ` — ${item.description}` : ''}`,
            String(requestedQuantity),
            item.quantity >= requestedQuantity ? 'X' : '',
            item.quantity < requestedQuantity ? 'X' : '',
            String(quantity),
            form.querySelector('textarea')?.value.trim() || ''
          ]
          : [rowNumber <= 5 ? String(rowNumber) : '', '', '', '', '', '', '', ''];
        values.forEach(value => itemRow.append(makeTextElement('td', '', value)));
        body.append(itemRow);
      }
    }
    table.append(head, body);
    printDocument.append(table);
    if (type === 'receipt') {
      printDocument.append(makeTextElement(
        'p',
        'ims-print-note',
        'This document confirms the supply issuance recorded by the CBSUA Supply Office.'
      ));
    } else {
      const purpose = document.createElement('p');
      purpose.className = 'ims-print-purpose';
      purpose.append(
        makeTextElement('span', 'ims-print-purpose-label', 'Purpose:'),
        document.createTextNode(` ${request.remarks || '—'}`)
      );
      printDocument.append(purpose);
    }

    const signatures = document.createElement('section');
    signatures.className = type === 'receipt'
      ? 'ims-print-signatures'
      : 'ims-print-signatures ims-print-signatures-ris ims-print-ris-signatures';
    const signatories = type === 'receipt'
      ? [
        ['Received by', request.recipient, 'Signature / Date'],
        ['Released by', issuance.handledBy || form.querySelector('#issueHandler').value, 'Signature / Date'],
        ['Approved by', request.reviewedBy || 'Supply Office', 'Signature / Date']
      ]
      : [
        ['Requested By', requestedBy, dateText(request.date || request.createdAt), ''],
        ['Approved By', approvedBy, dateText(request.reviewedAt || issueDate), approvedByTitle],
        ['Issued By', supplyOfficeHead.name, dateText(issueDate), supplyOfficeHead.title || 'Supply Officer'],
        ['Received By', requestedBy, dateText(issueDate), '']
      ];
    signatories.forEach(([label, name, caption, designation]) => {
      const block = document.createElement('div');
      block.className = type === 'receipt'
        ? 'ims-print-signature'
        : 'ims-print-signature ims-print-ris-signature';
      if (type === 'receipt') {
        block.append(
          makeTextElement('p', 'ims-print-signature-label', label),
          makeTextElement('p', 'ims-print-signature-name', name),
          makeTextElement('p', 'ims-print-signature-caption', caption)
        );
      } else {
        block.append(
          makeTextElement('p', 'ims-print-signature-label', label),
          makeTextElement('p', 'ims-print-signature-name', `Name: ${name}`),
          ...(designation ? [makeTextElement('p', 'ims-print-signature-caption', designation)] : []),
          makeTextElement('p', 'ims-print-signature-date', `Date: ${caption}`)
        );
      }
      signatures.append(block);
    });
    printDocument.append(signatures);
    if (type !== 'receipt') {
      printDocument.append(makeTextElement('p', 'ims-print-page-number', 'Page 1 of 1'));
    }

    const originalTitle = document.title;
    document.title = `CBSUA-${type === 'receipt' ? 'Receipt' : 'Requisition-and-Issue-Slip'}-${reference}`;
    printDocument.hidden = false;
    window.addEventListener('afterprint', () => {
      printDocument.hidden = true;
      document.title = originalTitle;
    }, { once: true });
    window.print();
  }

  document.querySelectorAll('[data-issue-document]').forEach(button => {
    button.addEventListener('click', () => printSupplyDocument(button.dataset.issueDocument));
  });
  window.addEventListener('ims:issuance-saved', event => {
    lastIssuance = event.detail;
    if (receiptButton) receiptButton.disabled = !lastIssuance;
  });
  requestSelect.addEventListener('change', () => updatePreview(true));
  quantityInput.addEventListener('input', () => updatePreview());
  window.addEventListener('ims:records-updated', refreshRequests);
  refreshRequests();
});
