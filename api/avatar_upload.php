<?php
define('TRIPLINK_AUTH_ENDPOINT', true);
require_once __DIR__ . '/auth_helpers.php';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 6000;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(['error' => 'POST only', 'code' => 'postOnly'], 405);
}
require_same_origin_ajax();
$user = require_user();
$userId = (int)$user['id'];

$now = time();
$attempts = $_SESSION['avatar_upload_attempts'][$userId] ?? [];
if (!is_array($attempts)) $attempts = [];
$attempts = array_values(array_filter($attempts, static fn($at) => is_int($at) && $at > $now - 3600));
if (count($attempts) >= 10) {
    json_out(['error' => 'You have reached the photo upload limit. Try again later.', 'code' => 'avatarRateLimited'], 429);
}
$attempts[] = $now;
$_SESSION['avatar_upload_attempts'][$userId] = $attempts;

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > AVATAR_MAX_BYTES + 256 * 1024) {
    json_out(['error' => 'Photo must be 5 MB or smaller.', 'code' => 'avatarTooLarge'], 413);
}
if (!isset($_FILES['avatar']) || !is_array($_FILES['avatar'])) {
    json_out(['error' => 'Choose a photo to upload.', 'code' => 'avatarMissing'], 400);
}

$upload = $_FILES['avatar'];
$uploadError = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE) {
    json_out(['error' => 'Photo must be 5 MB or smaller.', 'code' => 'avatarTooLarge'], 413);
}
if ($uploadError !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null) || !is_uploaded_file($upload['tmp_name'])) {
    json_out(['error' => 'The photo could not be uploaded. Please try again.', 'code' => 'avatarUploadFailed'], 400);
}

$size = (int)($upload['size'] ?? 0);
if ($size < 1) json_out(['error' => 'Choose a valid photo.', 'code' => 'avatarInvalidImage'], 415);
if ($size > AVATAR_MAX_BYTES) json_out(['error' => 'Photo must be 5 MB or smaller.', 'code' => 'avatarTooLarge'], 413);

$finfo = new finfo(FILEINFO_MIME_TYPE);
$fileMime = $finfo->file($upload['tmp_name']);
$imageInfo = @getimagesize($upload['tmp_name']);
$allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
if (!is_string($fileMime) || !in_array($fileMime, $allowedMimes, true)
    || !is_array($imageInfo) || !in_array($imageInfo['mime'] ?? '', $allowedMimes, true)
    || $fileMime !== $imageInfo['mime']) {
    json_out(['error' => 'Please choose a JPG, PNG or WebP photo.', 'code' => 'avatarUnsupportedType'], 415);
}

$width = (int)$imageInfo[0];
$height = (int)$imageInfo[1];
if ($width < 1 || $height < 1 || $width > AVATAR_MAX_DIMENSION || $height > AVATAR_MAX_DIMENSION) {
    json_out(['error' => 'Photo dimensions must not exceed 6000 × 6000 pixels.', 'code' => 'avatarDimensions'], 413);
}
$memoryLimit = trim((string)ini_get('memory_limit'));
if ($memoryLimit !== '' && $memoryLimit !== '-1') {
    $unit = strtolower(substr($memoryLimit, -1));
    $limitBytes = (int)$memoryLimit;
    if ($unit === 'g') $limitBytes *= 1024;
    if ($unit === 'g' || $unit === 'm') $limitBytes *= 1024;
    if ($unit === 'g' || $unit === 'm' || $unit === 'k') $limitBytes *= 1024;
    $requiredBytes = $width * $height * 5 + memory_get_usage(true);
    if ($requiredBytes > $limitBytes) {
        json_out(['error' => 'This photo is too large to process. Choose a smaller image.', 'code' => 'avatarTooManyPixels'], 413);
    }
}
if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
    error_log('TripLink avatar upload: PHP GD JPEG support is unavailable.');
    json_out(['error' => 'Photo uploads are temporarily unavailable.', 'code' => 'avatarUnavailable'], 500);
}

$imageBytes = file_get_contents($upload['tmp_name']);
$sourceImage = is_string($imageBytes) ? @imagecreatefromstring($imageBytes) : false;
if ($sourceImage === false) {
    json_out(['error' => 'Please choose a JPG, PNG or WebP photo.', 'code' => 'avatarInvalidImage'], 415);
}

if ($fileMime === 'image/jpeg' && function_exists('exif_read_data')) {
    $exif = @exif_read_data($upload['tmp_name'], 'IFD0');
    $orientation = (int)($exif['Orientation'] ?? 1);
    if ($orientation === 2) {
        imageflip($sourceImage, IMG_FLIP_HORIZONTAL);
    } elseif ($orientation === 3 || $orientation === 4) {
        $rotated = @imagerotate($sourceImage, 180, 0xffffff);
        if ($rotated !== false) {
            imagedestroy($sourceImage);
            $sourceImage = $rotated;
        }
        if ($orientation === 4) imageflip($sourceImage, IMG_FLIP_HORIZONTAL);
    } elseif ($orientation === 5 || $orientation === 6 || $orientation === 7 || $orientation === 8) {
        $angle = ($orientation === 6 || $orientation === 7) ? -90 : 90;
        $rotated = @imagerotate($sourceImage, $angle, 0xffffff);
        if ($rotated !== false) {
            imagedestroy($sourceImage);
            $sourceImage = $rotated;
            if ($orientation === 5 || $orientation === 7) imageflip($sourceImage, IMG_FLIP_HORIZONTAL);
        }
    }
}

$sourceWidth = imagesx($sourceImage);
$sourceHeight = imagesy($sourceImage);
$cropX = 0;
$cropY = 0;
$cropSize = min($sourceWidth, $sourceHeight);
$hasCropData = isset($_POST['x'], $_POST['y'], $_POST['size']);
if ($hasCropData) {
    $rawX = filter_var($_POST['x'], FILTER_VALIDATE_FLOAT);
    $rawY = filter_var($_POST['y'], FILTER_VALIDATE_FLOAT);
    $rawSize = filter_var($_POST['size'], FILTER_VALIDATE_FLOAT);
    if ($rawX === false || $rawY === false || $rawSize === false || !is_finite($rawX) || !is_finite($rawY) || !is_finite($rawSize)
        || $rawX < 0 || $rawY < 0 || $rawSize <= 0 || $rawX + $rawSize > $sourceWidth || $rawY + $rawSize > $sourceHeight) {
        imagedestroy($sourceImage);
        json_out(['error' => 'The selected crop is invalid. Please adjust it and try again.', 'code' => 'avatarInvalidCrop'], 400);
    }
    $cropX = (int)round($rawX);
    $cropY = (int)round($rawY);
    $cropSize = (int)round($rawSize);
    if ($cropSize < 1) {
        imagedestroy($sourceImage);
        json_out(['error' => 'The selected crop is invalid. Please adjust it and try again.', 'code' => 'avatarInvalidCrop'], 400);
    }
} else {
    $cropX = (int)floor(($sourceWidth - $cropSize) / 2);
    $cropY = (int)floor(($sourceHeight - $cropSize) / 2);
}

$square = imagecreatetruecolor(512, 512);
$thumbnail = imagecreatetruecolor(128, 128);
if ($square === false || $thumbnail === false) {
    imagedestroy($sourceImage);
    if ($square !== false) imagedestroy($square);
    if ($thumbnail !== false) imagedestroy($thumbnail);
    json_out(['error' => 'This photo is too large to process. Choose a smaller image.', 'code' => 'avatarTooManyPixels'], 413);
}
$white = imagecolorallocate($square, 255, 255, 255);
imagefill($square, 0, 0, $white);
$whiteThumb = imagecolorallocate($thumbnail, 255, 255, 255);
imagefill($thumbnail, 0, 0, $whiteThumb);
imagecopyresampled($square, $sourceImage, 0, 0, $cropX, $cropY, 512, 512, $cropSize, $cropSize);
imagecopyresampled($thumbnail, $sourceImage, 0, 0, $cropX, $cropY, 128, 128, $cropSize, $cropSize);
imagedestroy($sourceImage);

$avatarDirectory = dirname(__DIR__) . '/assets/uploads/avatars';
if (!is_dir($avatarDirectory) && !@mkdir($avatarDirectory, 0755, true) && !is_dir($avatarDirectory)) {
    imagedestroy($square);
    imagedestroy($thumbnail);
    error_log('TripLink avatar upload: could not create avatar storage directory.');
    json_out(['error' => 'Photo storage is unavailable. Please contact support.', 'code' => 'avatarStorageUnavailable'], 500);
}
if (!is_writable($avatarDirectory)) {
    imagedestroy($square);
    imagedestroy($thumbnail);
    error_log('TripLink avatar upload: avatar storage directory is not writable.');
    json_out(['error' => 'Photo storage is unavailable. Please contact support.', 'code' => 'avatarStorageUnavailable'], 500);
}

try {
    $filename = bin2hex(random_bytes(16)) . '.jpg';
} catch (Throwable $exception) {
    imagedestroy($square);
    imagedestroy($thumbnail);
    error_log('TripLink avatar upload: secure filename generation failed.');
    json_out(['error' => 'Photo upload failed. Please try again.', 'code' => 'avatarUploadFailed'], 500);
}

$avatarPath = $avatarDirectory . '/' . $filename;
$thumbnailPath = $avatarDirectory . '/' . substr($filename, 0, -4) . '_thumb.jpg';
$temporaryAvatar = $avatarPath . '.tmp';
$temporaryThumbnail = $thumbnailPath . '.tmp';
imageinterlace($square, true);
$savedAvatar = @imagejpeg($square, $temporaryAvatar, 85);
$savedThumbnail = @imagejpeg($thumbnail, $temporaryThumbnail, 85);
imagedestroy($square);
imagedestroy($thumbnail);
if (!$savedAvatar || !$savedThumbnail || !@rename($temporaryAvatar, $avatarPath) || !@rename($temporaryThumbnail, $thumbnailPath)) {
    @unlink($temporaryAvatar);
    @unlink($temporaryThumbnail);
    @unlink($avatarPath);
    @unlink($thumbnailPath);
    error_log('TripLink avatar upload: writing the avatar image failed.');
    json_out(['error' => 'Photo upload failed. Please try again.', 'code' => 'avatarUploadFailed'], 500);
}

$oldAvatarPath = (string)($user['avatar_path'] ?? '');
try {
    $stmt = db()->prepare('UPDATE users SET avatar_path = :path, avatar_updated_at = NOW() WHERE id = :id');
    $stmt->execute([':path' => 'assets/uploads/avatars/' . $filename, ':id' => $userId]);
    $updatedUser = current_user();
    if (!$updatedUser) throw new RuntimeException('Authenticated account was not available after the update.');
} catch (Throwable $exception) {
    @unlink($avatarPath);
    @unlink($thumbnailPath);
    error_log('TripLink avatar upload: database update failed: ' . $exception->getMessage());
    json_out(['error' => 'Photo upload failed. Please try again.', 'code' => 'avatarUploadFailed'], 500);
}

$oldAvatarCleanupFailed = false;
if (preg_match('/^[a-f0-9]{32}\.jpg$/', basename($oldAvatarPath)) === 1
    && $oldAvatarPath === 'assets/uploads/avatars/' . basename($oldAvatarPath)
    && $oldAvatarPath !== 'assets/uploads/avatars/' . $filename) {
    $oldFilename = basename($oldAvatarPath);
    foreach ([$oldFilename, substr($oldFilename, 0, -4) . '_thumb.jpg'] as $oldFile) {
        $oldFilePath = $avatarDirectory . '/' . $oldFile;
        if (is_file($oldFilePath) && !@unlink($oldFilePath)) {
            $oldAvatarCleanupFailed = true;
            error_log('TripLink avatar upload: could not remove old image ' . $oldFile);
        }
    }
}

$publicUser = public_user($updatedUser);
if ($oldAvatarCleanupFailed) {
    json_out([
        'error' => 'The profile photo was updated, but an old image file could not be deleted. Please contact support.',
        'code' => 'avatarCleanupFailed',
        'user' => $publicUser,
    ], 500);
}
json_out(['user' => $publicUser]);
