<?php
require __DIR__ . '/../api/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function h($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

if (empty($_SESSION['admin_csrf'])) {
    $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['admin_csrf'];
$loginError = '';
$actionError = '';
$isAdmin = !empty($_SESSION['admin']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $submittedToken = (string)($_POST['csrf_token'] ?? '');
    if (!hash_equals($csrfToken, $submittedToken)) {
        http_response_code(403);
        $actionError = 'This request expired. Refresh the page and try again.';
    } elseif (isset($_POST['logout'])) {
        if ($isAdmin) {
            session_unset();
            session_destroy();
        }
        header('Location: index.php');
        exit;
    } elseif (!$isAdmin && isset($_POST['password'])) {
        $now = time();
        $attempts = $_SESSION['admin_login_attempts'] ?? ['started' => $now, 'count' => 0];
        if ($now - (int)$attempts['started'] >= 600) {
            $attempts = ['started' => $now, 'count' => 0];
        }
        if ((int)$attempts['count'] >= 5) {
            $loginError = 'Too many attempts. Please wait 10 minutes and try again.';
        } elseif (hash_equals(ADMIN_PASSWORD, (string)$_POST['password'])) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
            unset($_SESSION['admin_login_attempts']);
            header('Location: index.php');
            exit;
        } else {
            $attempts['count'] = (int)$attempts['count'] + 1;
            $_SESSION['admin_login_attempts'] = $attempts;
            $loginError = 'Wrong password';
        }
    } elseif ($isAdmin && isset($_POST['cancel_id'])) {
        $bookingId = filter_var($_POST['cancel_id'], FILTER_VALIDATE_INT);
        if (!$bookingId || $bookingId < 1) {
            $actionError = 'Invalid booking selection.';
        } else {
            try {
                $pdo = db();
                $pdo->beginTransaction();
                $update = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = :id AND status = 'confirmed'");
                $update->execute([':id' => $bookingId]);
                if ($update->rowCount() > 0) {
                    $pdo->prepare('DELETE FROM booking_seats WHERE booking_id = :id')->execute([':id' => $bookingId]);
                }
                $pdo->commit();
                $query = http_build_query($_GET);
                header('Location: index.php' . ($query ? '?' . $query : ''));
                exit;
            } catch (Throwable $error) {
                if (isset($pdo) && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log('TripLink admin booking cancellation failed: ' . $error->getMessage());
                $actionError = 'Could not cancel this booking. Please try again.';
            }
        }
    }
}

$isAdmin = !empty($_SESSION['admin']);
if (!$isAdmin):
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TripLink Admin Login</title>
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="stylesheet" href="admin.css">
</head>
<body class="admin-body">
  <div class="admin-login-screen">
    <form method="post" class="panel admin-login-card">
      <img src="../assets/img/logo.svg" alt="TripLink">
      <h1>Admin login</h1>
      <input type="hidden" name="csrf_token" value="<?= h($csrfToken) ?>">
      <div class="field"><label for="admin-password">Password</label><input id="admin-password" type="password" name="password" autocomplete="current-password" required autofocus></div>
      <?php if ($loginError): ?><div class="err" role="alert"><?= h($loginError) ?></div><?php endif; ?>
      <?php if ($actionError): ?><div class="err" role="alert"><?= h($actionError) ?></div><?php endif; ?>
      <button class="btn" type="submit">Login</button>
    </form>
  </div>
</body>
</html>
<?php
    exit;
endif;

$pdo = db();
$queryText = trim((string)($_GET['q'] ?? ''));
$statusFilter = (string)($_GET['status'] ?? '');
if (!in_array($statusFilter, ['', 'confirmed', 'cancelled'], true)) {
    $statusFilter = '';
}
$pageNumber = max(1, (int)($_GET['page'] ?? 1));
$pageSize = 20;
$conditions = [];
$params = [];
if ($queryText !== '') {
    $conditions[] = '(bk.ref LIKE :search_ref OR bk.passenger_name LIKE :search_name OR bk.phone LIKE :search_phone)';
    $searchValue = '%' . $queryText . '%';
    $params[':search_ref'] = $searchValue;
    $params[':search_name'] = $searchValue;
    $params[':search_phone'] = $searchValue;
}
if ($statusFilter !== '') {
    $conditions[] = 'bk.status = :status';
    $params[':status'] = $statusFilter;
}
$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
$countQuery = $pdo->prepare("SELECT COUNT(*) FROM bookings bk $where");
$countQuery->execute($params);
$totalRows = (int)$countQuery->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $pageSize));
$pageNumber = min($pageNumber, $totalPages);
$offset = ($pageNumber - 1) * $pageSize;
$bookingsQuery = $pdo->prepare(
    "SELECT bk.id, bk.ref, bk.passenger_name, bk.phone, bk.total, bk.status, bk.created_at,
            t.depart_date, t.depart_time, cf.name AS from_city, ct.name AS to_city,
            (SELECT GROUP_CONCAT(seat_no ORDER BY seat_no)
             FROM booking_seats WHERE booking_id = bk.id) AS seats
     FROM bookings bk
     JOIN trips t ON t.id = bk.trip_id
     JOIN routes r ON r.id = t.route_id
     JOIN cities cf ON cf.id = r.from_city
     JOIN cities ct ON ct.id = r.to_city
     $where
     ORDER BY bk.id DESC
     LIMIT :page_size OFFSET :offset"
);
foreach ($params as $key => $value) {
    $bookingsQuery->bindValue($key, $value);
}
$bookingsQuery->bindValue(':page_size', $pageSize, PDO::PARAM_INT);
$bookingsQuery->bindValue(':offset', $offset, PDO::PARAM_INT);
$bookingsQuery->execute();
$rows = $bookingsQuery->fetchAll();

$today = date('Y-m-d');
$defaultFrom = (string)($_GET['from'] ?? $today);
$defaultTo = (string)($_GET['to'] ?? $today);
$validDate = static function (string $date): bool {
    $value = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    return $value !== false && $value->format('Y-m-d') === $date;
};
if (!$validDate($defaultFrom) || !$validDate($defaultTo) || $defaultFrom > $defaultTo) {
    $defaultFrom = $today;
    $defaultTo = $today;
}
$defaultPreset = 'today';
if (isset($_GET['from'], $_GET['to'])) {
    if ($defaultFrom === $today && $defaultTo === $today) {
        $defaultPreset = 'today';
    } elseif ($defaultFrom === (new DateTimeImmutable($today))->modify('-6 days')->format('Y-m-d') && $defaultTo === $today) {
        $defaultPreset = '7';
    } elseif ($defaultFrom === (new DateTimeImmutable($today))->modify('-29 days')->format('Y-m-d') && $defaultTo === $today) {
        $defaultPreset = '30';
    } elseif ($defaultFrom === date('Y-m-01') && $defaultTo === $today) {
        $defaultPreset = 'month';
    } else {
        $defaultPreset = 'custom';
    }
}

require __DIR__ . '/_layout.php';
admin_page_start($csrfToken);
?>
<input type="hidden" id="initial-preset" value="<?= h($defaultPreset) ?>">
<div id="analytics-error" class="admin-error" role="alert" aria-live="polite"></div>
<section id="dashboard" aria-labelledby="dashboard-title">
  <div class="admin-toolbar">
    <div><h2 id="dashboard-title">Performance overview</h2><p id="range-caption"><?= h($defaultFrom) ?> – <?= h($defaultTo) ?></p></div>
    <div class="range-picker">
      <label for="date-preset">Date range
        <select id="date-preset">
          <option value="today">Today</option><option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option><option value="month">This month</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <div id="custom-range" class="range-custom" hidden>
        <label for="date-from">From<input id="date-from" type="date" value="<?= h($defaultFrom) ?>"></label>
        <label for="date-to">To<input id="date-to" type="date" value="<?= h($defaultTo) ?>"></label>
      </div>
    </div>
  </div>
  <div class="admin-kpis" aria-live="polite">
    <?php foreach (['confirmed_bookings', 'revenue', 'seats_sold', 'upcoming_trips', 'cancellation_rate', 'average_seats_per_booking', 'average_occupancy'] as $metric): ?>
      <article class="admin-kpi" data-kpi="<?= h($metric) ?>">
        <span class="admin-kpi-label" data-kpi-label>Loading…</span>
        <b class="admin-kpi-value" data-kpi-value>—</b>
        <span class="admin-kpi-change" data-kpi-change>Comparing periods…</span>
      </article>
    <?php endforeach; ?>
  </div>
  <div class="admin-chart-grid">
    <?php
    $chartCards = [
        ['revenue', 'Revenue per day', 'Revenue and confirmed bookings'],
        ['routes', 'Popular routes', 'Top routes by seats sold; hover for revenue'],
        ['occupancy', 'Seat occupancy by route', 'Average seats sold per trip'],
        ['weekday', 'Bookings by weekday', 'Confirmed bookings by day of week'],
        ['bus-types', 'Bus type share', 'Seats sold by bus type'],
    ];
    foreach ($chartCards as [$chartId, $chartTitle, $chartDescription]):
    ?>
      <article class="admin-card <?= $chartId === 'revenue' ? 'admin-card-wide' : '' ?>">
        <div class="admin-card-head">
          <div><h2><?= h($chartTitle) ?></h2><p><?= h($chartDescription) ?></p></div>
          <div class="admin-chart-actions">
            <button type="button" class="admin-table-toggle" data-table="<?= h($chartId) ?>" aria-expanded="false">View data table</button>
            <button type="button" class="admin-download-chart" data-chart="<?= h($chartId) ?>">Download PNG</button>
          </div>
        </div>
        <div class="admin-chart-wrap" id="chart-wrap-<?= h($chartId) ?>">
          <div class="admin-chart-loading" aria-label="Loading chart"><i></i><i></i><i></i></div>
          <div class="admin-chart-empty">No data for this period.</div>
          <canvas id="chart-<?= h($chartId) ?>" role="img" aria-label="<?= h($chartTitle) ?>"></canvas>
        </div>
        <div class="admin-data-table" id="table-<?= h($chartId) ?>" hidden></div>
      </article>
    <?php endforeach; ?>
    <article class="admin-card admin-card-wide">
      <div class="admin-card-head"><div><h2>Fullest upcoming trips</h2><p>Highest current seat occupancy within this date range</p></div></div>
      <div class="admin-data-table">
        <table><thead><tr><th>Date</th><th>Route</th><th>Bus</th><th>Seats sold</th><th>Occupancy</th></tr></thead><tbody id="fullest-trips"><tr><td colspan="5">Loading…</td></tr></tbody></table>
      </div>
    </article>
  </div>
</section>

<section id="bookings" class="admin-section" aria-labelledby="bookings-title">
  <h2 id="bookings-title" class="admin-section-title">Recent bookings</h2>
  <div class="admin-card admin-table-card">
    <form class="admin-booking-filters" method="get" action="index.php">
      <input id="bookings-from" type="hidden" name="from" value="<?= h($defaultFrom) ?>"><input id="bookings-to" type="hidden" name="to" value="<?= h($defaultTo) ?>">
      <input id="booking-search" type="search" name="q" value="<?= h($queryText) ?>" placeholder="Search reference, passenger or phone" aria-label="Search reference, passenger or phone">
      <select id="booking-status" name="status" aria-label="Filter by booking status">
        <option value="">All statuses</option><option value="confirmed" <?= $statusFilter === 'confirmed' ? 'selected' : '' ?>>Confirmed</option>
        <option value="cancelled" <?= $statusFilter === 'cancelled' ? 'selected' : '' ?>>Cancelled</option>
      </select>
      <button type="submit">Search</button>
    </form>
    <div class="admin-table-scroll" role="region" aria-label="Bookings table; scroll horizontally on small screens" tabindex="0">
      <table class="admin-bookings-table">
        <thead><tr><th>Reference</th><th>Passenger</th><th>Phone</th><th>Route</th><th>Departure</th><th>Seats</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
        <?php foreach ($rows as $booking): ?>
          <tr>
            <td><b><?= h($booking['ref']) ?></b></td><td><?= h($booking['passenger_name']) ?></td><td><?= h($booking['phone']) ?></td>
            <td><?= h($booking['from_city']) ?> → <?= h($booking['to_city']) ?></td>
            <td><?= h($booking['depart_date']) ?> <?= h(substr($booking['depart_time'], 0, 5)) ?></td>
            <td><?= h($booking['seats'] ?: '—') ?></td><td>LKR <?= number_format((float)$booking['total']) ?></td>
            <td><span class="admin-status <?= h($booking['status']) ?>"><?= h($booking['status']) ?></span></td>
            <td>
              <?php if ($booking['status'] === 'confirmed'): ?>
                <form method="post" action="index.php<?= $_GET ? '?' . h(http_build_query($_GET)) : '' ?>" onsubmit="return confirm('Cancel this booking?')">
                  <input type="hidden" name="csrf_token" value="<?= h($csrfToken) ?>">
                  <input type="hidden" name="cancel_id" value="<?= (int)$booking['id'] ?>">
                  <button type="submit" class="admin-cancel-button">Cancel</button>
                </form>
              <?php else: ?>—<?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?><tr><td colspan="9" class="admin-empty">No bookings match these filters.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
    <div class="admin-pagination">
      <span><?= $totalRows ? h(($offset + 1) . '–' . min($offset + $pageSize, $totalRows) . ' of ' . $totalRows) : '0 bookings' ?></span>
      <div>
        <?php if ($pageNumber > 1): $previousQuery = $_GET; $previousQuery['page'] = $pageNumber - 1; ?>
          <a href="index.php?<?= h(http_build_query($previousQuery)) ?>">Previous</a>
        <?php endif; ?>
        <?php if ($pageNumber < $totalPages): $nextQuery = $_GET; $nextQuery['page'] = $pageNumber + 1; ?>
          <a href="index.php?<?= h(http_build_query($nextQuery)) ?>">Next</a>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>
<?php admin_page_end(); ?>
