<?php
require __DIR__ . '/config.php';
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only', 'code' => 'postOnly'], 405);

$in    = json_in();
$ref   = strtoupper(trim($in['ref'] ?? ''));
$phone = preg_replace('/[^0-9+]/', '', $in['phone'] ?? '');
$user = current_user();
if (!$user && (!$ref || strlen($phone) < 9)) json_out(['error' => 'Enter booking reference and phone number.', 'code' => 'lookupFields'], 400);
$hasPhone = strlen($phone) >= 9;
$accessCondition = $user
    ? ($hasPhone ? '(bk.user_id = :uid OR bk.phone = :p)' : 'bk.user_id = :uid')
    : 'bk.phone = :p';

$pdo = db();
try {
    $pdo->beginTransaction();
    $q = $pdo->prepare(
        "SELECT bk.id, bk.status, t.depart_date, t.depart_time
         FROM bookings bk JOIN trips t ON t.id = bk.trip_id
         WHERE bk.ref = :r AND " . $accessCondition . " FOR UPDATE"
    );
    $params = [':r' => $ref];
    if ($user) $params[':uid'] = $user['id'];
    if (!$user || $hasPhone) $params[':p'] = $phone;
    $q->execute($params);
    $b = $q->fetch();
    if (!$b) throw new RuntimeException('Booking not found.');
    if ($b['status'] === 'cancelled') throw new RuntimeException('Already cancelled.');

    // must cancel at least 2 hours before departure
    if (strtotime($b['depart_date'] . ' ' . $b['depart_time']) - time() < 2 * 3600)
        throw new RuntimeException('Cancellation closes 2 hours before departure.');

    $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = :id")->execute([':id' => $b['id']]);
    $pdo->prepare("DELETE FROM booking_seats WHERE booking_id = :id")->execute([':id' => $b['id']]); // frees the seats
    $pdo->commit();
    json_out(['ok' => true]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $code = match ($e->getMessage()) {
        'Booking not found.' => 'bookingNotFound',
        'Already cancelled.' => 'alreadyCancelled',
        'Cancellation closes 2 hours before departure.' => 'cancellationClosed',
        default => 'cancelFailed',
    };
    json_out(['error' => $e->getMessage(), 'code' => $code], 400);
}
