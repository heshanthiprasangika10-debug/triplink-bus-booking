<?php
require __DIR__ . '/config.php';

$cityCoordinates = [
    'Colombo' => [6.9271, 79.8612],
    'Kandy' => [7.2906, 80.6337],
    'Galle' => [6.0535, 80.2210],
    'Matara' => [5.9549, 80.5550],
    'Jaffna' => [9.6615, 80.0255],
    'Anuradhapura' => [8.3114, 80.4037],
    'Nuwara Eliya' => [6.9497, 80.7891],
    'Badulla' => [6.9934, 81.0550],
    'Batticaloa' => [7.7310, 81.6747],
    'Trincomalee' => [8.5874, 81.2152],
    'Kurunegala' => [7.4863, 80.3647],
    'Ratnapura' => [6.7056, 80.3847],
];

$demo = ($_GET['demo'] ?? '') === '1';
$now = new DateTimeImmutable('now');
$today = $now->format('Y-m-d');
$yesterday = $now->modify('-1 day')->format('Y-m-d');

try {
    ensure_trips($today);
    ensure_trips($yesterday);

    $stmt = db()->prepare(
        "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time,
                b.name AS bus_name, b.bus_type, b.reg_no, b.total_seats,
               b.id AS bus_id, cf.name AS from_city, ct.name AS to_city, r.distance_km,
                (SELECT COUNT(*) FROM booking_seats bs WHERE bs.trip_id = t.id) AS seats_sold
         FROM trips t
         JOIN routes r ON r.id = t.route_id
         JOIN buses b ON b.id = t.bus_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE t.depart_date IN (:today, :yesterday)
         ORDER BY t.id"
    );
    $stmt->execute([':today' => $today, ':yesterday' => $yesterday]);

    $buses = [];
    $demoBusIds = [];
    foreach ($stmt->fetchAll() as $trip) {
        if (!isset($cityCoordinates[$trip['from_city']], $cityCoordinates[$trip['to_city']])) {
            continue;
        }
        if ($demo && isset($demoBusIds[$trip['bus_id']])) {
            continue;
        }

        $start = new DateTimeImmutable($trip['depart_date'] . ' ' . $trip['depart_time']);
        $end = new DateTimeImmutable($trip['depart_date'] . ' ' . $trip['arrive_time']);
        if ($end <= $start) {
            $end = $end->modify('+1 day');
        }
        $durationSeconds = $end->getTimestamp() - $start->getTimestamp();
        if ($durationSeconds <= 0) {
            continue;
        }

        if ($demo) {
            if ($trip['depart_date'] !== $today) {
                continue;
            }
            $demoBusIds[$trip['bus_id']] = true;
            $progress = fmod($now->getTimestamp() / 150 + (int)$trip['id'] * 0.173, 1.0);
        } else {
            if ($now < $start || $now > $end) {
                continue;
            }
            $progress = ($now->getTimestamp() - $start->getTimestamp()) / $durationSeconds;
        }

        [$fromLat, $fromLng] = $cityCoordinates[$trip['from_city']];
        [$toLat, $toLng] = $cityCoordinates[$trip['to_city']];

        $buses[] = [
            'trip_id' => (int)$trip['id'],
            'bus_name' => $trip['bus_name'],
            'bus_type' => $trip['bus_type'],
            'reg_no' => $trip['reg_no'],
            'from_city' => $trip['from_city'],
            'to_city' => $trip['to_city'],
            'from' => [$fromLat, $fromLng],
            'to' => [$toLat, $toLng],
            'lat' => round($fromLat + ($toLat - $fromLat) * $progress, 6),
            'lng' => round($fromLng + ($toLng - $fromLng) * $progress, 6),
            'progress' => round($progress * 100, 1),
            'speed_kmh' => (int)round($trip['distance_km'] / ($durationSeconds / 3600)),
            'eta_min' => (int)round((1 - $progress) * $durationSeconds / 60),
            'depart_time' => $trip['depart_time'],
            'arrive_time' => $trip['arrive_time'],
            'seats_sold' => (int)$trip['seats_sold'],
            'total_seats' => (int)$trip['total_seats'],
        ];
    }

    usort($buses, fn($a, $b) => $b['progress'] <=> $a['progress']);
    json_out(['demo' => $demo, 'buses' => $buses, 'server_time' => $now->format('H:i:s')]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load live bus tracking. Check the database configuration and trip tables.'], 500);
}
