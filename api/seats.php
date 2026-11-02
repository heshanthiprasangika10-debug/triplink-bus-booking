<?php
require __DIR__ . '/config.php';

$id = (int)($_GET['trip_id'] ?? 0);
try {
    $stmt = db()->prepare(
        "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time, t.fare,
                b.name AS bus_name, b.bus_type, b.total_seats, b.amenities,
                cf.name AS from_city, ct.name AS to_city
         FROM trips t
         JOIN routes r ON r.id = t.route_id
         JOIN buses b ON b.id = t.bus_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE t.id = :id"
    );
    $stmt->execute([':id' => $id]);
    $trip = $stmt->fetch();
    if (!$trip) json_out(['error' => 'Trip not found'], 404);

    $s = db()->prepare("SELECT seat_no FROM booking_seats WHERE trip_id = :id");
    $s->execute([':id' => $id]);
    $booked = array_map('intval', array_column($s->fetchAll(), 'seat_no'));

    json_out(['trip' => $trip, 'booked' => $booked]);
} catch (Throwable $e) {
    json_out(['error' => 'Could not load seats'], 500);
}
