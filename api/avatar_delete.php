<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require_once __DIR__ . '/auth_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(['error' => 'POST only', 'code' => 'postOnly'], 405);
}
require_same_origin_ajax();
$user = require_user();

$avatarPath = (string)($user['avatar_path'] ?? '');
try {
    $stmt = db()->prepare('UPDATE users SET avatar_path = NULL, avatar_updated_at = NULL WHERE id = :id');
    $stmt->execute([':id' => (int)$user['id']]);
    $updatedUser = current_user();
    if (!$updatedUser) throw new RuntimeException('Authenticated account was not available after the update.');
} catch (Throwable $exception) {
    error_log('TripLink avatar delete: database update failed: ' . $exception->getMessage());
    json_out(['error' => 'Photo could not be removed. Please try again.', 'code' => 'avatarDeleteFailed'], 500);
}

if (preg_match('/^[a-f0-9]{32}\.jpg$/', basename($avatarPath)) === 1
    && $avatarPath === 'assets/uploads/avatars/' . basename($avatarPath)) {
    $avatarDirectory = dirname(__DIR__) . '/assets/uploads/avatars';
    $filename = basename($avatarPath);
    $cleanupFailed = false;
    if (is_file($avatarDirectory . '/' . $filename) && !@unlink($avatarDirectory . '/' . $filename)) {
        error_log('TripLink avatar delete: could not remove old avatar ' . $filename);
        $cleanupFailed = true;
    }
    $thumbnail = $avatarDirectory . '/' . substr($filename, 0, -4) . '_thumb.jpg';
    if (is_file($thumbnail) && !@unlink($thumbnail)) {
        error_log('TripLink avatar delete: could not remove old thumbnail ' . basename($thumbnail));
        $cleanupFailed = true;
    }
    if ($cleanupFailed) {
        json_out([
            'error' => 'The profile photo was removed, but a stored image file could not be deleted. Please contact support.',
            'code' => 'avatarCleanupFailed',
            'user' => public_user($updatedUser),
        ], 500);
    }
}

json_out(['user' => public_user($updatedUser)]);
