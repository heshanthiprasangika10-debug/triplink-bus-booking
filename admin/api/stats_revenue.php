<?php
require __DIR__ . '/_bootstrap.php';

admin_api_run(function (PDO $pdo): void {
    [$from, $to] = admin_api_range();

    $daily = $pdo->prepare(
        "SELECT DATE(created_at) AS day,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS bookings,
                COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total ELSE 0 END), 0) AS revenue
         FROM bookings
         WHERE created_at >= :from_start AND created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day"
    );
    $daily->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);

    $weekday = $pdo->prepare(
        "SELECT DAYOFWEEK(created_at) AS weekday,
                COUNT(*) AS bookings
         FROM bookings
         WHERE status = 'confirmed'
           AND created_at >= :from_start AND created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)
         GROUP BY DAYOFWEEK(created_at)
         ORDER BY weekday"
    );
    $weekday->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);

    $types = $pdo->prepare(
        "SELECT b.bus_type, COUNT(bs.id) AS seats_sold
         FROM bookings bk
         JOIN trips t ON t.id = bk.trip_id
         JOIN buses b ON b.id = t.bus_id
         JOIN booking_seats bs ON bs.booking_id = bk.id
         WHERE bk.status = 'confirmed'
           AND bk.created_at >= :from_start AND bk.created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)
         GROUP BY b.bus_type
         ORDER BY seats_sold DESC"
    );
    $types->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);

    json_out([
        'revenue' => $daily->fetchAll(),
        'weekday' => $weekday->fetchAll(),
        'bus_types' => $types->fetchAll(),
    ]);
});
