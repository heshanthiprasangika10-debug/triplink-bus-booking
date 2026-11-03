<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$in = request_data();
$email = strtolower(input_string($in, 'email'));
$password = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
$ipKey = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$now = time();
$attempts = $_SESSION['login_attempts'][$ipKey] ?? [];
if (!is_array($attempts)) $attempts = [];
$attempts = array_values(array_filter($attempts, static fn($at) => is_int($at) && $at > $now - 600));
if ($attempts) $_SESSION['login_attempts'][$ipKey] = $attempts;
else unset($_SESSION['login_attempts'][$ipKey]);

if (count($attempts) >= 5) {
    json_out(['error' => 'Invalid email or password. Try again in 10 minutes.'], 429);
}

try {
    $stmt = db()->prepare('SELECT id, password_hash FROM users WHERE email = :email');
    $stmt->execute([':email' => $email]);
    $record = $stmt->fetch();
} catch (Throwable $e) {
    json_out(['error' => 'Login failed. Please try again.'], 500);
}
if (!$record || !password_verify($password, $record['password_hash'])) {
    $attempts[] = $now;
    $_SESSION['login_attempts'][$ipKey] = $attempts;
    json_out(['error' => 'Invalid email or password.'], 401);
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$record['id'];
unset($_SESSION['login_attempts'][$ipKey]);
$user = current_user();
json_out(['user' => $user ? public_user($user) : null]);
