<?php
require __DIR__ . '/_bootstrap.php';

admin_api_run(function (PDO $pdo): void {
    [$from, $to] = admin_api_range();
    $stmt = $pdo->prepare(
        "SELECT t.id, t.depart_date, t.depart_time, b.name AS bus_name,
                b.total_seats, b.bus_type, cf.name AS from_city, ct.name AS to_city,
                COALESCE(sold.seats_sold, 0) AS seats_sold
         FROM trips t
         JOIN buses b ON b.id = t.bus_id
         JOIN routes r ON r.id = t.route_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         LEFT JOIN (
            SELECT bs.trip_id, COUNT(*) AS seats_sold
            FROM booking_seats bs
            JOIN bookings bk ON bk.id = bs.booking_id
            WHERE bk.status = 'confirmed'
            GROUP BY bs.trip_id
         ) sold ON sold.trip_id = t.id
         WHERE t.depart_date BETWEEN :from_date AND :to_date
         ORDER BY t.depart_date, t.depart_time"
    );
    $stmt->execute([':from_date' => $from, ':to_date' => $to]);
    $trips = $stmt->fetchAll();
    $routeStats = [];

    foreach ($trips as &$trip) {
        $total = (int)$trip['total_seats'];
        $sold = (int)$trip['seats_sold'];
        $trip['total_seats'] = $total;
        $trip['seats_sold'] = $sold;
        $trip['occupancy'] = $total > 0 ? min(100, ($sold / $total) * 100) : 0;
        $route = $trip['from_city'] . ' → ' . $trip['to_city'];
        if (!isset($routeStats[$route])) {
            $routeStats[$route] = ['route' => $route, 'occupancy_sum' => 0, 'trips' => 0];
        }
        $routeStats[$route]['occupancy_sum'] += $trip['occupancy'];
        $routeStats[$route]['trips']++;
    }
    unset($trip);

    $routes = array_values(array_map(static function (array $route): array {
        return [
            'route' => $route['route'],
            'occupancy' => $route['trips'] > 0 ? $route['occupancy_sum'] / $route['trips'] : 0,
            'trips' => $route['trips'],
        ];
    }, $routeStats));
    usort($routes, static fn(array $a, array $b): int => $b['occupancy'] <=> $a['occupancy']);

    $now = date('Y-m-d H:i:s');
    $upcoming = array_values(array_filter(
        $trips,
        static fn(array $trip): bool => $trip['depart_date'] . ' ' . $trip['depart_time'] >= $now
    ));
    usort($upcoming, static fn(array $a, array $b): int => $b['occupancy'] <=> $a['occupancy']);

    json_out([
        'routes' => $routes,
        'fullest_upcoming' => array_slice($upcoming, 0, 10),
    ]);
});
