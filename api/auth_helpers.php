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

    $stmt = db()->prepare('SELECT id, name, email, phone, created_at, avatar_path, avatar_updated_at FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    return $user;
}

function public_user(array $user): array {
    $name = trim((string)($user['name'] ?? ''));
    $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $initials = '';
    foreach (array_slice($parts, 0, 2) as $part) {
        $initials .= mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8');
    }

    $avatarPath = (string)($user['avatar_path'] ?? '');
    $avatarName = basename($avatarPath);
    $hasAvatar = preg_match('/^[a-f0-9]{32}\.jpg$/', $avatarName) === 1
        && $avatarPath === 'assets/uploads/avatars/' . $avatarName;
    $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api/');
    $appBase = rtrim(dirname(dirname($scriptName)), '/') . '/';
    if ($appBase === '//') $appBase = '/';
    $version = rawurlencode((string)($user['avatar_updated_at'] ?? ''));

    unset($user['avatar_path'], $user['avatar_updated_at']);
    $user['initials'] = $initials !== '' ? $initials : '?';
    $user['avatar_url'] = $hasAvatar ? $appBase . $avatarPath . '?v=' . $version : null;
    $thumbnailName = $hasAvatar ? substr($avatarName, 0, -4) . '_thumb.jpg' : '';
    $user['avatar_thumb_url'] = $hasAvatar ? $appBase . 'assets/uploads/avatars/' . $thumbnailName . '?v=' . $version : null;
    return $user;
}

function require_same_origin_ajax(): void {
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        json_out(['error' => 'This request could not be verified.', 'code' => 'avatarRequestInvalid'], 400);
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $expectedOrigin = $scheme . '://' . $host;
    if ($origin === '' || !hash_equals(strtolower($expectedOrigin), strtolower(rtrim($origin, '/')))) {
        json_out(['error' => 'This request could not be verified.', 'code' => 'avatarRequestInvalid'], 400);
    }
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
