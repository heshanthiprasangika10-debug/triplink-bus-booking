<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$imageDirectory = realpath(__DIR__ . '/../assets/img');
if ($imageDirectory === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Hero image directory is unavailable']);
    exit;
}

$optimizationDirectory = $imageDirectory . DIRECTORY_SEPARATOR . 'optimized';
if (!is_dir($optimizationDirectory) && !@mkdir($optimizationDirectory, 0755, true) && !is_dir($optimizationDirectory)) {
    error_log('TripLink hero images: could not create the optimized image directory.');
}

$metadata = [
    'hero1' => [
        'focus' => '72% 58%',
        'alt' => 'Blue city bus in busy urban traffic',
        'overlay' => ['start' => '.98', 'mid' => '.88', 'end' => '.62'],
    ],
    'hero2' => [
        'focus' => '34% 55%',
        'alt' => 'Green city bus among urban traffic',
        'overlay' => ['start' => '.97', 'mid' => '.86', 'end' => '.60'],
    ],
    'hero3' => [
        'focus' => '43% 54%',
        'alt' => 'Green bus moving through a city street',
        'overlay' => ['start' => '.97', 'mid' => '.85', 'end' => '.58'],
    ],
    'hero4' => [
        'focus' => '70% 54%',
        'alt' => 'White city bus on an urban street',
        'overlay' => ['start' => '.99', 'mid' => '.90', 'end' => '.66'],
    ],
];

$files = [];
foreach (scandir($imageDirectory) ?: [] as $filename) {
    if (!preg_match('/^(hero.+)\.(jpe?g|png|webp)$/i', $filename, $matches)) {
        continue;
    }

    $path = $imageDirectory . DIRECTORY_SEPARATOR . $filename;
    if (is_file($path)) {
        $files[] = [
            'name' => $filename,
            'path' => $path,
            'stem' => strtolower(pathinfo($filename, PATHINFO_FILENAME)),
            'extension' => strtolower($matches[2]),
        ];
    }
}
usort($files, static fn(array $left, array $right): int => strnatcasecmp($left['name'], $right['name']));
$files = array_slice($files, 0, 8);

$slides = [];
foreach ($files as $index => $file) {
    $imageInfo = @getimagesize($file['path']);
    if ($imageInfo === false) {
        error_log('TripLink hero images: could not read image dimensions for ' . $file['name']);
        continue;
    }

    $sourceModified = filemtime($file['path']) ?: 0;
    $sourceSize = filesize($file['path']) ?: 0;
    $sourceHash = hash_file('sha256', $file['path']);
    if (!is_string($sourceHash)) {
        error_log('TripLink hero images: could not hash ' . $file['name']);
        $sourceHash = hash('sha256', $file['name'] . ':' . $sourceModified . ':' . $sourceSize);
    }
    $sourceWidth = (int)$imageInfo[0];
    $assetUrl = 'assets/img/' . rawurlencode($file['name']);
    $assetType = $imageInfo['mime'] ?? 'image/jpeg';
    $needsOptimization = $sourceSize > 600 * 1024 || $sourceWidth > 2000;

    if ($needsOptimization) {
        $outputName = pathinfo($file['name'], PATHINFO_FILENAME)
            . ($file['extension'] === 'jpg' ? '' : '-' . $file['extension'])
            . '.jpg';
        $outputPath = $optimizationDirectory . DIRECTORY_SEPARATOR . $outputName;
        $sourceStampPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'triplink-hero-' . hash('sha256', $outputPath) . '.source';
        $savedSourceHash = is_file($sourceStampPath) ? trim((string)file_get_contents($sourceStampPath)) : '';
        $outputIsCurrent = is_file($outputPath)
            && (filemtime($outputPath) ?: 0) >= $sourceModified
            && hash_equals($sourceHash, $savedSourceHash);

        if (!$outputIsCurrent && is_dir($optimizationDirectory) && function_exists('imagecreatetruecolor')) {
            $sourceImage = false;
            if ($imageInfo[2] === IMAGETYPE_JPEG) {
                $sourceImage = @imagecreatefromjpeg($file['path']);
            } elseif ($imageInfo[2] === IMAGETYPE_PNG) {
                $sourceImage = @imagecreatefrompng($file['path']);
            } elseif ($imageInfo[2] === IMAGETYPE_WEBP && function_exists('imagecreatefromwebp')) {
                $sourceImage = @imagecreatefromwebp($file['path']);
            }

            if ($sourceImage !== false) {
                $outputWidth = min(1920, $sourceWidth);
                $outputHeight = max(1, (int)round($imageInfo[1] * $outputWidth / $sourceWidth));
                $optimizedImage = imagecreatetruecolor($outputWidth, $outputHeight);
                $resized = imagecopyresampled(
                    $optimizedImage,
                    $sourceImage,
                    0,
                    0,
                    0,
                    0,
                    $outputWidth,
                    $outputHeight,
                    $sourceWidth,
                    (int)$imageInfo[1]
                );
                imageinterlace($optimizedImage, true);
                $saved = $resized && @imagejpeg($optimizedImage, $outputPath, 80);
                imagedestroy($optimizedImage);
                imagedestroy($sourceImage);
                if (!$saved) {
                    error_log('TripLink hero images: failed to optimize ' . $file['name']);
                } elseif (file_put_contents($sourceStampPath, $sourceHash, LOCK_EX) === false) {
                    error_log('TripLink hero images: failed to record the optimized source for ' . $file['name']);
                }
            } else {
                error_log('TripLink hero images: unsupported or unreadable image format for ' . $file['name']);
            }
        } elseif (!$outputIsCurrent) {
            error_log('TripLink hero images: GD or the optimized image directory is unavailable for ' . $file['name']);
        }

        $savedSourceHash = is_file($sourceStampPath) ? trim((string)file_get_contents($sourceStampPath)) : '';
        $outputIsCurrent = is_file($outputPath)
            && (filemtime($outputPath) ?: 0) >= $sourceModified
            && hash_equals($sourceHash, $savedSourceHash);
        if ($outputIsCurrent) {
            $assetUrl = 'assets/img/optimized/' . rawurlencode($outputName);
            $assetType = 'image/jpeg';
        } else {
            error_log('TripLink hero images: serving original because optimization is unavailable for ' . $file['name']);
        }
    }

    $entry = $metadata[$file['stem']] ?? [
        'focus' => '50% 50%',
        'alt' => 'Bus photo from TripLink',
        'overlay' => ['start' => '.97', 'mid' => '.84', 'end' => '.58'],
    ];
    $fallbackIndex = $index < 4 ? $index + 1 : 1;
    $version = $sourceModified . '-' . $sourceSize . '-' . substr($sourceHash, 0, 12);
    $slides[] = [
        'src' => $assetUrl . '?v=' . $version,
        'fallback' => 'assets/img/hero' . $fallbackIndex . '.svg',
        'type' => $assetType,
        'focus' => $entry['focus'],
        'alt' => $entry['alt'],
        'overlay' => $entry['overlay'],
    ];
}

echo json_encode(['slides' => $slides], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
