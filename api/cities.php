<?php
require __DIR__ . '/config.php';
try {
    $cities = db()->query("SELECT id, name FROM cities ORDER BY name")->fetchAll();
    $popular = db()->query(
        "SELECT r.id, cf.name AS from_city, ct.name AS to_city, r.distance_km,
                (SELECT MIN(fare) FROM schedules WHERE route_id = r.id) AS from_fare
         FROM routes r
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         ORDER BY r.id LIMIT 8"
    )->fetchAll();
    json_out(['cities' => $cities, 'popular' => $popular]);
} catch (Throwable $e) {
    json_out(['error' => 'Database error. Check api/config.php and import database.sql'], 500);
}
