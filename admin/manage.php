<?php
require __DIR__ . '/_helpers.php';
admin_require_login();
admin_verify_post();

$section = (string)($_GET['section'] ?? $_POST['section'] ?? 'buses');
$allowedSections = ['buses', 'routes', 'cities', 'schedules', 'trips', 'audit'];
if (!in_array($section, $allowedSections, true)) {
    $section = 'buses';
}
$pdo = db();

function admin_schedule_conflict(PDO $pdo, int $busId, string $departTime, int $duration, int $excludeId = 0): bool
{
    $query = $pdo->prepare(
        'SELECT id, depart_time, duration_min FROM schedules
         WHERE bus_id = :bus_id AND active = 1 AND id <> :exclude_id'
    );
    $query->execute([':bus_id' => $busId, ':exclude_id' => $excludeId]);
    [$hour, $minute] = array_map('intval', explode(':', substr($departTime, 0, 5)));
    $start = $hour * 60 + $minute;
    foreach ($query->fetchAll() as $existing) {
        [$existingHour, $existingMinute] = array_map('intval', explode(':', substr($existing['depart_time'], 0, 5)));
        $existingStart = $existingHour * 60 + $existingMinute;
        $existingEnd = $existingStart + (int)$existing['duration_min'];
        foreach ([-1440, 0, 1440] as $shift) {
            $candidateStart = $start + $shift;
            $candidateEnd = $candidateStart + $duration;
            if ($candidateStart < $existingEnd && $existingStart < $candidateEnd) {
                return true;
            }
        }
    }
    return false;
}

function admin_form_value(string $key, string $fallback = ''): string
{
    return trim((string)($_POST[$key] ?? $fallback));
}

function admin_booked_future_trip_count(PDO $pdo, int $scheduleId): int
{
    $query = $pdo->prepare(
        'SELECT COUNT(*) FROM trips t WHERE t.schedule_id = :schedule_id
         AND TIMESTAMP(t.depart_date, t.depart_time) >= NOW()
         AND EXISTS (SELECT 1 FROM bookings bk WHERE bk.trip_id = t.id)'
    );
    $query->execute([':schedule_id' => $scheduleId]);
    return (int)$query->fetchColumn();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string)($_POST['action'] ?? '');
    try {
        $pdo->beginTransaction();
        switch ($action) {
            case 'bus_save': {
                $id = (int)($_POST['id'] ?? 0);
                $name = admin_form_value('name');
                $regNo = strtoupper(admin_form_value('reg_no'));
                $type = admin_form_value('bus_type');
                $seats = filter_var($_POST['total_seats'] ?? null, FILTER_VALIDATE_INT);
                $allowedTypes = ['Normal', 'Semi Luxury', 'Luxury', 'Super Luxury'];
                if (mb_strlen($name) < 2 || mb_strlen($name) > 80) throw new RuntimeException('Bus name must be 2–80 characters.');
                if (!preg_match('/^[A-Z]{2,3}-\d{4}$/', $regNo)) throw new RuntimeException('Registration must look like NB-4521.');
                if (!in_array($type, $allowedTypes, true)) throw new RuntimeException('Choose a valid bus type.');
                if ($seats === false || $seats < 16 || $seats > 60 || $seats % 4 !== 0) throw new RuntimeException('Seats must be 16–60 and a multiple of 4.');
                $regCheck = $pdo->prepare('SELECT COUNT(*) FROM buses WHERE reg_no = :reg_no AND id <> :id');
                $regCheck->execute([':reg_no' => $regNo, ':id' => $id]);
                if ((int)$regCheck->fetchColumn() > 0) throw new RuntimeException('That registration number is already assigned to another bus.');
                $allowedAmenities = ['AC', 'WiFi', 'Charging', 'Reclining Seats', 'Toilet', 'TV'];
                $amenities = array_values(array_unique(array_intersect($allowedAmenities, (array)($_POST['amenities'] ?? []))));
                $active = isset($_POST['active']) ? 1 : 0;
                if ($id) {
                    $existingQuery = $pdo->prepare('SELECT total_seats, active FROM buses WHERE id = :id FOR UPDATE');
                    $existingQuery->execute([':id' => $id]);
                    $oldBus = $existingQuery->fetch();
                    if (!$oldBus) throw new RuntimeException('Bus not found.');
                    if ($seats < (int)$oldBus['total_seats']) {
                        $overLimit = $pdo->prepare(
                            "SELECT COUNT(DISTINCT t.id) FROM trips t
                             JOIN booking_seats bs ON bs.trip_id = t.id
                             JOIN bookings bk ON bk.id = bs.booking_id AND bk.status = 'confirmed'
                             WHERE t.bus_id = :bus_id AND TIMESTAMP(t.depart_date, t.depart_time) >= NOW()
                               AND bs.seat_no > :seat_limit"
                        );
                        $overLimit->execute([':bus_id' => $id, ':seat_limit' => $seats]);
                        if ((int)$overLimit->fetchColumn() > 0) throw new RuntimeException('Seat capacity cannot be reduced: future bookings include seats above the new limit.');
                    }
                    $statement = $pdo->prepare(
                        'UPDATE buses SET name = :name, reg_no = :reg_no, bus_type = :bus_type,
                         total_seats = :total_seats, amenities = :amenities, active = :active WHERE id = :id'
                    );
                    $statement->execute([':name' => $name, ':reg_no' => $regNo, ':bus_type' => $type, ':total_seats' => $seats, ':amenities' => implode(',', $amenities), ':active' => $active, ':id' => $id]);
                    $busAction = (int)$oldBus['active'] !== $active ? ($active ? 'activate' : 'deactivate') : 'update';
                    admin_audit($pdo, $busAction, 'bus', $id, ['name' => $name, 'reg_no' => $regNo, 'bus_type' => $type, 'total_seats' => $seats, 'amenities' => $amenities, 'active' => $active]);
                    $message = 'Bus updated.';
                } else {
                    $statement = $pdo->prepare(
                        'INSERT INTO buses (name, reg_no, bus_type, total_seats, amenities, active)
                         VALUES (:name, :reg_no, :bus_type, :total_seats, :amenities, :active)'
                    );
                    $statement->execute([':name' => $name, ':reg_no' => $regNo, ':bus_type' => $type, ':total_seats' => $seats, ':amenities' => implode(',', $amenities), ':active' => $active]);
                    $id = (int)$pdo->lastInsertId();
                    admin_audit($pdo, 'create', 'bus', $id, ['name' => $name, 'reg_no' => $regNo, 'bus_type' => $type]);
                    $message = 'Bus created.';
                }
                $pdo->commit();
                admin_redirect('buses', 'success', $message);
            }
            case 'bus_deactivate': {
                $id = admin_id($_POST['id'] ?? 0);
                $active = (int)($_POST['active'] ?? 0) === 1 ? 1 : 0;
                $pdo->prepare('UPDATE buses SET active = :active WHERE id = :id')->execute([':active' => $active, ':id' => $id]);
                admin_audit($pdo, $active ? 'activate' : 'deactivate', 'bus', $id);
                $pdo->commit();
                admin_redirect('buses', 'success', $active ? 'Bus activated.' : 'Bus deactivated.');
            }
            case 'bus_delete': {
                $id = admin_id($_POST['id'] ?? 0);
                $usage = $pdo->prepare('SELECT COUNT(*) FROM trips WHERE bus_id = :id');
                $usage->execute([':id' => $id]);
                if ((int)$usage->fetchColumn() > 0) throw new RuntimeException('This bus has trips. Deactivate it instead of deleting it.');
                $pdo->prepare('DELETE FROM buses WHERE id = :id')->execute([':id' => $id]);
                admin_audit($pdo, 'delete', 'bus', $id);
                $pdo->commit();
                admin_redirect('buses', 'success', 'Bus deleted.');
            }
            case 'route_save': {
                $id = (int)($_POST['id'] ?? 0);
                $from = admin_id($_POST['from_city'] ?? 0);
                $to = admin_id($_POST['to_city'] ?? 0);
                $distance = filter_var($_POST['distance_km'] ?? null, FILTER_VALIDATE_INT);
                $active = isset($_POST['active']) ? 1 : 0;
                if ($from === $to) throw new RuntimeException('Origin and destination must be different.');
                if ($distance === false || $distance < 1 || $distance > 3000) throw new RuntimeException('Distance must be between 1 and 3000 km.');
                $cityCheck = $pdo->prepare('SELECT COUNT(*) FROM cities WHERE id IN (:from_city, :to_city)');
                $cityCheck->execute([':from_city' => $from, ':to_city' => $to]);
                if ((int)$cityCheck->fetchColumn() !== 2) throw new RuntimeException('Choose two existing cities.');
                if ($id) {
                    $oldRouteQuery = $pdo->prepare('SELECT active FROM routes WHERE id = :id FOR UPDATE');
                    $oldRouteQuery->execute([':id' => $id]);
                    $oldRoute = $oldRouteQuery->fetch();
                    if (!$oldRoute) throw new RuntimeException('Route not found.');
                    $pdo->prepare('UPDATE routes SET from_city = :from_city, to_city = :to_city, distance_km = :distance, active = :active WHERE id = :id')
                        ->execute([':from_city' => $from, ':to_city' => $to, ':distance' => $distance, ':active' => $active, ':id' => $id]);
                    $routeAction = (int)$oldRoute['active'] !== $active ? ($active ? 'activate' : 'deactivate') : 'update';
                    admin_audit($pdo, $routeAction, 'route', $id, ['from_city' => $from, 'to_city' => $to, 'distance_km' => $distance, 'active' => $active]);
                    $message = 'Route updated.';
                } else {
                    $pdo->prepare('INSERT INTO routes (from_city, to_city, distance_km, active) VALUES (:from_city, :to_city, :distance, :active)')
                        ->execute([':from_city' => $from, ':to_city' => $to, ':distance' => $distance, ':active' => $active]);
                    $id = (int)$pdo->lastInsertId();
                    admin_audit($pdo, 'create', 'route', $id, ['from_city' => $from, 'to_city' => $to, 'distance_km' => $distance]);
                    $message = 'Route created.';
                    if (isset($_POST['reverse'])) {
                        $reverse = $pdo->prepare('SELECT id FROM routes WHERE from_city = :from_city AND to_city = :to_city');
                        $reverse->execute([':from_city' => $to, ':to_city' => $from]);
                        if (!$reverse->fetchColumn()) {
                            $pdo->prepare('INSERT INTO routes (from_city, to_city, distance_km, active) VALUES (:from_city, :to_city, :distance, :active)')
                                ->execute([':from_city' => $to, ':to_city' => $from, ':distance' => $distance, ':active' => $active]);
                            $reverseId = (int)$pdo->lastInsertId();
                            admin_audit($pdo, 'create', 'route', $reverseId, ['from_city' => $to, 'to_city' => $from, 'distance_km' => $distance, 'reverse_of' => $id]);
                            $message = 'Route and reverse route created.';
                        } else {
                            $message = 'Route created; the reverse route already existed.';
                        }
                    }
                }
                $pdo->commit();
                admin_redirect('routes', 'success', $message);
            }
            case 'route_state': {
                $id = admin_id($_POST['id'] ?? 0);
                $active = (int)($_POST['active'] ?? 0) === 1 ? 1 : 0;
                $pdo->prepare('UPDATE routes SET active = :active WHERE id = :id')->execute([':active' => $active, ':id' => $id]);
                admin_audit($pdo, $active ? 'activate' : 'deactivate', 'route', $id);
                $pdo->commit();
                admin_redirect('routes', 'success', $active ? 'Route activated.' : 'Route deactivated.');
            }
            case 'route_delete': {
                $id = admin_id($_POST['id'] ?? 0);
                $usage = $pdo->prepare('SELECT COUNT(*) FROM trips WHERE route_id = :id');
                $usage->execute([':id' => $id]);
                if ((int)$usage->fetchColumn() > 0) throw new RuntimeException('This route has trips. Deactivate it instead of deleting it.');
                $pdo->prepare('DELETE FROM routes WHERE id = :id')->execute([':id' => $id]);
                admin_audit($pdo, 'delete', 'route', $id);
                $pdo->commit();
                admin_redirect('routes', 'success', 'Route deleted.');
            }
            case 'city_save': {
                $id = (int)($_POST['id'] ?? 0);
                $name = admin_form_value('name');
                $lat = admin_form_value('lat');
                $lng = admin_form_value('lng');
                if (mb_strlen($name) < 2 || mb_strlen($name) > 60) throw new RuntimeException('City name must be 2–60 characters.');
                if (($lat === '') !== ($lng === '')) throw new RuntimeException('Enter both coordinates or leave both blank.');
                $latValue = $lat === '' ? null : filter_var($lat, FILTER_VALIDATE_FLOAT);
                $lngValue = $lng === '' ? null : filter_var($lng, FILTER_VALIDATE_FLOAT);
                if ($lat !== '' && ($latValue === false || $latValue < -90 || $latValue > 90)) throw new RuntimeException('Latitude must be between -90 and 90.');
                if ($lng !== '' && ($lngValue === false || $lngValue < -180 || $lngValue > 180)) throw new RuntimeException('Longitude must be between -180 and 180.');
                if ($id) {
                    $pdo->prepare('UPDATE cities SET name = :name, lat = :lat, lng = :lng WHERE id = :id')
                        ->execute([':name' => $name, ':lat' => $latValue, ':lng' => $lngValue, ':id' => $id]);
                    admin_audit($pdo, 'update', 'city', $id, ['name' => $name, 'lat' => $latValue, 'lng' => $lngValue]);
                    $message = 'City updated.';
                } else {
                    $pdo->prepare('INSERT INTO cities (name, lat, lng) VALUES (:name, :lat, :lng)')
                        ->execute([':name' => $name, ':lat' => $latValue, ':lng' => $lngValue]);
                    $id = (int)$pdo->lastInsertId();
                    admin_audit($pdo, 'create', 'city', $id, ['name' => $name, 'lat' => $latValue, 'lng' => $lngValue]);
                    $message = 'City created.';
                }
                $pdo->commit();
                admin_redirect('cities', 'success', $message);
            }
            case 'city_delete': {
                $id = admin_id($_POST['id'] ?? 0);
                $usage = $pdo->prepare('SELECT COUNT(*) FROM routes WHERE from_city = :id OR to_city = :id');
                $usage->execute([':id' => $id]);
                if ((int)$usage->fetchColumn() > 0) throw new RuntimeException('This city is used by routes. Keep it or remove its routes first.');
                $pdo->prepare('DELETE FROM cities WHERE id = :id')->execute([':id' => $id]);
                admin_audit($pdo, 'delete', 'city', $id);
                $pdo->commit();
                admin_redirect('cities', 'success', 'City deleted.');
            }
            case 'schedule_save': {
                $id = (int)($_POST['id'] ?? 0);
                $routeId = admin_id($_POST['route_id'] ?? 0);
                $busId = admin_id($_POST['bus_id'] ?? 0);
                $departTime = admin_form_value('depart_time');
                $duration = filter_var($_POST['duration_min'] ?? null, FILTER_VALIDATE_INT);
                $fare = filter_var($_POST['fare'] ?? null, FILTER_VALIDATE_FLOAT);
                $active = isset($_POST['active']) ? 1 : 0;
                if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $departTime)) throw new RuntimeException('Enter a valid departure time.');
                if ($duration === false || $duration < 1 || $duration >= 1440) throw new RuntimeException('Trip duration must be from 1 to 1439 minutes.');
                if ($fare === false || $fare <= 0 || $fare > 1000000) throw new RuntimeException('Fare must be greater than zero.');
                $validEntities = $pdo->prepare(
                    'SELECT (SELECT COUNT(*) FROM routes WHERE id = :route_id AND active = 1) AS routes,
                            (SELECT COUNT(*) FROM buses WHERE id = :bus_id AND active = 1) AS buses'
                );
                $validEntities->execute([':route_id' => $routeId, ':bus_id' => $busId]);
                $valid = $validEntities->fetch();
                if ((int)$valid['routes'] !== 1 || (int)$valid['buses'] !== 1) throw new RuntimeException('Choose an active route and an active bus.');
                if ($active && admin_schedule_conflict($pdo, $busId, $departTime, $duration, $id)) throw new RuntimeException('This bus already has a schedule that overlaps this trip, including across midnight.');
                $kept = 0;
                $changed = 0;
                if ($id) {
                    $scheduleQuery = $pdo->prepare('SELECT * FROM schedules WHERE id = :id FOR UPDATE');
                    $scheduleQuery->execute([':id' => $id]);
                    $oldSchedule = $scheduleQuery->fetch();
                    if (!$oldSchedule) throw new RuntimeException('Schedule not found.');
                    $kept = admin_booked_future_trip_count($pdo, $id);
                    $pdo->prepare(
                        'UPDATE schedules SET route_id = :route_id, bus_id = :bus_id, depart_time = :depart_time,
                         duration_min = :duration_min, fare = :fare, active = :active WHERE id = :id'
                    )->execute([':route_id' => $routeId, ':bus_id' => $busId, ':depart_time' => $departTime . ':00', ':duration_min' => $duration, ':fare' => $fare, ':active' => $active, ':id' => $id]);
                    if ($active) {
                        $updateTrips = $pdo->prepare(
                            'UPDATE trips t
                             SET route_id = :route_id, bus_id = :bus_id, depart_time = :depart_time,
                                 arrive_time = SEC_TO_TIME(MOD(TIME_TO_SEC(:arrival_base) + :duration_seconds, 86400)),
                                 fare = :fare
                             WHERE t.schedule_id = :schedule_id
                               AND TIMESTAMP(t.depart_date, t.depart_time) >= NOW()
                               AND NOT EXISTS (SELECT 1 FROM bookings bk WHERE bk.trip_id = t.id)'
                        );
                        $updateTrips->execute([
                            ':route_id' => $routeId, ':bus_id' => $busId,
                            ':depart_time' => $departTime . ':00',
                            ':arrival_base' => $departTime . ':00',
                            ':duration_seconds' => $duration * 60,
                            ':fare' => $fare, ':schedule_id' => $id,
                        ]);
                        $changed += $updateTrips->rowCount();
                    } else {
                        $deleteTrips = $pdo->prepare(
                            'DELETE t FROM trips t
                             WHERE t.schedule_id = :schedule_id
                               AND TIMESTAMP(t.depart_date, t.depart_time) >= NOW()
                               AND NOT EXISTS (SELECT 1 FROM bookings bk WHERE bk.trip_id = t.id)'
                        );
                        $deleteTrips->execute([':schedule_id' => $id]);
                        $changed += $deleteTrips->rowCount();
                    }
                    $scheduleAction = (int)$oldSchedule['active'] !== $active ? ($active ? 'activate' : 'deactivate') : 'update';
                    admin_audit($pdo, $scheduleAction, 'schedule', $id, ['route_id' => $routeId, 'bus_id' => $busId, 'depart_time' => $departTime, 'duration_min' => $duration, 'fare' => $fare, 'active' => $active, 'future_trips_changed' => $changed, 'future_trips_kept_booked' => $kept]);
                    $message = "Schedule updated. $changed future trip(s) updated/removed; $kept kept because they have bookings.";
                } else {
                    $insertSchedule = $pdo->prepare(
                        'INSERT INTO schedules (route_id, bus_id, depart_time, duration_min, fare, active)
                         VALUES (:route_id, :bus_id, :depart_time, :duration_min, :fare, :active)'
                    );
                    $insertSchedule->execute([':route_id' => $routeId, ':bus_id' => $busId, ':depart_time' => $departTime . ':00', ':duration_min' => $duration, ':fare' => $fare, ':active' => $active]);
                    $id = (int)$pdo->lastInsertId();
                    admin_audit($pdo, 'create', 'schedule', $id, ['route_id' => $routeId, 'bus_id' => $busId, 'depart_time' => $departTime, 'duration_min' => $duration, 'fare' => $fare, 'active' => $active]);
                    $message = 'Schedule created.';
                }
                $pdo->commit();
                admin_redirect('schedules', 'success', $message);
            }
            case 'schedule_delete': {
                $id = admin_id($_POST['id'] ?? 0);
                $usage = $pdo->prepare('SELECT COUNT(*) FROM trips WHERE schedule_id = :id');
                $usage->execute([':id' => $id]);
                if ((int)$usage->fetchColumn() > 0) throw new RuntimeException('This schedule has generated trips. Deactivate it instead of deleting it.');
                $pdo->prepare('DELETE FROM schedules WHERE id = :id')->execute([':id' => $id]);
                admin_audit($pdo, 'delete', 'schedule', $id);
                $pdo->commit();
                admin_redirect('schedules', 'success', 'Schedule deleted.');
            }
            case 'generate_trips': {
                $days = filter_var($_POST['days'] ?? null, FILTER_VALIDATE_INT);
                if ($days === false || $days < 1 || $days > 365) throw new RuntimeException('Generate between 1 and 365 days.');
                $today = new DateTimeImmutable('today');
                $generated = 0;
                $countBefore = $pdo->prepare(
                    'SELECT COUNT(*) FROM trips t JOIN schedules s ON s.id = t.schedule_id
                     WHERE t.depart_date BETWEEN :from_date AND :to_date AND s.active = 1'
                );
                $countBefore->execute([':from_date' => $today->format('Y-m-d'), ':to_date' => $today->modify('+' . ($days - 1) . ' days')->format('Y-m-d')]);
                $before = (int)$countBefore->fetchColumn();
                for ($offset = 0; $offset < $days; $offset++) {
                    ensure_trips($today->modify("+$offset days")->format('Y-m-d'));
                }
                $countBefore->execute([':from_date' => $today->format('Y-m-d'), ':to_date' => $today->modify('+' . ($days - 1) . ' days')->format('Y-m-d')]);
                $generated = (int)$countBefore->fetchColumn() - $before;
                admin_audit($pdo, 'generate', 'trips', null, ['days' => $days, 'created' => $generated]);
                $pdo->commit();
                admin_redirect('trips', 'success', "$generated trip(s) generated for the next $days day(s).");
            }
            case 'trip_state': {
                $id = admin_id($_POST['id'] ?? 0);
                $status = (string)($_POST['status'] ?? '');
                if (!in_array($status, ['scheduled', 'cancelled'], true)) throw new RuntimeException('Invalid trip status.');
                $query = $pdo->prepare('SELECT status, depart_date, depart_time FROM trips WHERE id = :id FOR UPDATE');
                $query->execute([':id' => $id]);
                $trip = $query->fetch();
                if (!$trip) throw new RuntimeException('Trip not found.');
                if (strtotime($trip['depart_date'] . ' ' . $trip['depart_time']) < time()) throw new RuntimeException('A departed trip cannot be changed.');
                $pdo->prepare('UPDATE trips SET status = :status WHERE id = :id')->execute([':status' => $status, ':id' => $id]);
                admin_audit($pdo, $status === 'cancelled' ? 'cancel' : 'restore', 'trip', $id, ['status' => $status, 'notification' => 'Passenger notification hook not configured.']);
                $pdo->commit();
                admin_redirect('trips', 'success', $status === 'cancelled'
                    ? 'Trip marked cancelled. Booking and seat records were retained; passenger notification is not configured.'
                    : 'Trip restored.');
            }
            default:
                throw new RuntimeException('Unknown management action.');
        }
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('TripLink admin management error: ' . $error->getMessage());
        $isDuplicate = $error instanceof PDOException && $error->getCode() === '23000';
        $message = $error instanceof PDOException
            ? ($isDuplicate ? 'A record with those details already exists.' : 'Could not save your changes. Please try again.')
            : $error->getMessage();
        admin_redirect($section, 'error', $message);
    }
}

$cities = $pdo->query('SELECT id, name, lat, lng FROM cities ORDER BY name')->fetchAll();
$routes = $pdo->query(
    'SELECT r.id, r.from_city, r.to_city, r.distance_km, r.active,
            cf.name AS from_name, ct.name AS to_name,
            (SELECT COUNT(*) FROM trips t WHERE t.route_id = r.id) AS trip_count
     FROM routes r JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
     ORDER BY r.active DESC, cf.name, ct.name'
)->fetchAll();
$buses = $pdo->query(
    'SELECT b.id, b.name, b.reg_no, b.bus_type, b.total_seats, b.amenities, b.active,
            (SELECT COUNT(*) FROM trips t WHERE t.bus_id = b.id) AS trip_count
     FROM buses b ORDER BY b.active DESC, b.name'
)->fetchAll();
$schedules = $pdo->query(
    'SELECT s.id, s.route_id, s.bus_id, s.depart_time, s.duration_min, s.fare, s.active,
            cf.name AS from_name, ct.name AS to_name, b.name AS bus_name,
            (SELECT COUNT(*) FROM trips t WHERE t.schedule_id = s.id) AS trip_count
     FROM schedules s JOIN routes r ON r.id = s.route_id
     JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
     JOIN buses b ON b.id = s.bus_id
     ORDER BY s.active DESC, s.depart_time'
)->fetchAll();
$flash = admin_flash();
$csrfToken = admin_token();
$titles = ['buses' => 'Buses', 'routes' => 'Routes', 'cities' => 'Cities', 'schedules' => 'Schedules', 'trips' => 'Trips', 'audit' => 'Audit log'];
require __DIR__ . '/_layout.php';
admin_page_start($csrfToken, $titles[$section], $section, false);
?>
<?php if ($flash): ?><div class="admin-flash <?= admin_escape($flash['type']) ?>" role="<?= $flash['type'] === 'error' ? 'alert' : 'status' ?>"><?= admin_escape($flash['message']) ?></div><?php endif; ?>
<?php if ($section === 'buses'): ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Bus fleet</h2><p>Manage buses without removing records used by trips.</p></div></div>
    <details class="admin-card admin-form-card" open>
      <summary>Add a bus</summary>
      <form method="post" class="admin-form-grid">
        <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="buses"><input type="hidden" name="action" value="bus_save">
        <label>Bus name<input name="name" required minlength="2" maxlength="80"></label>
        <label>Registration number<input name="reg_no" required pattern="[A-Za-z]{2,3}-[0-9]{4}" placeholder="NB-4521"></label>
        <label>Bus type<select name="bus_type" required><?php foreach (['Normal', 'Semi Luxury', 'Luxury', 'Super Luxury'] as $type): ?><option><?= admin_escape($type) ?></option><?php endforeach; ?></select></label>
        <label>Total seats<input type="number" name="total_seats" min="16" max="60" step="4" value="40" required></label>
        <fieldset><legend>Amenities</legend><?php foreach (['AC', 'WiFi', 'Charging', 'Reclining Seats', 'Toilet', 'TV'] as $amenity): ?><label class="admin-inline-check"><input type="checkbox" name="amenities[]" value="<?= admin_escape($amenity) ?>"><?= admin_escape($amenity) ?></label><?php endforeach; ?></fieldset>
        <label class="admin-inline-check"><input type="checkbox" name="active" checked> Active</label>
        <button class="btn gold" type="submit">Create bus</button>
      </form>
    </details>
    <div class="admin-managed-list"><?php foreach ($buses as $bus): ?>
      <details class="admin-card admin-record">
        <summary><span><b><?= admin_escape($bus['name']) ?></b> <small><?= admin_escape($bus['reg_no']) ?> · <?= admin_escape($bus['bus_type']) ?> · <?= (int)$bus['total_seats'] ?> seats</small></span><span class="admin-status <?= $bus['active'] ? 'confirmed' : 'cancelled' ?>"><?= $bus['active'] ? 'Active' : 'Inactive' ?></span></summary>
        <form method="post" class="admin-form-grid">
          <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="buses"><input type="hidden" name="action" value="bus_save"><input type="hidden" name="id" value="<?= (int)$bus['id'] ?>">
          <label>Bus name<input name="name" required minlength="2" maxlength="80" value="<?= admin_escape($bus['name']) ?>"></label>
          <label>Registration number<input name="reg_no" required pattern="[A-Za-z]{2,3}-[0-9]{4}" value="<?= admin_escape($bus['reg_no']) ?>"></label>
          <label>Bus type<select name="bus_type"><?php foreach (['Normal', 'Semi Luxury', 'Luxury', 'Super Luxury'] as $type): ?><option <?= $bus['bus_type'] === $type ? 'selected' : '' ?>><?= admin_escape($type) ?></option><?php endforeach; ?></select></label>
          <label>Total seats<input type="number" name="total_seats" min="16" max="60" step="4" value="<?= (int)$bus['total_seats'] ?>"></label>
          <fieldset><legend>Amenities</legend><?php foreach (['AC', 'WiFi', 'Charging', 'Reclining Seats', 'Toilet', 'TV'] as $amenity): ?><label class="admin-inline-check"><input type="checkbox" name="amenities[]" value="<?= admin_escape($amenity) ?>" <?= in_array($amenity, explode(',', (string)$bus['amenities']), true) ? 'checked' : '' ?>><?= admin_escape($amenity) ?></label><?php endforeach; ?></fieldset>
          <label class="admin-inline-check"><input type="checkbox" name="active" <?= $bus['active'] ? 'checked' : '' ?>> Active</label>
          <div class="admin-form-actions"><button class="btn gold" type="submit">Save changes</button></div>
        </form>
        <div class="admin-inline-actions">
          <form method="post"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="buses"><input type="hidden" name="action" value="bus_deactivate"><input type="hidden" name="id" value="<?= (int)$bus['id'] ?>"><input type="hidden" name="active" value="<?= $bus['active'] ? 0 : 1 ?>"><button class="admin-secondary-button" type="submit"><?= $bus['active'] ? 'Deactivate' : 'Activate' ?></button></form>
          <?php if (!(int)$bus['trip_count']): ?><form method="post" onsubmit="return confirm('Delete this bus?')"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="buses"><input type="hidden" name="action" value="bus_delete"><input type="hidden" name="id" value="<?= (int)$bus['id'] ?>"><button class="admin-danger-button" type="submit">Delete</button></form><?php else: ?><small><?= (int)$bus['trip_count'] ?> linked trips · deactivate instead</small><?php endif; ?>
        </div>
      </details>
    <?php endforeach; ?></div>
  </section>
<?php elseif ($section === 'routes'): ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Routes</h2><p>Create routes and their reverse directions, or deactivate routes used by trips.</p></div><a class="admin-secondary-button" href="manage.php?section=cities">Manage cities</a></div>
    <details class="admin-card admin-form-card" open><summary>Add a route</summary>
      <form method="post" class="admin-form-grid">
        <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="routes"><input type="hidden" name="action" value="route_save">
        <label>From city<select name="from_city" required><option value="">Select city</option><?php foreach ($cities as $city): ?><option value="<?= (int)$city['id'] ?>"><?= admin_escape($city['name']) ?></option><?php endforeach; ?></select></label>
        <label>To city<select name="to_city" required><option value="">Select city</option><?php foreach ($cities as $city): ?><option value="<?= (int)$city['id'] ?>"><?= admin_escape($city['name']) ?></option><?php endforeach; ?></select></label>
        <label>Distance (km)<input type="number" name="distance_km" min="1" max="3000" required></label>
        <label class="admin-inline-check"><input type="checkbox" name="reverse"> Create reverse route too</label>
        <label class="admin-inline-check"><input type="checkbox" name="active" checked> Active</label>
        <button class="btn gold" type="submit">Create route</button>
      </form>
    </details>
    <div class="admin-managed-list"><?php foreach ($routes as $route): ?>
      <details class="admin-card admin-record">
        <summary><span><b><?= admin_escape($route['from_name']) ?> → <?= admin_escape($route['to_name']) ?></b><small><?= (int)$route['distance_km'] ?> km</small></span><span class="admin-status <?= $route['active'] ? 'confirmed' : 'cancelled' ?>"><?= $route['active'] ? 'Active' : 'Inactive' ?></span></summary>
        <form method="post" class="admin-form-grid">
          <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="routes"><input type="hidden" name="action" value="route_save"><input type="hidden" name="id" value="<?= (int)$route['id'] ?>">
          <label>From city<select name="from_city"><?php foreach ($cities as $city): ?><option value="<?= (int)$city['id'] ?>" <?= (int)$route['from_city'] === (int)$city['id'] ? 'selected' : '' ?>><?= admin_escape($city['name']) ?></option><?php endforeach; ?></select></label>
          <label>To city<select name="to_city"><?php foreach ($cities as $city): ?><option value="<?= (int)$city['id'] ?>" <?= (int)$route['to_city'] === (int)$city['id'] ? 'selected' : '' ?>><?= admin_escape($city['name']) ?></option><?php endforeach; ?></select></label>
          <label>Distance (km)<input type="number" name="distance_km" min="1" max="3000" value="<?= (int)$route['distance_km'] ?>"></label>
          <label class="admin-inline-check"><input type="checkbox" name="active" <?= $route['active'] ? 'checked' : '' ?>> Active</label>
          <button type="submit" class="btn gold">Save changes</button>
        </form>
        <div class="admin-inline-actions">
          <form method="post"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="routes"><input type="hidden" name="action" value="route_state"><input type="hidden" name="id" value="<?= (int)$route['id'] ?>"><input type="hidden" name="active" value="<?= $route['active'] ? 0 : 1 ?>"><button class="admin-secondary-button" type="submit"><?= $route['active'] ? 'Deactivate' : 'Activate' ?></button></form>
          <?php if (!(int)$route['trip_count']): ?><form method="post" onsubmit="return confirm('Delete this route?')"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="routes"><input type="hidden" name="action" value="route_delete"><input type="hidden" name="id" value="<?= (int)$route['id'] ?>"><button type="submit" class="admin-danger-button">Delete</button></form><?php else: ?><small><?= (int)$route['trip_count'] ?> linked trips · deactivate instead</small><?php endif; ?>
        </div>
      </details>
    <?php endforeach; ?></div>
  </section>
<?php elseif ($section === 'cities'): ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Cities & map coordinates</h2><p>Coordinates power live tracking. Leave both blank to use built-in fallback values.</p></div><a class="admin-secondary-button" href="manage.php?section=routes">Back to routes</a></div>
    <details class="admin-card admin-form-card" open><summary>Add a city</summary>
      <form method="post" class="admin-form-grid">
        <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="cities"><input type="hidden" name="action" value="city_save">
        <label>City name<input name="name" minlength="2" maxlength="60" required></label><label>Latitude<input name="lat" type="number" step="0.000001" min="-90" max="90"></label><label>Longitude<input name="lng" type="number" step="0.000001" min="-180" max="180"></label>
        <button type="submit" class="btn gold">Add city</button>
      </form>
    </details>
    <div class="admin-managed-list"><?php foreach ($cities as $city): ?>
      <details class="admin-card admin-record">
        <summary><span><b><?= admin_escape($city['name']) ?></b><small><?= $city['lat'] !== null && $city['lng'] !== null ? admin_escape($city['lat']) . ', ' . admin_escape($city['lng']) : 'Fallback coordinates' ?></small></span></summary>
        <form method="post" class="admin-form-grid">
          <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="cities"><input type="hidden" name="action" value="city_save"><input type="hidden" name="id" value="<?= (int)$city['id'] ?>">
          <label>City name<input name="name" minlength="2" maxlength="60" value="<?= admin_escape($city['name']) ?>" required></label>
          <label>Latitude<input name="lat" type="number" step="0.000001" min="-90" max="90" value="<?= admin_escape($city['lat']) ?>"></label>
          <label>Longitude<input name="lng" type="number" step="0.000001" min="-180" max="180" value="<?= admin_escape($city['lng']) ?>"></label>
          <button type="submit" class="btn gold">Save changes</button>
        </form>
        <div class="admin-inline-actions"><?php
          $cityUsage = $pdo->prepare('SELECT COUNT(*) FROM routes WHERE from_city = :id OR to_city = :id');
          $cityUsage->execute([':id' => $city['id']]);
          $cityHasRoutes = (int)$cityUsage->fetchColumn() > 0;
        ?>
          <?php if (!$cityHasRoutes): ?><form method="post" onsubmit="return confirm('Delete this city?')"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="cities"><input type="hidden" name="action" value="city_delete"><input type="hidden" name="id" value="<?= (int)$city['id'] ?>"><button type="submit" class="admin-danger-button">Delete</button></form><?php else: ?><small>Used by routes · cannot delete</small><?php endif; ?>
        </div>
      </details>
    <?php endforeach; ?></div>
  </section>
<?php elseif ($section === 'schedules'): ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Daily schedules</h2><p>Schedule edits sync only future trips with no booking records. Booked trips remain unchanged.</p></div><a class="admin-secondary-button" href="manage.php?section=trips">Generate and view trips</a></div>
    <details class="admin-card admin-form-card" open><summary>Add a schedule</summary>
      <form method="post" class="admin-form-grid">
        <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="schedules"><input type="hidden" name="action" value="schedule_save">
        <label>Route<select name="route_id" required><option value="">Select route</option><?php foreach ($routes as $route): if (!$route['active']) continue; ?><option value="<?= (int)$route['id'] ?>"><?= admin_escape($route['from_name']) ?> → <?= admin_escape($route['to_name']) ?></option><?php endforeach; ?></select></label>
        <label>Bus<select name="bus_id" required><option value="">Select bus</option><?php foreach ($buses as $bus): if (!$bus['active']) continue; ?><option value="<?= (int)$bus['id'] ?>"><?= admin_escape($bus['name']) ?> (<?= admin_escape($bus['reg_no']) ?>)</option><?php endforeach; ?></select></label>
        <label>Departure<input name="depart_time" type="time" required></label><label>Duration (minutes)<input name="duration_min" type="number" min="1" max="1439" required></label>
        <label>Fare (LKR)<input name="fare" type="number" min="1" step="0.01" required></label><label class="admin-inline-check"><input type="checkbox" name="active" checked> Active</label>
        <button class="btn gold" type="submit">Create schedule</button>
      </form>
    </details>
    <div class="admin-managed-list"><?php foreach ($schedules as $schedule): ?>
      <details class="admin-card admin-record">
        <summary><span><b><?= admin_escape($schedule['from_name']) ?> → <?= admin_escape($schedule['to_name']) ?></b><small><?= admin_escape(substr($schedule['depart_time'], 0, 5)) ?> · <?= admin_escape($schedule['bus_name']) ?> · LKR <?= number_format((float)$schedule['fare']) ?></small></span><span class="admin-status <?= $schedule['active'] ? 'confirmed' : 'cancelled' ?>"><?= $schedule['active'] ? 'Active' : 'Inactive' ?></span></summary>
        <form method="post" class="admin-form-grid">
          <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="schedules"><input type="hidden" name="action" value="schedule_save"><input type="hidden" name="id" value="<?= (int)$schedule['id'] ?>">
          <label>Route<select name="route_id"><?php foreach ($routes as $route): ?><option value="<?= (int)$route['id'] ?>" <?= (int)$schedule['route_id'] === (int)$route['id'] ? 'selected' : '' ?> <?= !$route['active'] ? 'disabled' : '' ?>><?= admin_escape($route['from_name']) ?> → <?= admin_escape($route['to_name']) ?><?= !$route['active'] ? ' (inactive)' : '' ?></option><?php endforeach; ?></select></label>
          <label>Bus<select name="bus_id"><?php foreach ($buses as $bus): ?><option value="<?= (int)$bus['id'] ?>" <?= (int)$schedule['bus_id'] === (int)$bus['id'] ? 'selected' : '' ?> <?= !$bus['active'] ? 'disabled' : '' ?>><?= admin_escape($bus['name']) ?><?= !$bus['active'] ? ' (inactive)' : '' ?></option><?php endforeach; ?></select></label>
          <label>Departure<input name="depart_time" type="time" value="<?= admin_escape(substr($schedule['depart_time'], 0, 5)) ?>"></label>
          <label>Duration (minutes)<input name="duration_min" type="number" min="1" max="1439" value="<?= (int)$schedule['duration_min'] ?>"></label>
          <label>Fare (LKR)<input name="fare" type="number" min="1" step="0.01" value="<?= admin_escape($schedule['fare']) ?>"></label>
          <label class="admin-inline-check"><input type="checkbox" name="active" <?= $schedule['active'] ? 'checked' : '' ?>> Active</label>
          <button type="submit" class="btn gold">Save changes</button>
        </form>
        <div class="admin-inline-actions">
          <?php if (!(int)$schedule['trip_count']): ?><form method="post" onsubmit="return confirm('Delete this schedule?')"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="schedules"><input type="hidden" name="action" value="schedule_delete"><input type="hidden" name="id" value="<?= (int)$schedule['id'] ?>"><button type="submit" class="admin-danger-button">Delete</button></form><?php else: ?><small><?= (int)$schedule['trip_count'] ?> generated trips · edit/deactivate safely</small><?php endif; ?>
        </div>
      </details>
    <?php endforeach; ?></div>
  </section>
<?php elseif ($section === 'trips'): ?>
  <?php
  $rangeFrom = (string)($_GET['from'] ?? date('Y-m-d'));
  $rangeTo = (string)($_GET['to'] ?? date('Y-m-d', strtotime('+7 days')));
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $rangeFrom)) $rangeFrom = date('Y-m-d');
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $rangeTo) || $rangeTo < $rangeFrom) $rangeTo = $rangeFrom;
  $routeFilter = (int)($_GET['route_id'] ?? 0);
  $busFilter = (int)($_GET['bus_id'] ?? 0);
  $tripConditions = ['t.depart_date BETWEEN :from_date AND :to_date'];
  $tripParams = [':from_date' => $rangeFrom, ':to_date' => $rangeTo];
  if ($routeFilter > 0) { $tripConditions[] = 't.route_id = :route_id'; $tripParams[':route_id'] = $routeFilter; }
  if ($busFilter > 0) { $tripConditions[] = 't.bus_id = :bus_id'; $tripParams[':bus_id'] = $busFilter; }
  $tripQuery = $pdo->prepare(
      "SELECT t.id, t.depart_date, t.depart_time, t.arrive_time, t.fare, t.status,
              b.name AS bus_name, b.total_seats, cf.name AS from_name, ct.name AS to_name,
              (SELECT COUNT(*) FROM booking_seats bs JOIN bookings bk ON bk.id = bs.booking_id
               WHERE bs.trip_id = t.id AND bk.status = 'confirmed') AS seats_sold
       FROM trips t JOIN buses b ON b.id = t.bus_id
       JOIN routes r ON r.id = t.route_id JOIN cities cf ON cf.id = r.from_city JOIN cities ct ON ct.id = r.to_city
       WHERE " . implode(' AND ', $tripConditions) . "
       ORDER BY t.depart_date, t.depart_time"
  );
  $tripQuery->execute($tripParams);
  $tripRows = $tripQuery->fetchAll();
  ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Generated trips</h2><p>Cancellation retains booking and seat records; passenger notification requires an external hook.</p></div></div>
    <form method="post" class="admin-card admin-generation-form">
      <input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="trips"><input type="hidden" name="action" value="generate_trips">
      <label>Generate trips for the next N days<input type="number" name="days" min="1" max="365" value="30"></label><button class="btn gold" type="submit">Generate trips</button>
    </form>
    <form method="get" class="admin-card admin-trip-filters">
      <input type="hidden" name="section" value="trips">
      <label>From<input type="date" name="from" value="<?= admin_escape($rangeFrom) ?>"></label><label>To<input type="date" name="to" value="<?= admin_escape($rangeTo) ?>"></label>
      <label>Route<select name="route_id"><option value="0">All routes</option><?php foreach ($routes as $route): ?><option value="<?= (int)$route['id'] ?>" <?= $routeFilter === (int)$route['id'] ? 'selected' : '' ?>><?= admin_escape($route['from_name']) ?> → <?= admin_escape($route['to_name']) ?></option><?php endforeach; ?></select></label>
      <label>Bus<select name="bus_id"><option value="0">All buses</option><?php foreach ($buses as $bus): ?><option value="<?= (int)$bus['id'] ?>" <?= $busFilter === (int)$bus['id'] ? 'selected' : '' ?>><?= admin_escape($bus['name']) ?></option><?php endforeach; ?></select></label>
      <button type="submit" class="admin-secondary-button">Filter trips</button>
    </form>
    <div class="admin-table-card admin-card"><div class="admin-table-scroll" tabindex="0" role="region" aria-label="Trips, horizontally scrollable">
      <table class="admin-bookings-table"><thead><tr><th>Date / time</th><th>Route</th><th>Bus</th><th>Seats sold</th><th>Fare</th><th>Status</th><th>Action</th></tr></thead><tbody>
      <?php foreach ($tripRows as $trip): ?>
        <tr><td><?= admin_escape($trip['depart_date']) ?> <?= admin_escape(substr($trip['depart_time'], 0, 5)) ?></td><td><?= admin_escape($trip['from_name']) ?> → <?= admin_escape($trip['to_name']) ?></td><td><?= admin_escape($trip['bus_name']) ?></td><td><?= (int)$trip['seats_sold'] ?> / <?= (int)$trip['total_seats'] ?></td><td>LKR <?= number_format((float)$trip['fare']) ?></td><td><span class="admin-status <?= $trip['status'] === 'scheduled' ? 'confirmed' : 'cancelled' ?>"><?= admin_escape($trip['status']) ?></span></td><td>
          <?php if (strtotime($trip['depart_date'] . ' ' . $trip['depart_time']) >= time()): ?><form method="post" onsubmit="return confirm('Change this trip status? Booking records will be retained.')"><input type="hidden" name="csrf_token" value="<?= admin_escape($csrfToken) ?>"><input type="hidden" name="section" value="trips"><input type="hidden" name="action" value="trip_state"><input type="hidden" name="id" value="<?= (int)$trip['id'] ?>"><input type="hidden" name="status" value="<?= $trip['status'] === 'scheduled' ? 'cancelled' : 'scheduled' ?>"><button type="submit" class="<?= $trip['status'] === 'scheduled' ? 'admin-danger-button' : 'admin-secondary-button' ?>"><?= $trip['status'] === 'scheduled' ? 'Cancel trip' : 'Restore trip' ?></button></form><?php else: ?>Departed<?php endif; ?>
        </td></tr>
      <?php endforeach; if (!$tripRows): ?><tr><td colspan="7" class="admin-empty">No trips found for this filter.</td></tr><?php endif; ?>
      </tbody></table>
    </div></div>
  </section>
<?php else: ?>
  <?php $auditRows = $pdo->query('SELECT id, admin, action, entity, entity_id, details, ip, created_at FROM admin_audit ORDER BY id DESC LIMIT 300')->fetchAll(); ?>
  <section class="admin-section">
    <div class="admin-toolbar"><div><h2>Admin audit log</h2><p>Recent management changes, newest first. Showing up to 300 records.</p></div></div>
    <div class="admin-card admin-table-card"><div class="admin-table-scroll" tabindex="0" role="region" aria-label="Audit log, horizontally scrollable">
      <table class="admin-bookings-table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Entity</th><th>Record</th><th>Details</th><th>IP</th></tr></thead><tbody>
      <?php foreach ($auditRows as $row): ?><tr><td><?= admin_escape($row['created_at']) ?></td><td><?= admin_escape($row['admin']) ?></td><td><?= admin_escape($row['action']) ?></td><td><?= admin_escape($row['entity']) ?></td><td><?= admin_escape($row['entity_id'] ?? '—') ?></td><td><details><summary>View</summary><pre class="admin-audit-details"><?= admin_escape($row['details'] ?? '') ?></pre></details></td><td><?= admin_escape($row['ip'] ?? '—') ?></td></tr><?php endforeach; ?>
      <?php if (!$auditRows): ?><tr><td colspan="7" class="admin-empty">No audit entries yet.</td></tr><?php endif; ?>
      </tbody></table>
    </div></div>
  </section>
<?php endif; ?>
<?php admin_page_end(); ?>
