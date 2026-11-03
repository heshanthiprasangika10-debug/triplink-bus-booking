<?php
require_once __DIR__ . '/../api/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function admin_require_login(): void
{
    if (empty($_SESSION['admin'])) {
        header('Location: index.php');
        exit;
    }
}

function admin_escape($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function admin_token(): string
{
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['admin_csrf'];
}

function admin_verify_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }
    $provided = (string)($_POST['csrf_token'] ?? '');
    if (!hash_equals(admin_token(), $provided)) {
        http_response_code(403);
        exit('Request expired. Refresh the page and try again.');
    }
}

function admin_audit(PDO $pdo, string $action, string $entity, ?int $entityId, array $details = []): void
{
    $statement = $pdo->prepare(
        'INSERT INTO admin_audit (admin, action, entity, entity_id, details, ip)
         VALUES (:admin, :action, :entity, :entity_id, :details, :ip)'
    );
    $statement->execute([
        ':admin' => 'admin',
        ':action' => $action,
        ':entity' => $entity,
        ':entity_id' => $entityId,
        ':details' => json_encode($details, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        ':ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}

function admin_redirect(string $section, string $type, string $message): void
{
    $_SESSION['admin_flash'] = ['type' => $type, 'message' => $message];
    header('Location: manage.php?section=' . rawurlencode($section));
    exit;
}

function admin_flash(): ?array
{
    $flash = $_SESSION['admin_flash'] ?? null;
    unset($_SESSION['admin_flash']);
    return is_array($flash) ? $flash : null;
}

function admin_id($value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT);
    if (!$id || $id < 1) {
        throw new RuntimeException('Choose a valid record.');
    }
    return $id;
}

function admin_audit_details(array $data): string
{
    return admin_escape(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}
