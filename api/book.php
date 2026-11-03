<?php
require __DIR__ . '/config.php';
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only', 'code' => 'postOnly'], 405);

$in    = json_in();
$tripId = (int)($in['trip_id'] ?? 0);
$seats  = array_values(array_unique(array_map('intval', $in['seats'] ?? [])));
$name   = trim($in['name'] ?? '');
$phone  = preg_replace('/[^0-9+]/', '', $in['phone'] ?? '');
$email  = trim($in['email'] ?? '');
$user = current_user();

if (!$tripId || !$seats)              json_out(['error' => 'Select at least one seat.', 'code' => 'selectSeat'], 400);
if (count($seats) > 6)                json_out(['error' => 'Maximum 6 seats per booking.', 'code' => 'maxSeats'], 400);
if (strlen($name) < 2)                json_out(['error' => 'Enter passenger name.', 'code' => 'passengerName'], 400);
if (strlen($phone) < 9)               json_out(['error' => 'Enter a valid phone number.', 'code' => 'phoneValid'], 400);
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Invalid email.', 'code' => 'invalidEmail'], 400);

$pdo = db();
try {
    $pdo->beginTransaction();

    $t = $pdo->prepare("SELECT t.fare, t.depart_date, t.depart_time, t.status, b.total_seats,
                               b.active AS bus_active, r.active AS route_active
                        FROM trips t JOIN buses b ON b.id = t.bus_id
                        JOIN routes r ON r.id = t.route_id
                        WHERE t.id = :id FOR UPDATE");
    $t->execute([':id' => $tripId]);
    $trip = $t->fetch();
    if (!$trip) throw new RuntimeException('Trip not found');
    if ($trip['status'] !== 'scheduled') throw new RuntimeException('This trip was cancelled by the operator.');
    if (!(int)$trip['bus_active'] || !(int)$trip['route_active']) throw new RuntimeException('This trip is no longer available.');

    if ($trip['depart_date'] . ' ' . $trip['depart_time'] < date('Y-m-d H:i:s'))
        throw new RuntimeException('This bus has already departed.');

    foreach ($seats as $s) {
        if ($s < 1 || $s > (int)$trip['total_seats']) throw new RuntimeException('Invalid seat number.');
    }

    // unique booking reference
    do {
        $ref = 'TL' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $c = $pdo->prepare("SELECT 1 FROM bookings WHERE ref = :r");
        $c->execute([':r' => $ref]);
    } while ($c->fetch());

    $total = $trip['fare'] * count($seats);
    $pdo->prepare("INSERT INTO bookings (ref, trip_id, passenger_name, phone, email, user_id, total)
                   VALUES (:r, :t, :n, :p, :e, :u, :tot)")
        ->execute([
            ':r' => $ref,
            ':t' => $tripId,
            ':n' => $name,
            ':p' => $phone,
            ':e' => $email ?: null,
            ':u' => $user['id'] ?? null,
            ':tot' => $total,
        ]);
    $bookingId = (int)$pdo->lastInsertId();

    $ins = $pdo->prepare("INSERT INTO booking_seats (booking_id, trip_id, seat_no) VALUES (:b, :t, :s)");
    foreach ($seats as $s) {
        $ins->execute([':b' => $bookingId, ':t' => $tripId, ':s' => $s]);
    }

    $pdo->commit();
    json_out(['ok' => true, 'ref' => $ref, 'total' => $total, 'seats' => $seats]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    // 23000 = duplicate key -> someone took the seat first
    if ($e->getCode() === '23000') {
        json_out(array_merge([
            'error' => 'Sorry, one of the seats was just booked by someone else. Please pick again.',
            'code' => 'seatConflict',
            'conflict' => true,
        ], api_debug_exception($e)), 409);
    }
    json_out(array_merge([
        'error' => 'Booking failed. Please try again.',
        'code' => 'bookingFailed',
    ], api_debug_exception($e)), 500);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $code = match ($e->getMessage()) {
        'Trip not found' => 'tripNotFound',
        'This bus has already departed.' => 'departed',
        'This trip was cancelled by the operator.' => 'tripCancelled',
        'Invalid seat number.' => 'seatNumber',
        default => 'bookingFailed',
    };
    error_log('TripLink API exception: ' . $e->getMessage());
    $publicError = $code === 'bookingFailed' ? 'Booking failed. Please try again.' : $e->getMessage();
    $response = ['error' => $publicError, 'code' => $code];
    if (DEBUG) $response['debug_message'] = $e->getMessage();
    json_out($response, 400);
}
