<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$in = request_data();
$name = input_string($in, 'name');
$email = strtolower(input_string($in, 'email'));
$rawPhone = input_string($in, 'phone');
$phone = preg_replace('/[^0-9+]/', '', $rawPhone);
$password = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';

if (mb_strlen($name) < 2 || mb_strlen($name) > 100) json_out(['error' => 'Name must be between 2 and 100 characters.'], 400);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120) json_out(['error' => 'Enter a valid email address.'], 400);
if (strlen(preg_replace('/\D/', '', $phone)) < 9 || strlen($phone) > 20) json_out(['error' => 'Enter a valid phone number with at least 9 digits.'], 400);
if (mb_strlen($password) < 8) json_out(['error' => 'Password must be at least 8 characters.'], 400);

try {
    $stmt = db()->prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (:name, :email, :phone, :hash)');
    $stmt->execute([
        ':name' => $name,
        ':email' => $email,
        ':phone' => $phone,
        ':hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)db()->lastInsertId();
    $user = current_user();
    json_out(['user' => $user ? public_user($user) : null], 201);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_out(['error' => 'An account with this email already exists.'], 409);
    json_out(['error' => 'Registration failed. Please try again.'], 500);
}
