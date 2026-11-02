<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require __DIR__ . '/auth_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_out(['error' => 'GET only'], 405);
json_out(['user' => current_user()]);
