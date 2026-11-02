<?php
require __DIR__ . '/config.php';
require __DIR__ . '/auth_helpers.php';

$ref   = strtoupper(trim($_GET['ref'] ?? ''));
$phone = preg_replace('/[^0-9+]/', '', $_GET['phone'] ?? '');
$user = current_user();

if (!$ref || (!$user && strlen($phone) < 9)) json_out(['error' => 'Enter booking reference and phone number.', 'code' => 'lookupFields'], 400);
$hasPhone = strlen($phone) >= 9;
$accessCondition = $user
    ? ($hasPhone ? '(bk.user_id = :uid OR bk.phone = :p)' : 'bk.user_id = :uid')
    : 'bk.phone = :p';

try {
    $stmt = db()->prepare(
        "SELECT bk.id, bk.ref, bk.passenger_name, bk.phone, bk.total, bk.status, bk.created_at,
                bk.group_ref, bk.leg,
                t.depart_date, t.depart_time, t.arrive_time,
                b.name AS bus_name, b.bus_type, b.reg_no,
                cf.name AS from_city, ct.name AS to_city
         FROM bookings bk
         JOIN trips t ON t.id = bk.trip_id
         JOIN routes r ON r.id = t.route_id
         JOIN buses b ON b.id = t.bus_id
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE bk.ref = :r AND " . $accessCondition
    );
    $params = [':r' => $ref];
    if ($user) $params[':uid'] = $user['id'];
    if (!$user || $hasPhone) $params[':p'] = $phone;
    $stmt->execute($params);
    $b = $stmt->fetch();
    if (!$b) json_out(['error' => 'No booking found. Check your reference and phone number.', 'code' => 'bookingNotFound'], 404);

    $s = db()->prepare("SELECT seat_no FROM booking_seats WHERE booking_id = :id ORDER BY seat_no");
    $s->execute([':id' => $b['id']]);
    $b['seats'] = array_map('intval', array_column($s->fetchAll(), 'seat_no'));
    if ($b['group_ref']) {
        $legsQuery = db()->prepare(
            "SELECT bk.id, bk.ref, bk.passenger_name, bk.phone, bk.total, bk.status, bk.created_at,
                    bk.group_ref, bk.leg,
                    t.depart_date, t.depart_time, t.arrive_time,
                    b.name AS bus_name, b.bus_type, b.reg_no,
                    cf.name AS from_city, ct.name AS to_city
             FROM bookings bk
             JOIN trips t ON t.id = bk.trip_id
             JOIN routes r ON r.id = t.route_id
             JOIN buses b ON b.id = t.bus_id
             JOIN cities cf ON cf.id = r.from_city
             JOIN cities ct ON ct.id = r.to_city
             WHERE bk.group_ref = :group_ref
             ORDER BY FIELD(bk.leg, 'outbound', 'return'), bk.id"
        );
        $legsQuery->execute([':group_ref' => $b['group_ref']]);
        $legs = $legsQuery->fetchAll();
        $seatQuery = db()->prepare("SELECT seat_no FROM booking_seats WHERE booking_id = :id ORDER BY seat_no");
        $grandTotal = 0;
        foreach ($legs as &$leg) {
            $seatQuery->execute([':id' => $leg['id']]);
            $leg['seats'] = array_map('intval', array_column($seatQuery->fetchAll(), 'seat_no'));
            $grandTotal += (float)$leg['total'];
            unset($leg['id']);
        }
        unset($leg);
        $b['legs'] = $legs;
        $b['grand_total'] = $grandTotal;
    }
    unset($b['id']);
    json_out(['booking' => $b]);
} catch (Throwable $e) {
    json_out(['error' => 'Lookup failed', 'code' => 'lookupFailed'], 500);
}
