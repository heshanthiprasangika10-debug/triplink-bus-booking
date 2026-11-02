<?php
require __DIR__ . '/_bootstrap.php';

admin_api_run(function (PDO $pdo): void {
    [$from, $to] = admin_api_range();
    $stmt = $pdo->prepare(
        "SELECT cf.name AS from_city, ct.name AS to_city,
                COALESCE(sold.seats_sold, 0) AS seats_sold,
                COALESCE(revenue.total_revenue, 0) AS revenue
         FROM routes r
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         JOIN (
            SELECT t.route_id, COUNT(bs.id) AS seats_sold
            FROM bookings bk
            JOIN trips t ON t.id = bk.trip_id
            LEFT JOIN booking_seats bs ON bs.booking_id = bk.id
            WHERE bk.status = 'confirmed'
              AND bk.created_at >= :seats_from AND bk.created_at < DATE_ADD(:seats_to, INTERVAL 1 DAY)
            GROUP BY t.route_id
         ) sold ON sold.route_id = r.id
         LEFT JOIN (
            SELECT t.route_id, SUM(bk.total) AS total_revenue
            FROM bookings bk
            JOIN trips t ON t.id = bk.trip_id
            WHERE bk.status = 'confirmed'
              AND bk.created_at >= :revenue_from AND bk.created_at < DATE_ADD(:revenue_to, INTERVAL 1 DAY)
            GROUP BY t.route_id
         ) revenue ON revenue.route_id = r.id
         ORDER BY seats_sold DESC, revenue DESC
         LIMIT 8"
    );
    $start = $from . ' 00:00:00';
    $end = $to . ' 00:00:00';
    $stmt->execute([
        ':seats_from' => $start,
        ':seats_to' => $end,
        ':revenue_from' => $start,
        ':revenue_to' => $end,
    ]);
    json_out(['routes' => $stmt->fetchAll()]);
});
