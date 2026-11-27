export function getIssuedAssetQrRecords(getLocalRecords) {
  const requests = new Map(getLocalRecords('requests').map(request => [request.id, request]));
  const items = new Map(getLocalRecords('items').map(item => [item.id, item]));
  return getLocalRecords('issuances').map(issuance => {
    const request = requests.get(issuance.requestId);
    const item = items.get(issuance.itemId);
    const documentType = String(request?.documentType || '').toUpperCase();
    if (!request || !item || !['ICS', 'PAR'].includes(documentType)) return null;
    const classification = String(request.supplyClassification || '').trim().toLowerCase().replace(/\s+/g, '-');
    if ((documentType === 'ICS' && classification !== 'semi-expendable')
      || (documentType === 'PAR' && classification !== 'fixed-asset')) return null;

    const details = request.classificationDetails || {};
    return {
      documentType,
      classification: request.supplyClassification || (documentType === 'ICS' ? 'Semi-Expendable' : 'Fixed Asset'),
      itemCode: item.id,
      itemName: item.name,
      holderName: request.recipient || issuance.recipient || '',
      holderEmployeeId: request.employeeId || issuance.recipientEmployeeId || '',
      office: request.office || '',
      description: item.description || '',
      specifications: details.specifications || '',
      quantity: issuance.quantity,
      unit: item.unit || '',
      propertyNumber: details.propertyNumber || item.propertyNumber || '',
      estimatedUsefulLifeYears: details.estimatedUsefulLifeYears ?? details.usefulLifeYears ?? '',
      dateAcquired: details.dateAcquired || item.dateAcquired || '',
      amount: details.amount ?? '',
      unitCost: details.unitCost ?? details.estimatedUnitCost ?? '',
      supplier: details.supplier || item.supplier || '',
      deliveryReceiptDate: details.deliveryReceiptDate || '',
      purchaseOrderNumber: details.purchaseOrderNumber || '',
      purchaseOrderDate: details.purchaseOrderDate || '',
      iarNumber: details.iarNumber || '',
      iarDate: details.iarDate || '',
      fundCluster: details.fundCluster || '',
      issuedOn: issuance.date || request.date || '',
      issuanceReference: issuance.id
    };
  }).filter(Boolean);
}
