<?php
require __DIR__ . '/config.php';
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$in = json_in();
$outbound = $in['outbound'] ?? null;
$return = $in['return'] ?? null;
$name = trim((string)($in['name'] ?? ''));
$phone = preg_replace('/[^0-9+]/', '', (string)($in['phone'] ?? ''));
$email = trim((string)($in['email'] ?? ''));
$user = current_user();

if (!is_array($outbound) || !is_array($return)) json_out(['error' => 'Select buses and seats for both legs.'], 400);
if (strlen($name) < 2 || strlen($name) > 100) json_out(['error' => 'Enter passenger name.'], 400);
if (strlen($phone) < 9 || strlen($phone) > 20) json_out(['error' => 'Enter a valid phone number.'], 400);
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Invalid email.'], 400);

$legs = [];
foreach (['outbound' => $outbound, 'return' => $return] as $legName => $legInput) {
    $tripId = filter_var($legInput['trip_id'] ?? null, FILTER_VALIDATE_INT);
    $seatInput = $legInput['seats'] ?? null;
    if (!$tripId || !is_array($seatInput) || !$seatInput) json_out(['error' => 'Select at least one seat for both legs.', 'leg' => $legName], 400);
    $seats = [];
    foreach ($seatInput as $seat) {
        $number = filter_var($seat, FILTER_VALIDATE_INT);
        if ($number === false || $number < 1) json_out(['error' => 'Invalid seat number.', 'leg' => $legName], 400);
        $seats[] = $number;
    }
    $seats = array_values(array_unique($seats));
    if (count($seats) > 6) json_out(['error' => 'Maximum 6 seats per leg.', 'leg' => $legName], 400);
    $legs[$legName] = ['trip_id' => (int)$tripId, 'seats' => $seats];
}
if ($legs['outbound']['trip_id'] === $legs['return']['trip_id']) {
    json_out(['error' => 'Outbound and return buses must be different trips.'], 400);
}

$pdo = db();
$activeLeg = 'outbound';
try {
    $pdo->beginTransaction();
    $tripQuery = $pdo->prepare(
        "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time, t.fare, t.status, b.total_seats,
                b.active AS bus_active, r.active AS route_active, r.from_city, r.to_city
         FROM trips t
         JOIN buses b ON b.id = t.bus_id
         JOIN routes r ON r.id = t.route_id
         WHERE t.id = :id
         FOR UPDATE"
    );
    $tripRows = [];
    $tripIds = [$legs['outbound']['trip_id'], $legs['return']['trip_id']];
    sort($tripIds, SORT_NUMERIC);
    foreach ($tripIds as $tripId) {
        $tripQuery->execute([':id' => $tripId]);
        $tripRows[$tripId] = $tripQuery->fetch();
    }
    $outTrip = $tripRows[$legs['outbound']['trip_id']] ?? false;
    $returnTrip = $tripRows[$legs['return']['trip_id']] ?? false;
    if (!$outTrip || !$returnTrip) throw new RuntimeException('One of the selected trips could not be found.');
    if ($outTrip['status'] !== 'scheduled' || $returnTrip['status'] !== 'scheduled') {
        throw new RuntimeException('One of the selected trips was cancelled by the operator.');
    }
    if (!(int)$outTrip['bus_active'] || !(int)$returnTrip['bus_active']
        || !(int)$outTrip['route_active'] || !(int)$returnTrip['route_active']) {
        throw new RuntimeException('One of the selected trips is no longer available.');
    }

    if ((int)$outTrip['from_city'] !== (int)$returnTrip['to_city']
        || (int)$outTrip['to_city'] !== (int)$returnTrip['from_city']) {
        throw new RuntimeException('The return bus must travel along the reverse route.');
    }
    foreach (['outbound' => $outTrip, 'return' => $returnTrip] as $legName => $trip) {
        $departAt = strtotime($trip['depart_date'] . ' ' . $trip['depart_time']);
        if ($departAt === false || $departAt < time()) {
            throw new RuntimeException(ucfirst($legName) . ' bus has already departed.');
        }
        foreach ($legs[$legName]['seats'] as $seat) {
            if ($seat > (int)$trip['total_seats']) {
                throw new RuntimeException('Invalid seat number for the ' . $legName . ' bus.');
            }
        }
    }

    if ($returnTrip['depart_date'] < $outTrip['depart_date']) {
        throw new RuntimeException('Return date must be on or after the outbound date.');
    }
    $arrivalAt = strtotime($outTrip['depart_date'] . ' ' . $outTrip['arrive_time']);
    if ($arrivalAt === false) throw new RuntimeException('Could not validate outbound arrival time.');
    if ($outTrip['arrive_time'] < $outTrip['depart_time']) $arrivalAt += 86400;
    $returnDepartAt = strtotime($returnTrip['depart_date'] . ' ' . $returnTrip['depart_time']);
    if ($returnDepartAt === false || $returnDepartAt <= $arrivalAt) {
        throw new RuntimeException('The return bus must depart after the outbound bus arrives.');
    }

    do {
        $groupRef = 'TLG' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 11));
        $check = $pdo->prepare('SELECT 1 FROM bookings WHERE group_ref = :group_ref LIMIT 1');
        $check->execute([':group_ref' => $groupRef]);
    } while ($check->fetchColumn());

    $results = [];
    foreach (['outbound', 'return'] as $legName) {
        $activeLeg = $legName;
        $trip = $tripRows[$legs[$legName]['trip_id']];
        do {
            $ref = 'TL' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $checkRef = $pdo->prepare('SELECT 1 FROM bookings WHERE ref = :ref');
            $checkRef->execute([':ref' => $ref]);
        } while ($checkRef->fetchColumn());

        $total = (float)$trip['fare'] * count($legs[$legName]['seats']);
        $insertBooking = $pdo->prepare(
            "INSERT INTO bookings
             (ref, trip_id, passenger_name, phone, email, user_id, group_ref, leg, total)
             VALUES (:ref, :trip_id, :name, :phone, :email, :user_id, :group_ref, :leg, :total)"
        );
        $insertBooking->execute([
            ':ref' => $ref,
            ':trip_id' => $trip['id'],
            ':name' => $name,
            ':phone' => $phone,
            ':email' => $email ?: null,
            ':user_id' => $user['id'] ?? null,
            ':group_ref' => $groupRef,
            ':leg' => $legName,
            ':total' => $total,
        ]);
        $bookingId = (int)$pdo->lastInsertId();

        $insertSeat = $pdo->prepare('INSERT INTO booking_seats (booking_id, trip_id, seat_no) VALUES (:booking_id, :trip_id, :seat_no)');
        foreach ($legs[$legName]['seats'] as $seat) {
            $insertSeat->execute([':booking_id' => $bookingId, ':trip_id' => $trip['id'], ':seat_no' => $seat]);
        }
        $results[$legName] = ['ref' => $ref, 'seats' => $legs[$legName]['seats'], 'total' => $total];
    }

    $pdo->commit();
    json_out([
        'ok' => true,
        'group_ref' => $groupRef,
        'outbound' => $results['outbound'],
        'return' => $results['return'],
        'grand_total' => $results['outbound']['total'] + $results['return']['total'],
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() === '23000') {
        json_out([
            'error' => 'One or more selected seats were just booked by someone else. Please choose another seat.',
            'conflict' => true,
            'leg' => $activeLeg,
        ], 409);
    }
    json_out(['error' => 'Round-trip booking failed. Please try again.'], 500);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_out(['error' => $e->getMessage(), 'leg' => $activeLeg], 400);
}
