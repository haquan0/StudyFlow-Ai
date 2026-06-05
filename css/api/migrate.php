<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if (strtolower(env('APP_ENV', 'production')) !== 'development') {
    echo json_encode(['success' => false, 'message' => 'Migrate script sadece development ortamında kullanilabilir.']);
    exit;
}

try {
    $sql = file_get_contents(__DIR__ . '/../database.sql');
    if ($sql === false) {
        throw new RuntimeException('database.sql dosyasi bulunamadi.');
    }

    try {
        getPDO()->exec($sql);
    } catch (Throwable $exception) {
        $driverCode = null;
        if ($exception instanceof PDOException) {
            $driverCode = isset($exception->errorInfo[1]) ? (int) $exception->errorInfo[1] : null;
        } elseif (strpos($exception->getMessage(), 'Database "' . env(DB_NAME, 'studyai') . '" not found') !== false) {
            $driverCode = 1049;
        }

        if ($driverCode === 1049) {
            $database = env(DB_NAME, 'studyai');
            $serverPdo = getPDO('');
            $serverPdo->exec(
                'CREATE DATABASE IF NOT EXISTS `' . $database . '` CHARACTER SET ' . DB_CHARSET . ' COLLATE utf8mb4_unicode_ci'
            );
            getPDO()->exec($sql);
        } else {
            throw $exception;
        }
    }

    echo json_encode(['success' => true, 'message' => 'Migration tamamlandi.']);
} catch (Throwable $error) {
    echo json_encode(['success' => false, 'message' => $error->getMessage()]);
}
