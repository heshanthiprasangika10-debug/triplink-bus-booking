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
    $pdo = db();
    $routeQuery = $pdo->prepare(
        'SELECT 1 FROM routes WHERE from_city = :from_city AND to_city = :to_city AND active = 1 LIMIT 1'
    );
    $routeQuery->execute([':from_city' => $from, ':to_city' => $to]);
    $routeExists = (bool)$routeQuery->fetchColumn();

    if (!$routeExists) {
        $cityQuery = $pdo->prepare('SELECT id, name FROM cities WHERE id IN (:from_city, :to_city, :colombo)');
        $cityQuery->execute([':from_city' => $from, ':to_city' => $to, ':colombo' => 1]);
        $cityNames = [];
        foreach ($cityQuery->fetchAll() as $city) {
            $cityNames[(int)$city['id']] = $city['name'];
        }

        $routeQuery = $pdo->prepare(
            'SELECT r.id, r.from_city, r.to_city, cf.name AS from_name, ct.name AS to_name
             FROM routes r
             JOIN cities cf ON cf.id = r.from_city
             JOIN cities ct ON ct.id = r.to_city
             WHERE r.active = 1 AND
             ((r.from_city = :from_city AND r.to_city = :to_city) OR
              (r.from_city = :reverse_from AND r.to_city = :reverse_to) OR
              (r.from_city = :origin_from AND r.to_city <> :origin_to))'
        );
        $routeQuery->execute([
            ':from_city' => $from,
            ':to_city' => $to,
            ':reverse_from' => $to,
            ':reverse_to' => $from,
            ':origin_from' => $from,
            ':origin_to' => $to,
        ]);
        $routes = $routeQuery->fetchAll();
        $routeSuggestions = ['reverse' => null, 'from_origin' => [], 'via_colombo' => null];
        foreach ($routes as $route) {
            $routeFrom = (int)$route['from_city'];
            $routeTo = (int)$route['to_city'];
            $suggestion = [
                'from_id' => $routeFrom,
                'to_id' => $routeTo,
                'from_city' => $route['from_name'],
                'to_city' => $route['to_name'],
            ];
            if ($routeFrom === $to && $routeTo === $from) {
                $routeSuggestions['reverse'] = $suggestion;
            } elseif ($routeFrom === $from && $routeTo !== $to) {
                $routeSuggestions['from_origin'][] = $suggestion;
            }
        }

        $colomboQuery = $pdo->prepare(
            'SELECT
                MAX(CASE WHEN from_city = :from_city AND to_city = :colombo THEN 1 ELSE 0 END) AS first_leg,
                MAX(CASE WHEN from_city = :colombo2 AND to_city = :to_city THEN 1 ELSE 0 END) AS second_leg
             FROM routes WHERE active = 1'
        );
        $colomboQuery->execute([
            ':from_city' => $from,
            ':colombo' => 1,
            ':colombo2' => 1,
            ':to_city' => $to,
        ]);
        $connection = $colomboQuery->fetch();
        if ($from !== 1 && $to !== 1 && $connection && (int)$connection['first_leg'] && (int)$connection['second_leg']) {
            $routeSuggestions['via_colombo'] = [
                'from_id' => $from,
                'via_id' => 1,
                'to_id' => $to,
                'from_city' => $cityNames[$from] ?? '',
                'via_city' => $cityNames[1] ?? '',
                'to_city' => $cityNames[$to] ?? '',
            ];
        }

        json_out(['trips' => [], 'route_exists' => false, 'suggestions' => $routeSuggestions]);
    }

    if ((int)$pdo->query('SELECT COUNT(*) FROM schedules')->fetchColumn() === 0) {
        json_out(['trips' => [], 'route_exists' => true, 'note' => 'no_schedules']);
    }

    ensure_trips($date);

    $stmt = $pdo->prepare(
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
           AND r.active = 1 AND b.active = 1 AND t.status = 'scheduled'
         ORDER BY t.depart_time"
    );
    $stmt->execute([':f' => $from, ':t' => $to, ':d' => $date]);
    $trips = $stmt->fetchAll();

    // hide buses that already left today
    if ($date === date('Y-m-d')) {
        $now = date('H:i:s');
        $trips = array_values(array_filter($trips, fn($t) => $t['depart_time'] > $now));
    }
    json_out(['trips' => $trips, 'route_exists' => true]);
} catch (Throwable $e) {
    json_out(array_merge([
        'error' => 'Search failed. Is the database imported?',
        'code' => 'searchFailed',
    ], api_debug_exception($e)), 500);
}