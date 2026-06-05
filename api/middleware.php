<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

function isSecureConnection(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
}

function secureHeaders(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    ensureCsrfCookie();
}

function ensureCsrfCookie(): void
{
    if (getCsrfToken()) {
        return;
    }
    $token = generateToken(16);
    setcookie(CSRF_COOKIE, $token, [
        'expires' => time() + SESSION_LIFETIME,
        'path' => '/',
        'secure' => isSecureConnection(),
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[CSRF_COOKIE] = $token;
}

function allowCorsPreflight(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errorResponse(string $message, int $status = 400): void
{
    jsonResponse(['success' => false, 'error' => $message], $status);
}

function parseJsonInput(): array
{
    $body = file_get_contents('php://input');
    if (empty($body)) {
        return [];
    }

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        errorResponse('Geçersiz JSON formatı', 400);
    }
    return is_array($data) ? $data : [];
}

function getSessionToken(): ?string
{
    return $_COOKIE[SESSION_COOKIE] ?? null;
}

function getCsrfToken(): ?string
{
    return $_COOKIE[CSRF_COOKIE] ?? null;
}

function requireAuth(): array
{
    $token = getSessionToken();
    if (!$token) {
        errorResponse('Kullanıcı girişi gerekli', 401);
    }

    $hash = hashToken($token);
    $session = dbFetch('SELECT s.user_id, u.id AS user_id, u.name, u.email FROM sessions s INNER JOIN users u ON s.user_id = u.id WHERE s.token_hash = :hash AND s.expires_at > NOW()', ['hash' => $hash]);
    if (!$session) {
        errorResponse('Oturum geçersiz veya süresi dolmuş', 401);
    }

    return $session;
}

function createAuthCookies(string $token, bool $remember = false): void
{
    $expire = time() + ($remember ? 60 * 60 * 24 * 30 : SESSION_LIFETIME);
    setcookie(SESSION_COOKIE, $token, [
        'expires' => $expire,
        'path' => '/',
        'secure' => isSecureConnection(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    $csrf = generateToken(16);
    setcookie(CSRF_COOKIE, $csrf, [
        'expires' => $expire,
        'path' => '/',
        'secure' => isSecureConnection(),
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[CSRF_COOKIE] = $csrf;
}

function validateCsrf(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        return;
    }
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $cookieToken = getCsrfToken();
    if (!$headerToken || !$cookieToken || !hash_equals($cookieToken, $headerToken)) {
        errorResponse('CSRF doğrulaması başarısız', 403);
    }
}

function destroySession(): void
{
    $token = getSessionToken();
    if ($token) {
        $hash = hashToken($token);
        dbExecute('DELETE FROM sessions WHERE token_hash = :hash', ['hash' => $hash]);
    }
    setcookie(SESSION_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    setcookie(CSRF_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => false, 'samesite' => 'Lax']);
}

function getAuthenticatedUser(): ?array
{
    $token = getSessionToken();
    if (!$token) {
        return null;
    }
    $hash = hashToken($token);
    $session = dbFetch('SELECT u.id AS user_id, u.name, u.email FROM sessions s INNER JOIN users u ON s.user_id = u.id WHERE s.token_hash = :hash AND s.expires_at > NOW()', ['hash' => $hash]);
    return $session ?: null;
}

function rateLimit(int $userId, string $endpoint, int $limit = 10, int $windowMinutes = 1): void
{
    $resetTime = date('Y-m-d H:i:s', time() + $windowMinutes * 60);
    $existing = dbFetch('SELECT requests, reset_time FROM rate_limits WHERE user_id = :user_id AND endpoint = :endpoint', ['user_id' => $userId, 'endpoint' => $endpoint]);
    if ($existing) {
        if (strtotime($existing['reset_time']) > time()) {
            if ($existing['requests'] >= $limit) {
                errorResponse('Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.', 429);
            }
            dbQuery('UPDATE rate_limits SET requests = requests + 1 WHERE user_id = :user_id AND endpoint = :endpoint', ['user_id' => $userId, 'endpoint' => $endpoint]);
        } else {
            dbQuery('UPDATE rate_limits SET requests = 1, reset_time = :reset WHERE user_id = :user_id AND endpoint = :endpoint', ['user_id' => $userId, 'endpoint' => $endpoint, 'reset' => $resetTime]);
        }
    } else {
        dbQuery('INSERT INTO rate_limits (user_id, endpoint, requests, reset_time) VALUES (:user_id, :endpoint, 1, :reset)', ['user_id' => $userId, 'endpoint' => $endpoint, 'reset' => $resetTime]);
    }
}

function logError(string $message, array $context = []): void
{
    $logFile = __DIR__ . '/../app.log';
    $entry = date('Y-m-d H:i:s') . ' ERROR: ' . $message . ' ' . json_encode($context, JSON_UNESCAPED_UNICODE) . PHP_EOL;
    file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}
