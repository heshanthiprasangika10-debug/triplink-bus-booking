<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_out(['error' => 'GET only'], 405);
$user = current_user();
json_out(['user' => $user ? public_user($user) : null]);
