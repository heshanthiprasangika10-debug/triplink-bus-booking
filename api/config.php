<?php
// ---- TripLink config ----
// WAMP/XAMPP default: user root, empty password
define('DB_HOST', 'localhost');
define('DB_NAME', 'triplink_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('ADMIN_PASSWORD', 'triplink123');   // change this!
define('DAYS_AHEAD', 30);                  // how many days of trips to auto-generate

date_default_timezone_set('Asia/Colombo');

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        $pdo->exec("SET time_zone = '+05:30'");
    }
    return $pdo;
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    if (!defined('TRIPLINK_AUTH_ENDPOINT')) {
        header('Access-Control-Allow-Origin: *');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_in(): array {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}

// Create dated trips from the daily timetable for one date (idempotent)
function ensure_trips(string $date): void {
    $sql = "INSERT IGNORE INTO trips (schedule_id, route_id, bus_id, depart_date, depart_time, arrive_time, fare)
            SELECT s.id, s.route_id, s.bus_id, :d, s.depart_time,
                   SEC_TO_TIME(MOD(TIME_TO_SEC(s.depart_time) + s.duration_min * 60, 86400)), s.fare
            FROM schedules s";
    db()->prepare($sql)->execute([':d' => $date]);
}
