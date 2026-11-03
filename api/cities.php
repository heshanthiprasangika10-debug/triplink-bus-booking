<?php
require __DIR__ . '/config.php';
try {
    $pdo = db();
    $cities = $pdo->query("SELECT id, name FROM cities ORDER BY name")->fetchAll();
    $popular = $pdo->query(
        "SELECT r.id, cf.name AS from_city, ct.name AS to_city, r.distance_km,
                (SELECT MIN(fare) FROM schedules WHERE route_id = r.id) AS from_fare
         FROM routes r
         JOIN cities cf ON cf.id = r.from_city
         JOIN cities ct ON ct.id = r.to_city
         WHERE r.active = 1
         ORDER BY r.id LIMIT 8"
    )->fetchAll();
    $destinationQuery = $pdo->query('SELECT from_city, to_city FROM routes WHERE active = 1 ORDER BY from_city, to_city');
    $destinations = [];
    foreach ($destinationQuery->fetchAll() as $route) {
        $origin = (string)(int)$route['from_city'];
        $destinations[$origin][] = (int)$route['to_city'];
    }
    json_out(['cities' => $cities, 'popular' => $popular, 'destinations' => $destinations]);
} catch (Throwable $e) {
    json_out(array_merge([
        'error' => 'Database error. Check api/config.php and import database.sql',
        'code' => 'citiesFailed',
    ], api_debug_exception($e)), 500);
}
