<?php
require __DIR__ . '/config.php';

$from = (int)($_GET['from'] ?? 0);
$to   = (int)($_GET['to'] ?? 0);
$date = $_GET['date'] ?? date('Y-m-d');

if (!$from || !$to || $from === $to || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_out(['error' => 'Choose two different cities and a valid date.', 'code' => 'searchCities'], 400);
}
if ($date < date('Y-m-d')) {
    json_out(['error' => 'Date cannot be in the past.', 'code' => 'datePast'], 400);
}
if ($date > date('Y-m-d', strtotime('+' . DAYS_AHEAD . ' days'))) {
    json_out(['error' => 'Bookings open ' . DAYS_AHEAD . ' days in advance only.', 'code' => 'bookingWindow', 'days' => DAYS_AHEAD], 400);
}

try {
    ensure_trips($date);

    $stmt = db()->prepare(
        "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time, t.fare,
                b.name AS bus_name, b.bus_type, b.total_seats, b.amenities,
                cf.name AS from_city, ct.name AS to_city, r.distance_km,
                (b.total_seats - (SELECT COUNT(*) FROM booking_seats bs WHERE bs.trip_id = t.id)) AS seats_left
         FROM trips t
         JOIN routes r ON r.id = t.route_id
         JOIN buses b ON b.id = t.bus_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE r.from_city = :f AND r.to_city = :t AND t.depart_date = :d
         ORDER BY t.depart_time"
    );
    $stmt->execute([':f' => $from, ':t' => $to, ':d' => $date]);
    $trips = $stmt->fetchAll();

    // hide buses that already left today
    if ($date === date('Y-m-d')) {
        $now = date('H:i:s');
        $trips = array_values(array_filter($trips, fn($t) => $t['depart_time'] > $now));
    }
    json_out(['trips' => $trips]);
} catch (Throwable $e) {
    json_out(['error' => 'Search failed. Is the database imported?', 'code' => 'searchFailed'], 500);
}
