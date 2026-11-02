(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const rangeSelect = $('#date-preset');
  if (!rangeSelect) return;

  const customRange = $('#custom-range');
  const fromInput = $('#date-from');
  const toInput = $('#date-to');
  const errorBox = $('#analytics-error');
  const charts = new Map();
  const chartColors = ['#04301f', '#0c6945', '#55a879', '#f2b632', '#87b795', '#d0901b', '#a8cfb4', '#537b62'];
  const numberFormat = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 1 });
  const moneyFormat = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });
  const chartTheme = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue('--admin-muted').trim() || '#718078',
      axis: styles.getPropertyValue('--admin-axis').trim() || '#52635a',
      grid: styles.getPropertyValue('--admin-grid').trim() || 'rgba(80, 110, 90, .10)',
      surface: styles.getPropertyValue('--admin-surface').trim() || '#fff',
    };
  };
  const today = new Date();
  const localISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const shiftDate = (date, amount) => { const shifted = new Date(date); shifted.setDate(shifted.getDate() + amount); return shifted; };

  function getRange() {
    const now = new Date();
    const todayDate = localISO(now);
    if (rangeSelect.value === 'custom') return { from: fromInput.value, to: toInput.value };
    if (rangeSelect.value === '7') return { from: localISO(shiftDate(now, -6)), to: todayDate };
    if (rangeSelect.value === '30') return { from: localISO(shiftDate(now, -29)), to: todayDate };
    if (rangeSelect.value === 'month') return { from: `${todayDate.slice(0, 7)}-01`, to: todayDate };
    return { from: todayDate, to: todayDate };
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('visible');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('visible');
  }

  async function fetchJson(endpoint, range) {
    const query = new URLSearchParams(range);
    const response = await fetch(`api/${endpoint}?${query.toString()}`, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Analytics request failed.');
    return data;
  }

  function changeText(value) {
    if (value === null || value === undefined) return 'No previous-period data';
    const rounded = numberFormat.format(Math.abs(value));
    if (value === 0) return 'No change vs previous period';
    const trend = value > 0 ? 'up' : 'down';
    const arrow = value > 0 ? '↑' : '↓';
    return `<span class="${trend}">${arrow} ${rounded}%</span> vs previous period`;
  }

  function renderKpis(data) {
    const labels = {
      confirmed_bookings: ['Confirmed bookings', (value) => numberFormat.format(value)],
      revenue: ['Revenue', (value) => `LKR ${moneyFormat.format(value)}`],
      seats_sold: ['Seats sold', (value) => numberFormat.format(value)],
      upcoming_trips: ['Upcoming trips', (value) => numberFormat.format(value)],
      cancellation_rate: ['Cancellation rate', (value) => `${numberFormat.format(value)}%`],
      average_seats_per_booking: ['Avg. seats / booking', (value) => numberFormat.format(value)],
      average_occupancy: ['Avg. trip occupancy', (value) => `${numberFormat.format(value)}%`],
    };
    Object.entries(labels).forEach(([key, [label, format]]) => {
      const card = $(`[data-kpi="${key}"]`);
      if (!card) return;
      $('[data-kpi-label]', card).textContent = label;
      $('[data-kpi-value]', card).textContent = format(Number(data.metrics[key] || 0));
      $('[data-kpi-change]', card).innerHTML = changeText(data.changes[key]);
    });
    $('#range-caption').textContent = `${data.from} – ${data.to}`;
  }

  function setTable(id, headers, rows) {
    const container = $(`#table-${id}`);
    const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
    const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? '—'))}</td>`).join('')}</tr>`).join('');
    container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">No data for this period.</td></tr>`}</tbody></table>`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    })[character]);
  }

  function chartOptions(extra = {}) {
    const theme = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: theme.axis, usePointStyle: true, boxWidth: 8 } },
      },
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
      },
      ...extra,
    };
  }

  function displayChart(id, config, headers, rows) {
    const wrapper = $(`#chart-wrap-${id}`);
    const canvas = $(`#chart-${id}`);
    setTable(id, headers, rows);
    const hasValues = config.data.datasets.some((dataset) => dataset.data.some((value) => Number(value) > 0));
    if (!config.data.labels.length || !hasValues) {
      const existing = charts.get(id);
      if (existing) existing.destroy();
      charts.delete(id);
      wrapper.classList.add('empty');
      wrapper.classList.remove('ready');
      return;
    }
    wrapper.classList.remove('empty');
    wrapper.classList.add('ready');
    const existing = charts.get(id);
    if (existing) existing.destroy();
    charts.set(id, new Chart(canvas, config));
  }

  function fillDays(from, to, source) {
    const values = new Map(source.map((row) => [row.day, row]));
    const labels = [];
    const bookings = [];
    const revenue = [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 1)) {
      const key = localISO(cursor);
      labels.push(key);
      bookings.push(Number(values.get(key)?.bookings || 0));
      revenue.push(Number(values.get(key)?.revenue || 0));
    }
    return { labels, bookings, revenue };
  }

  function renderRevenue(data, range) {
    const theme = chartTheme();
    const series = fillDays(range.from, range.to, data.revenue);
    displayChart('revenue', {
      type: 'bar',
      data: { labels: series.labels, datasets: [
        { type: 'line', label: 'Revenue (LKR)', data: series.revenue, borderColor: '#f2b632', backgroundColor: 'rgba(242,182,50,.15)', fill: true, tension: .3, yAxisID: 'y' },
        { type: 'bar', label: 'Confirmed bookings', data: series.bookings, backgroundColor: '#0c6945', borderRadius: 5, yAxisID: 'y1' },
      ] },
      options: chartOptions({ scales: {
        x: { ticks: { color: theme.text, maxRotation: 45, minRotation: 0 }, grid: { display: false } },
        y: { position: 'left', beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
        y1: { position: 'right', beginAtZero: true, ticks: { color: theme.text, precision: 0 }, grid: { drawOnChartArea: false } },
      } }),
    }, ['Date', 'Confirmed bookings', 'Revenue (LKR)'], series.labels.map((label, index) => [label, series.bookings[index], moneyFormat.format(series.revenue[index])]));
  }

  function renderRoutes(data) {
    const theme = chartTheme();
    const rows = data.routes.map((row) => [`${row.from_city} → ${row.to_city}`, Number(row.seats_sold), `LKR ${moneyFormat.format(Number(row.revenue))}`]);
    displayChart('routes', {
      type: 'bar',
      data: { labels: data.routes.map((row) => `${row.from_city} → ${row.to_city}`), datasets: [{ label: 'Seats sold', data: data.routes.map((row) => Number(row.seats_sold)), backgroundColor: chartColors, borderRadius: 6 }] },
      options: chartOptions({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (context) => `Revenue: LKR ${moneyFormat.format(Number(data.routes[context.dataIndex]?.revenue || 0))}` } } }, scales: { x: { beginAtZero: true, ticks: { color: theme.text, precision: 0 }, grid: { color: theme.grid } }, y: { ticks: { color: theme.axis }, grid: { display: false } } } }),
    }, ['Route', 'Seats sold', 'Revenue'], rows);
  }

  function renderOccupancy(data) {
    const theme = chartTheme();
    const rows = data.routes.map((row) => [row.route, `${numberFormat.format(Number(row.occupancy))}%`, row.trips]);
    displayChart('occupancy', {
      type: 'bar',
      data: { labels: data.routes.map((row) => row.route), datasets: [{ label: 'Average occupancy', data: data.routes.map((row) => Number(row.occupancy)), backgroundColor: '#55a879', borderRadius: 6 }] },
      options: chartOptions({ plugins: { legend: { display: false } }, scales: { x: { ticks: { color: theme.axis }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { color: theme.text, callback: (value) => `${value}%` }, grid: { color: theme.grid } } } }),
    }, ['Route', 'Avg. occupancy', 'Trips'], rows);
    const fullest = data.fullest_upcoming || [];
    const table = $('#fullest-trips');
    table.innerHTML = fullest.length ? fullest.map((trip) => `<tr><td>${escapeHtml(trip.depart_date)}</td><td>${escapeHtml(trip.from_city)} → ${escapeHtml(trip.to_city)}</td><td>${escapeHtml(trip.bus_name)}</td><td>${trip.seats_sold} / ${trip.total_seats}</td><td>${numberFormat.format(trip.occupancy)}%</td></tr>`).join('') : '<tr><td colspan="5" class="admin-empty">No upcoming trips in this range.</td></tr>';
  }

  function renderWeekday(data) {
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const source = new Map(data.weekday.map((row) => [Number(row.weekday), Number(row.bookings)]));
    const values = weekdayNames.map((_, index) => source.get(index + 1) || 0);
    displayChart('weekday', {
      type: 'bar',
      data: { labels: weekdayNames, datasets: [{ label: 'Confirmed bookings', data: values, backgroundColor: weekdayNames.map((_, index) => chartColors[index]), borderRadius: 6 }] },
      options: chartOptions({ plugins: { legend: { display: false } } }),
    }, ['Weekday', 'Confirmed bookings'], weekdayNames.map((day, index) => [day, values[index]]));
  }

  function renderBusTypes(data) {
    const theme = chartTheme();
    const rows = data.bus_types.map((row) => [row.bus_type, row.seats_sold]);
    displayChart('bus-types', {
      type: 'doughnut',
      data: { labels: data.bus_types.map((row) => row.bus_type), datasets: [{ data: data.bus_types.map((row) => Number(row.seats_sold)), backgroundColor: chartColors, borderColor: theme.surface, borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: theme.axis, usePointStyle: true, padding: 16 } } } },
    }, ['Bus type', 'Seats sold'], rows);
  }

  async function loadDashboard({ kpisOnly = false } = {}) {
    const range = getRange();
    if (!range.from || !range.to || range.from > range.to) {
      showError('Choose a valid start and end date.');
      return;
    }
    $('#bookings-from').value = range.from;
    $('#bookings-to').value = range.to;
    clearError();
    const query = new URLSearchParams({ ...range, q: $('#booking-search')?.value || '', status: $('#booking-status')?.value || '', page: $('#booking-page')?.value || '1' });
    history.replaceState(null, '', `index.php?${query.toString()}`);
    const requests = [fetchJson('stats_kpis.php', range)];
    if (!kpisOnly) requests.push(fetchJson('stats_revenue.php', range), fetchJson('stats_routes.php', range), fetchJson('stats_occupancy.php', range));
    try {
      const results = await Promise.all(requests);
      renderKpis(results[0]);
      if (!kpisOnly) {
        renderRevenue(results[1], range);
        renderRoutes(results[2]);
        renderOccupancy(results[3]);
        renderWeekday(results[1]);
        renderBusTypes(results[1]);
      }
    } catch (error) {
      showError(error.message);
    }
  }

  function initRange() {
    const params = new URLSearchParams(location.search);
    const urlFrom = params.get('from');
    const urlTo = params.get('to');
    const preset = $('#initial-preset')?.value;
    if (preset && preset !== 'custom') {
      rangeSelect.value = preset;
      customRange.hidden = true;
    } else if (urlFrom && urlTo) {
      rangeSelect.value = 'custom';
      fromInput.value = urlFrom;
      toInput.value = urlTo;
      customRange.hidden = false;
    }
  }

  rangeSelect.addEventListener('change', () => {
    customRange.hidden = rangeSelect.value !== 'custom';
    if (rangeSelect.value !== 'custom') loadDashboard();
  });
  [fromInput, toInput].forEach((input) => input.addEventListener('change', () => {
    if (rangeSelect.value === 'custom') loadDashboard();
  }));
  $$('.admin-table-toggle').forEach((button) => button.addEventListener('click', () => {
    const table = $(`#table-${button.dataset.table}`);
    const willShow = table.hidden;
    table.hidden = !willShow;
    button.setAttribute('aria-expanded', String(willShow));
    button.textContent = willShow ? 'Hide data table' : 'View data table';
  }));
  $$('.admin-download-chart').forEach((button) => button.addEventListener('click', () => {
    const chart = charts.get(button.dataset.chart);
    if (!chart) return;
    const link = document.createElement('a');
    link.href = chart.toBase64Image('image/png', 1);
    link.download = `triplink-${button.dataset.chart}.png`;
    link.click();
  }));

  const menuButton = $('.admin-menu-toggle');
  const sidebar = $('.admin-sidebar');
  const backdrop = $('.admin-sidebar-backdrop');
  const closeMenu = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
    backdrop.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  menuButton.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    backdrop.hidden = !opening;
    backdrop.classList.toggle('visible', opening);
    menuButton.setAttribute('aria-expanded', String(opening));
    document.body.style.overflow = opening ? 'hidden' : '';
  });
  backdrop.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
  const colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (colorScheme) {
    const refreshChartTheme = () => loadDashboard();
    if (colorScheme.addEventListener) colorScheme.addEventListener('change', refreshChartTheme);
    else if (colorScheme.addListener) colorScheme.addListener(refreshChartTheme);
  }

  initRange();
  loadDashboard();
  window.setInterval(() => {
    if (!document.hidden) loadDashboard({ kpisOnly: true });
  }, 60000);
})();
