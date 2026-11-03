<?php
require __DIR__ . '/config.php';
require_once __DIR__ . '/../admin/_helpers.php';

$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
$isLocal = in_array($remoteAddress, ['127.0.0.1', '::1'], true);
if (!$isLocal && empty($_SESSION['admin'])) {
    json_out(['error' => 'Health check is available only on localhost or to an admin.'], 403);
}

$requiredTables = ['cities', 'routes', 'buses', 'schedules', 'trips', 'bookings', 'booking_seats', 'users'];
$requiredColumns = [
    'cities' => ['lat', 'lng', 'created_at', 'updated_at'],
    'routes' => ['active', 'created_at', 'updated_at'],
    'buses' => ['active', 'created_at', 'updated_at'],
    'schedules' => ['active', 'created_at', 'updated_at'],
    'trips' => ['status'],
    'bookings' => ['user_id', 'group_ref', 'leg'],
];
$fixByColumn = [
    'active' => 'database_update_admin_management.sql',
    'status' => 'database_update_admin_management.sql',
    'lat' => 'database_update_admin_management.sql',
    'lng' => 'database_update_admin_management.sql',
    'created_at' => 'database_update_admin_management.sql',
    'updated_at' => 'database_update_admin_management.sql',
    'user_id' => 'database_update_users.sql',
    'group_ref' => 'database_update_round_trip.sql',
    'leg' => 'database_update_round_trip.sql',
];
$tables = array_fill_keys($requiredTables, null);
$missingColumns = [];
$counts = ['cities' => null, 'routes' => null, 'schedules' => null, 'trips' => null];
$database = ['name' => DB_NAME, 'connected' => false, 'error' => null];
$ensureTrips = ['ok' => false, 'error' => null];
$serverVersion = null;
$fixes = [];

try {
    $pdo = db();
    $database['connected'] = true;
    $serverVersion = $pdo->query('SELECT VERSION()')->fetchColumn();

    $tableQuery = $pdo->prepare(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()'
    );
    $tableQuery->execute();
    $existingTables = array_fill_keys($tableQuery->fetchAll(PDO::FETCH_COLUMN), true);
    foreach ($requiredTables as $table) {
        $tables[$table] = isset($existingTables[$table]);
        if (!$tables[$table]) {
            if ($table === 'users') {
                $fixes['database_update_users.sql'] = 'Run database_update_users.sql in triplink_db to create the missing users table.';
            } else {
                $fixes['database.sql'] = 'Missing core tables: ' . $table . '. For an empty/fresh database only, select triplink_db and import database.sql; it drops and recreates TripLink tables.';
            }
            continue;
        }

        if (!isset($requiredColumns[$table])) continue;
        $columnQuery = $pdo->prepare(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table'
        );
        $columnQuery->execute([':table' => $table]);
        $existingColumns = array_fill_keys($columnQuery->fetchAll(PDO::FETCH_COLUMN), true);
        foreach ($requiredColumns[$table] as $column) {
            if (!isset($existingColumns[$column])) {
                $fixFile = $fixByColumn[$column];
                $missingColumns[] = ['table' => $table, 'column' => $column, 'fix' => $fixFile];
                $fixes[$fixFile] = $fixFile . ' adds the missing ' . $table . '.' . $column . ' schema.';
            }
        }
    }

    foreach (array_keys($counts) as $table) {
        if ($tables[$table]) {
            $counts[$table] = (int)$pdo->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn();
        }
    }

    if ($tables['schedules'] && $tables['trips'] && $tables['routes'] && $tables['buses']) {
        try {
            ensure_trips(date('Y-m-d'));
            $ensureTrips = ['ok' => true, 'error' => null];
        } catch (Throwable $exception) {
            error_log('TripLink health ensure_trips failed: ' . $exception->getMessage());
            $ensureTrips = ['ok' => false, 'error' => $exception->getMessage()];
            if (str_contains($exception->getMessage(), 'active')) {
                $fixes['database_update_admin_management.sql'] = 'Run database_update_admin_management.sql in triplink_db to add the active/status columns used by ensure_trips().';
            }
        }
    }
} catch (Throwable $exception) {
    error_log('TripLink health check failed: ' . $exception->getMessage());
    $database['error'] = $exception->getMessage();
    $fixes['api/config.php / MySQL'] = 'Start the MySQL service and verify DB_HOST, DB_NAME, DB_USER and DB_PASS in api/config.php; the configured database is ' . DB_NAME . '.';
}

if (in_array(false, $tables, true)) {
    $fixes['database.sql'] ??= 'Import database.sql into triplink_db only for a fresh/empty database; it drops and recreates TripLink tables.';
}

json_out([
    'database' => $database,
    'tables' => $tables,
    'missing_columns' => $missingColumns,
    'counts' => $counts,
    'ensure_trips_today' => $ensureTrips,
    'mysql_version' => $serverVersion,
    'fixes' => array_values($fixes),
]);
