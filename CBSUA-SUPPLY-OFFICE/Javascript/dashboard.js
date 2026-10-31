document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stockChart');
  const chartDescription = canvas.closest('.stat-card')?.querySelector('p.text-xs');
  const fallback = { labels: ['10 Oct', '12 Oct', '14 Oct', '16 Oct'], received: [2, 5, 3, 12], issued: [4, 3, 10, 18] };

  function getMovementData() {
    let records = {};
    try {
      const savedRecords = JSON.parse(localStorage.getItem('cbsuaSupplyRecords') || '{}');
      if (savedRecords && typeof savedRecords === 'object') records = savedRecords;
    } catch (error) {
      console.error('Saved stock movements could not be read.', error);
    }
    const receipts = Array.isArray(records.receipts) ? records.receipts : [];
    const issuances = Array.isArray(records.issuances) ? records.issuances : [];
    if (!receipts.length && !issuances.length) return fallback;

    const today = new Date();
    const days = Array.from({ length: 4 }, (_, index) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3 + index));
    const keyFor = date => {
      const [year, month, day] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const totals = Object.fromEntries(days.map(date => [keyFor(date), { received: 0, issued: 0 }]));
    const addTotals = (entries, type, dateField) => entries.forEach(entry => {
      const value = entry[dateField] || entry.createdAt;
      const dateKey = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? value.slice(0, 10)
        : keyFor(new Date(value));
      if (totals[dateKey]) totals[dateKey][type]++;
    });
    addTotals(receipts, 'received', 'receivedDate');
    addTotals(issuances, 'issued', 'date');
    const labels = days.map(date => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date));
    if (chartDescription) {
      const dateRange = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
      chartDescription.textContent = `Transaction counts · ${dateRange.format(days[0])}–${dateRange.format(days[3])}`;
    }
    return {
      labels,
      received: days.map(date => totals[keyFor(date)].received),
      issued: days.map(date => totals[keyFor(date)].issued),
      totalReceived: receipts.length,
      totalIssued: issuances.length
    };
  }

  const initialData = getMovementData();
  const stockChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: initialData.labels,
      datasets: [
        { label: 'Received', data: initialData.received, backgroundColor: '#166534', borderRadius: 4 },
        { label: 'Issued', data: initialData.issued, backgroundColor: '#90EE90', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { display: false } },
        x: { grid: { display: false } }
      }
    }
  });

  function updateMovementTotals(data) {
    const totals = canvas.closest('.stat-card')?.querySelectorAll('.flex.gap-4.mb-4 strong');
    if (totals && data.totalReceived !== undefined) {
      totals[0].textContent = String(data.totalReceived);
      totals[1].textContent = String(data.totalIssued);
    }
  }

  updateMovementTotals(initialData);
  window.addEventListener('storage', event => {
    if (event.key && event.key !== 'cbsuaSupplyRecords') return;
    const updated = getMovementData();
    stockChart.data.labels = updated.labels;
    stockChart.data.datasets[0].data = updated.received;
    stockChart.data.datasets[1].data = updated.issued;
    updateMovementTotals(updated);
    stockChart.update();
  });
});
