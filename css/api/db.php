<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function getPDO(?string $database = null): PDO
{
    static $pdoInstances = [];
    $dsn = getDatabaseDsn($database);
    if (isset($pdoInstances[$dsn]) && $pdoInstances[$dsn] instanceof PDO) {
        return $pdoInstances[$dsn];
    }

    $user = env(DB_USER, 'root');
    $pass = env(DB_PASS, '');

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES ' . DB_CHARSET,
    ];

    try {
        $pdoInstances[$dsn] = new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $exception) {
        $driverCode = isset($exception->errorInfo[1]) ? (int) $exception->errorInfo[1] : null;
        if ($driverCode === 1049) {
            throw new RuntimeException(
                'Database "' . env(DB_NAME, 'studyai') . '" not found. Create it using database.sql and a local .env file, or copy .env.example to .env with correct MySQL settings.'
            );
        }
        throw $exception;
    }

    return $pdoInstances[$dsn];
}

function dbQuery(string $sql, array $params = []): PDOStatement
{
    $stmt = getPDO()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function dbFetchAll(string $sql, array $params = []): array
{
    return dbQuery($sql, $params)->fetchAll();
}

function dbFetch(string $sql, array $params = []): array
{
    $result = dbQuery($sql, $params)->fetch();
    return $result === false ? [] : $result;
}

function dbExecute(string $sql, array $params = []): int
{
    return dbQuery($sql, $params)->rowCount();
}

function generateToken(int $length = 32): string
{
    return bin2hex(random_bytes($length));
}

function hashToken(string $token): string
{
    return hash_hmac('sha256', $token, env('APP_SECRET', 'studyai_secret_key'));
}
