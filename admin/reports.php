<?php
require __DIR__ . '/_helpers.php';
admin_require_login();
require __DIR__ . '/_reports.php';

$reportError = '';
try {
    $filters = admin_report_filters(db());
} catch (Throwable $error) {
    error_log('TripLink report form error: ' . $error->getMessage());
    $filters = ['routes' => [], 'trips' => []];
    $reportError = 'Could not load report filters.';
}
$csrfToken = admin_token();
require __DIR__ . '/_layout.php';
admin_page_start($csrfToken, 'Reports', 'reports', false);
?>
<section class="admin-section">
  <div class="admin-toolbar"><div><h2>Reports & exports</h2><p>Export UTF-8 CSV or open a print-ready report and save it as PDF.</p></div></div>
  <?php if ($reportError): ?><div class="admin-flash error" role="alert"><?= admin_escape($reportError) ?></div><?php endif; ?>
  <form method="get" class="admin-card admin-report-form">
    <label>Report type<select name="type" id="report-type">
      <?php foreach (['bookings' => 'Bookings', 'revenue' => 'Revenue by day', 'manifest' => 'Trip passenger manifest', 'occupancy' => 'Trip occupancy', 'buses' => 'Bus list', 'schedules' => 'Schedule list'] as $key => $label): ?>
        <option value="<?= admin_escape($key) ?>" <?= ($_GET['type'] ?? 'bookings') === $key ? 'selected' : '' ?>><?= admin_escape($label) ?></option>
      <?php endforeach; ?>
    </select></label>
    <label class="report-date">From<input type="date" name="from" value="<?= admin_escape($_GET['from'] ?? date('Y-m-01')) ?>"></label>
    <label class="report-date">To<input type="date" name="to" value="<?= admin_escape($_GET['to'] ?? date('Y-m-d')) ?>"></label>
    <label class="report-booking-filter">Status<select name="status"><option value="">All statuses</option><option value="confirmed" <?= ($_GET['status'] ?? '') === 'confirmed' ? 'selected' : '' ?>>Confirmed</option><option value="cancelled" <?= ($_GET['status'] ?? '') === 'cancelled' ? 'selected' : '' ?>>Cancelled</option></select></label>
    <label class="report-route-filter">Route<select name="route_id"><option value="0">All routes</option><?php foreach ($filters['routes'] as $route): ?><option value="<?= (int)$route['id'] ?>" <?= (int)($_GET['route_id'] ?? 0) === (int)$route['id'] ? 'selected' : '' ?>><?= admin_escape($route['from_city']) ?> → <?= admin_escape($route['to_city']) ?></option><?php endforeach; ?></select></label>
    <label class="report-trip-filter">Trip<select name="trip_id" required><option value="">Select a trip</option><?php foreach ($filters['trips'] as $trip): ?><option value="<?= (int)$trip['id'] ?>" <?= (int)($_GET['trip_id'] ?? 0) === (int)$trip['id'] ? 'selected' : '' ?>><?= admin_escape($trip['depart_date']) ?> <?= admin_escape(substr($trip['depart_time'], 0, 5)) ?> · <?= admin_escape($trip['from_city']) ?> → <?= admin_escape($trip['to_city']) ?> · <?= admin_escape($trip['bus_name']) ?></option><?php endforeach; ?></select></label>
    <div class="admin-report-actions"><button formaction="export_csv.php" formmethod="get" class="btn gold" type="submit">Download CSV</button><button formaction="report_print.php" formmethod="get" class="admin-secondary-button" type="submit">Print / Save PDF</button></div>
  </form>
  <p class="admin-report-note">CSV includes a UTF-8 BOM for Excel and safely escapes spreadsheet formulas. PDF uses your browser's print dialog; choose “Save as PDF.” Reports are limited to allow-listed types and use server-side prepared queries.</p>
</section>
<script>
(() => {
  const type = document.getElementById('report-type');
  const update = () => {
    const manifest = type.value === 'manifest';
    const hideDates = manifest || ['buses', 'schedules'].includes(type.value);
    document.querySelectorAll('.report-date').forEach((el) => {
      el.hidden = hideDates;
      el.querySelector('input').required = !hideDates;
    });
    const tripFilter = document.querySelector('.report-trip-filter');
    tripFilter.hidden = !manifest;
    tripFilter.querySelector('select').required = manifest;
    document.querySelector('.report-route-filter').hidden = !['bookings', 'occupancy'].includes(type.value);
    document.querySelector('.report-booking-filter').hidden = type.value !== 'bookings';
  };
  type.addEventListener('change', update);
  update();
})();
</script>
<?php admin_page_end(); ?>
