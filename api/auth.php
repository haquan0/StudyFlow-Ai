<?php
declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
secureHeaders();
allowCorsPreflight();
validateCsrf();

$method = $_SERVER['REQUEST_METHOD'];
$input = parseJsonInput();

if ($method === 'GET') {
    $user = getAuthenticatedUser();
    if (!$user) {
        jsonResponse(['success' => true, 'authenticated' => false]);
    }
    jsonResponse([
        'success' => true,
        'authenticated' => true,
        'user' => [
            'id' => (int) $user['user_id'],
            'name' => $user['name'],
            'email' => $user['email'],
        ],
    ]);
}

$action = $input['action'] ?? $_GET['action'] ?? null;
if (!$action) {
    errorResponse('action parametresi gerekli', 400);
}

if ($action === 'register') {
    $name = trim((string) ($input['name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $remember = filter_var($input['remember'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if (!$name || !$email || !$password) {
        errorResponse('Ad, e-posta ve şifre zorunlu.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Geçerli bir e-posta girin.', 422);
    }

    $existing = dbFetch('SELECT id FROM users WHERE email = :email', ['email' => $email]);
    if ($existing) {
        errorResponse('Bu e-posta zaten kullanılıyor.', 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    dbQuery('INSERT INTO users (name, email, password_hash, created_at) VALUES (:name, :email, :password_hash, NOW())', [
        'name' => $name,
        'email' => $email,
        'password_hash' => $passwordHash,
    ]);
    $userId = (int) getPDO()->lastInsertId();
    $sessionToken = generateToken(32);
    $tokenHash = hashToken($sessionToken);
    $expiresAt = (new DateTime('+' . (int) SESSION_LIFETIME . ' seconds'))->format('Y-m-d H:i:s');

    dbQuery('INSERT INTO sessions (user_id, token_hash, expires_at, created_at, user_agent, ip_address) VALUES (:user_id, :hash, :expires_at, NOW(), :ua, :ip)', [
        'user_id' => $userId,
        'hash' => $tokenHash,
        'expires_at' => $expiresAt,
        'ua' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
    ]);
    createAuthCookies($sessionToken, $remember);

    jsonResponse(['success' => true, 'message' => 'Kayıt başarılı. Yönlendiriliyorsunuz.', 'authenticated' => true, 'user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
}

if ($action === 'login') {
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $remember = filter_var($input['remember'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if (!$email || !$password) {
        errorResponse('E-posta ve şifre gerekli.', 422);
    }

    $user = dbFetch('SELECT id, name, email, password_hash FROM users WHERE email = :email', ['email' => $email]);
    if (!$user || !password_verify($password, $user['password_hash'])) {
        errorResponse('E-posta veya şifre yanlış.', 401);
    }

    $sessionToken = generateToken(32);
    $tokenHash = hashToken($sessionToken);
    $expiresAt = (new DateTime('+' . (int) SESSION_LIFETIME . ' seconds'))->format('Y-m-d H:i:s');

    dbQuery('INSERT INTO sessions (user_id, token_hash, expires_at, created_at, user_agent, ip_address) VALUES (:user_id, :hash, :expires_at, NOW(), :ua, :ip)', [
        'user_id' => $user['id'],
        'hash' => $tokenHash,
        'expires_at' => $expiresAt,
        'ua' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
    ]);
    createAuthCookies($sessionToken, $remember);

    dbQuery('UPDATE users SET last_login_at = NOW() WHERE id = :id', ['id' => $user['id']]);

    jsonResponse(['success' => true, 'message' => 'Giriş başarılı.', 'authenticated' => true, 'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email']]]);
}

if ($action === 'logout') {
    destroySession();
    jsonResponse(['success' => true, 'authenticated' => false, 'message' => 'Oturum kapatıldı.']);
}

errorResponse('Geçersiz action parametresi.', 400);
