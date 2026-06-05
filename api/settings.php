<?php
declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
secureHeaders();
allowCorsPreflight();
validateCsrf();
$user = requireAuth();
$userId = (int) $user['user_id'];

$method = $_SERVER['REQUEST_METHOD'];
$input = parseJsonInput();

if ($method === 'GET') {
    $settings = dbFetch('SELECT data FROM settings WHERE user_id = :user_id', ['user_id' => $userId]);
    jsonResponse(['success' => true, 'data' => $settings ? json_decode($settings['data'], true) : null]);
}

if ($method === 'POST') {
    $payload = $input['settings'] ?? [];
    if (!is_array($payload)) {
        errorResponse('Geçersiz settings verisi.', 422);
    }
    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE);
    dbQuery('INSERT INTO settings (user_id, data, updated_at) VALUES (:user_id, :data, NOW()) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()', ['user_id' => $userId, 'data' => $encoded]);
    jsonResponse(['success' => true, 'message' => 'Ayarlar kaydedildi.', 'data' => $payload]);
}

errorResponse('Geçersiz istek yöntemi.', 405);
