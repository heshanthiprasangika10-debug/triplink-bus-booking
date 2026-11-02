<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_out(['error' => 'GET only'], 405);
$user = require_user();
$filter = $_GET['filter'] ?? 'upcoming';
if (!in_array($filter, ['upcoming', 'past', 'cancelled'], true)) {
    json_out(['error' => 'Invalid booking filter.'], 400);
}

$conditions = ['bk.user_id = :user_id'];
if ($filter === 'cancelled') {
    $conditions[] = "bk.status = 'cancelled'";
} else {
    $conditions[] = "bk.status = 'confirmed'";
    $conditions[] = $filter === 'upcoming'
        ? "TIMESTAMP(t.depart_date, t.depart_time) >= NOW()"
        : "TIMESTAMP(t.depart_date, t.depart_time) < NOW()";
}

try {
    $stmt = db()->prepare(
        "SELECT bk.ref, bk.status, bk.total, bk.created_at, bk.passenger_name,
                bk.group_ref, bk.leg,
                t.depart_date, t.depart_time, t.arrive_time,
                b.name AS bus_name, b.bus_type, b.reg_no,
                cf.name AS from_city, ct.name AS to_city,
                (SELECT GROUP_CONCAT(bs.seat_no ORDER BY bs.seat_no)
                 FROM booking_seats bs WHERE bs.booking_id = bk.id) AS seat_list
         FROM bookings bk
         JOIN trips t ON t.id = bk.trip_id
         JOIN routes r ON r.id = t.route_id
         JOIN buses b ON b.id = t.bus_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE " . implode(' AND ', $conditions) . "
         ORDER BY bk.created_at DESC, bk.id DESC"
    );
    $stmt->execute([':user_id' => $user['id']]);
    $bookings = $stmt->fetchAll();
    foreach ($bookings as &$booking) {
        $booking['seats'] = $booking['seat_list'] === null || $booking['seat_list'] === ''
            ? []
            : array_map('intval', explode(',', $booking['seat_list']));
        unset($booking['seat_list']);
    }
    unset($booking);
    json_out(['bookings' => $bookings]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load your bookings. Please try again.'], 500);
}
