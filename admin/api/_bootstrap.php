<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require_once __DIR__ . '/../../api/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function admin_api_require_admin(): void
{
    if (empty($_SESSION['admin'])) {
        json_out(['error' => 'Admin authentication required.'], 401);
    }
}

function admin_api_date(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function admin_api_range(): array
{
    $from = (string)($_GET['from'] ?? date('Y-m-d'));
    $to = (string)($_GET['to'] ?? date('Y-m-d'));

    if (!admin_api_date($from) || !admin_api_date($to) || $from > $to) {
        json_out(['error' => 'Choose a valid date range.'], 400);
    }

    $days = (int)(new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days;
    if ($days > 365) {
        json_out(['error' => 'Date ranges cannot exceed 366 days.'], 400);
    }

    return [$from, $to];
}

function admin_api_run(callable $callback): void
{
    admin_api_require_admin();
    try {
        $callback(db());
    } catch (Throwable $error) {
        error_log('TripLink admin analytics error: ' . $error->getMessage());
        json_out(['error' => 'Could not load dashboard analytics. Please try again.'], 500);
    }
}

function admin_api_metrics(PDO $pdo, string $from, string $to): array
{
    $bookings = $pdo->prepare(
        "SELECT
            COUNT(*) AS all_bookings,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_bookings,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
            COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total ELSE 0 END), 0) AS revenue
         FROM bookings
         WHERE created_at >= :from_start AND created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)"
    );
    $bookings->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);
    $bookingMetrics = $bookings->fetch();

    $seats = $pdo->prepare(
        "SELECT COUNT(*)
         FROM booking_seats bs
         JOIN bookings bk ON bk.id = bs.booking_id
         WHERE bk.status = 'confirmed'
           AND bk.created_at >= :from_start AND bk.created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)"
    );
    $seats->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);
    $seatsSold = (int)$seats->fetchColumn();

    $trips = $pdo->prepare(
        "SELECT
            SUM(CASE WHEN t.depart_date >= CURDATE() THEN 1 ELSE 0 END) AS upcoming_trip_count,
            COALESCE(AVG(CASE WHEN b.total_seats > 0
                THEN LEAST(COALESCE(sold.seats_sold, 0) / b.total_seats, 1) * 100
                ELSE NULL END), 0) AS average_occupancy
         FROM trips t
         JOIN buses b ON b.id = t.bus_id
         LEFT JOIN (
            SELECT bs.trip_id, COUNT(*) AS seats_sold
            FROM booking_seats bs
            JOIN bookings bk ON bk.id = bs.booking_id
            WHERE bk.status = 'confirmed'
            GROUP BY bs.trip_id
         ) sold ON sold.trip_id = t.id
         WHERE t.depart_date BETWEEN :from_date AND :to_date"
    );
    $trips->execute([':from_date' => $from, ':to_date' => $to]);
    $tripMetrics = $trips->fetch();

    $allBookings = (int)($bookingMetrics['all_bookings'] ?? 0);
    $confirmed = (int)($bookingMetrics['confirmed_bookings'] ?? 0);
    $cancelled = (int)($bookingMetrics['cancelled_bookings'] ?? 0);

    return [
        'confirmed_bookings' => $confirmed,
        'revenue' => (float)($bookingMetrics['revenue'] ?? 0),
        'seats_sold' => $seatsSold,
        'upcoming_trips' => (int)($tripMetrics['upcoming_trip_count'] ?? 0),
        'cancellation_rate' => $allBookings > 0 ? ($cancelled / $allBookings) * 100 : 0,
        'average_seats_per_booking' => $confirmed > 0 ? $seatsSold / $confirmed : 0,
        'average_occupancy' => (float)($tripMetrics['average_occupancy'] ?? 0),
    ];
}
