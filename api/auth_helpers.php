<?php
require_once __DIR__ . '/config.php';

$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
$apiPath = rtrim(dirname($scriptPath), '/');
$appPath = rtrim(dirname($apiPath), '/') . '/';
if ($appPath === '//') $appPath = '/';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('TRIPLINKSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $appPath,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function current_user(): ?array {
    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId < 1) return null;

    $stmt = db()->prepare('SELECT id, name, email, phone, created_at FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    return $user;
}

function require_user(): array {
    $user = current_user();
    if (!$user) json_out(['error' => 'Please log in to continue.'], 401);
    return $user;
}

function request_data(): array {
    $data = json_in();
    return $data;
}

function input_string(array $data, string $key): string {
    $value = $data[$key] ?? '';
    return is_string($value) || is_numeric($value) ? trim((string)$value) : '';
}
