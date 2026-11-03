<?php
require_once __DIR__ . '/_helpers.php';

function admin_report_input(): array
{
    $types = ['bookings', 'revenue', 'manifest', 'occupancy', 'buses', 'schedules'];
    $type = (string)($_GET['type'] ?? 'bookings');
    if (!in_array($type, $types, true)) {
        throw new RuntimeException('Choose a valid report type.');
    }
    $from = (string)($_GET['from'] ?? date('Y-m-01'));
    $to = (string)($_GET['to'] ?? date('Y-m-d'));
    foreach ([$from, $to] as $date) {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
            throw new RuntimeException('Choose valid start and end dates.');
        }
    }
    if ($from > $to || (int)(new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days > 365) {
        throw new RuntimeException('The date range must be ordered and no longer than 366 days.');
    }
    $status = (string)($_GET['status'] ?? '');
    if (!in_array($status, ['', 'confirmed', 'cancelled'], true)) {
        throw new RuntimeException('Choose a valid booking status.');
    }
    $routeId = (int)($_GET['route_id'] ?? 0);
    $tripId = (int)($_GET['trip_id'] ?? 0);
    if ($type === 'manifest' && $tripId < 1) {
        throw new RuntimeException('Choose a trip for the passenger manifest.');
    }
    return compact('type', 'from', 'to', 'status', 'routeId', 'tripId');
}

function admin_report_data(PDO $pdo, array $input): array
{
    $from = $input['from'];
    $to = $input['to'];
    $routeId = $input['routeId'];
    $type = $input['type'];
    switch ($type) {
        case 'bookings':
            $conditions = ['bk.created_at >= :from_start', 'bk.created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)'];
            $params = [':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00'];
            if ($routeId > 0) { $conditions[] = 't.route_id = :route_id'; $params[':route_id'] = $routeId; }
            if ($input['status'] !== '') { $conditions[] = 'bk.status = :status'; $params[':status'] = $input['status']; }
            $query = $pdo->prepare(
                'SELECT bk.ref, bk.passenger_name, bk.phone, bk.email, bk.status, bk.total, bk.created_at,
                        t.depart_date, t.depart_time, cf.name AS from_city, ct.name AS to_city,
                        b.name AS bus_name,
                        (SELECT GROUP_CONCAT(bs.seat_no ORDER BY bs.seat_no) FROM booking_seats bs WHERE bs.booking_id = bk.id) AS seats
                 FROM bookings bk JOIN trips t ON t.id = bk.trip_id
                 JOIN routes r ON r.id = t.route_id JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
                 JOIN buses b ON b.id = t.bus_id
                 WHERE ' . implode(' AND ', $conditions) . '
                 ORDER BY bk.created_at DESC'
            );
            $query->execute($params);
            return ['title' => 'Bookings', 'headers' => ['Reference', 'Passenger', 'Phone', 'Email', 'Status', 'Total LKR', 'Booked at', 'Departure', 'Route', 'Bus', 'Seats'], 'rows' => array_map(static fn(array $row): array => [$row['ref'], $row['passenger_name'], $row['phone'], $row['email'], $row['status'], $row['total'], $row['created_at'], $row['depart_date'] . ' ' . substr($row['depart_time'], 0, 5), $row['from_city'] . ' → ' . $row['to_city'], $row['bus_name'], $row['seats']], $query->fetchAll())];
        case 'revenue':
            $query = $pdo->prepare(
                "SELECT DATE(created_at) AS day, COUNT(*) AS confirmed_bookings,
                        COALESCE(SUM(total), 0) AS revenue_lkr
                 FROM bookings WHERE status = 'confirmed'
                   AND created_at >= :from_start AND created_at < DATE_ADD(:to_end, INTERVAL 1 DAY)
                 GROUP BY DATE(created_at) ORDER BY day"
            );
            $query->execute([':from_start' => $from . ' 00:00:00', ':to_end' => $to . ' 00:00:00']);
            return ['title' => 'Revenue by day', 'headers' => ['Date', 'Confirmed bookings', 'Revenue LKR'], 'rows' => array_map(static fn(array $row): array => [$row['day'], $row['confirmed_bookings'], $row['revenue_lkr']], $query->fetchAll())];
        case 'manifest':
            $query = $pdo->prepare(
                "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time, t.status AS trip_status,
                        cf.name AS from_city, ct.name AS to_city, b.name AS bus_name, b.reg_no,
                        bk.ref, bk.passenger_name, bk.phone, bk.email, bk.status AS booking_status,
                        bs.seat_no
                 FROM trips t JOIN routes r ON r.id = t.route_id
                 JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
                 JOIN buses b ON b.id = t.bus_id
                 LEFT JOIN bookings bk ON bk.trip_id = t.id
                 LEFT JOIN booking_seats bs ON bs.booking_id = bk.id
                 WHERE t.id = :trip_id
                 ORDER BY bs.seat_no, bk.id"
            );
            $query->execute([':trip_id' => $input['tripId']]);
            $manifestRows = $query->fetchAll();
            if (!$manifestRows) throw new RuntimeException('Trip not found.');
            $trip = $manifestRows[0];
            if ($trip['ref'] === null) {
                $rows = [['', '', '', '', '', '', '', '', '', '', '']];
            } else {
                $rows = array_map(static fn(array $row): array => [$row['seat_no'], $row['passenger_name'], $row['phone'], $row['email'], $row['ref'], $row['booking_status'], $row['depart_date'], substr($row['depart_time'], 0, 5), $row['from_city'] . ' → ' . $row['to_city'], $row['bus_name'] . ' · ' . $row['reg_no'], $row['trip_status']], $manifestRows);
            }
            return ['title' => 'Trip passenger manifest', 'subtitle' => $trip['from_city'] . ' → ' . $trip['to_city'] . ' · ' . $trip['depart_date'] . ' ' . substr($trip['depart_time'], 0, 5), 'headers' => ['Seat', 'Passenger', 'Phone', 'Email', 'Reference', 'Booking status', 'Date', 'Departure', 'Route', 'Bus', 'Trip status'], 'rows' => $rows];
        case 'occupancy':
            $conditions = ['t.depart_date BETWEEN :from_date AND :to_date'];
            $params = [':from_date' => $from, ':to_date' => $to];
            if ($routeId > 0) { $conditions[] = 't.route_id = :route_id'; $params[':route_id'] = $routeId; }
            $query = $pdo->prepare(
                "SELECT t.depart_date, t.depart_time, cf.name AS from_city, ct.name AS to_city,
                        b.name AS bus_name, b.total_seats, t.status,
                        (SELECT COUNT(*) FROM booking_seats bs JOIN bookings bk ON bk.id = bs.booking_id
                         WHERE bs.trip_id = t.id AND bk.status = 'confirmed') AS seats_sold
                 FROM trips t JOIN routes r ON r.id = t.route_id
                 JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
                 JOIN buses b ON b.id = t.bus_id
                 WHERE " . implode(' AND ', $conditions) . '
                 ORDER BY t.depart_date, t.depart_time'
            );
            $query->execute($params);
            $rows = array_map(static function (array $row): array {
                $percent = (int)$row['total_seats'] > 0 ? round(((int)$row['seats_sold'] / (int)$row['total_seats']) * 100, 1) : 0;
                return [$row['depart_date'], substr($row['depart_time'], 0, 5), $row['from_city'] . ' → ' . $row['to_city'], $row['bus_name'], $row['seats_sold'], $row['total_seats'], $percent . '%', $row['status']];
            }, $query->fetchAll());
            return ['title' => 'Trip occupancy', 'headers' => ['Date', 'Departure', 'Route', 'Bus', 'Seats sold', 'Total seats', 'Occupancy', 'Trip status'], 'rows' => $rows];
        case 'buses':
            $query = $pdo->query('SELECT name, reg_no, bus_type, total_seats, amenities, active, created_at FROM buses ORDER BY name');
            return ['title' => 'Bus list', 'headers' => ['Bus', 'Registration', 'Type', 'Seats', 'Amenities', 'Active', 'Created'], 'rows' => array_map(static fn(array $row): array => [$row['name'], $row['reg_no'], $row['bus_type'], $row['total_seats'], $row['amenities'], $row['active'] ? 'Yes' : 'No', $row['created_at']], $query->fetchAll())];
        case 'schedules':
            $query = $pdo->query(
                'SELECT cf.name AS from_city, ct.name AS to_city, b.name AS bus_name, b.reg_no,
                        s.depart_time, s.duration_min, s.fare, s.active, s.created_at
                 FROM schedules s JOIN routes r ON r.id = s.route_id
                 JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
                 JOIN buses b ON b.id = s.bus_id
                 ORDER BY cf.name, ct.name, s.depart_time'
            );
            return ['title' => 'Schedule list', 'headers' => ['Route', 'Bus', 'Registration', 'Departure', 'Duration minutes', 'Fare LKR', 'Active', 'Created'], 'rows' => array_map(static fn(array $row): array => [$row['from_city'] . ' → ' . $row['to_city'], $row['bus_name'], $row['reg_no'], substr($row['depart_time'], 0, 5), $row['duration_min'], $row['fare'], $row['active'] ? 'Yes' : 'No', $row['created_at']], $query->fetchAll())];
    }
    throw new RuntimeException('Unsupported report type.');
}

function admin_csv_cell($value): string
{
    $text = (string)($value ?? '');
    if ($text !== '' && preg_match('/^[\s]*[=+\-@]/u', $text)) {
        $text = "'" . $text;
    }
    return $text;
}

function admin_report_filters(PDO $pdo): array
{
    return [
        'routes' => $pdo->query(
            'SELECT r.id, cf.name AS from_city, ct.name AS to_city
             FROM routes r JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
             ORDER BY cf.name, ct.name'
        )->fetchAll(),
        'trips' => $pdo->query(
            'SELECT t.id, t.depart_date, t.depart_time, cf.name AS from_city, ct.name AS to_city, b.name AS bus_name
             FROM trips t JOIN routes r ON r.id = t.route_id
             JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
             JOIN buses b ON b.id = t.bus_id
             WHERE t.depart_date >= CURDATE()
             ORDER BY t.depart_date, t.depart_time LIMIT 500'
        )->fetchAll(),
    ];
}
