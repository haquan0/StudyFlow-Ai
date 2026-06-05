<?php
declare(strict_types=1);

function loadDotEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        [$key, $value] = array_map('trim', $parts);
        if ($key === '' || getenv($key) !== false) {
            continue;
        }
        putenv("$key=$value");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

loadDotEnv(__DIR__ . '/../.env');

ini_set('log_errors', '1');
ini_set('display_errors', appEnv() !== 'production' ? '1' : '0');
ini_set('display_startup_errors', appEnv() !== 'production' ? '1' : '0');
ini_set('error_log', __DIR__ . '/../php-error.log');

register_shutdown_function(function () {
    $last = error_get_last();
    if ($last === null) {
        return;
    }
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($last['type'], $fatalTypes, true)) {
        return;
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode(['success' => false, 'error' => 'Backend fatal error: ' . $last['message']]);
});

function env(string $name, $default = null)
{
    $value = getenv($name);
    if ($value === false) {
        return $default;
    }
    return $value;
}

const DB_HOST = 'DB_HOST';
const DB_NAME = 'DB_NAME';
const DB_USER = 'DB_USER';
const DB_PASS = 'DB_PASS';
const DB_PORT = 'DB_PORT';
const DB_CHARSET = 'utf8mb4';
const GEMINI_API_KEY = 'GEMINI_API_KEY';
const GEMINI_MODEL = 'GEMINI_MODEL';
const CSRF_COOKIE = 'studyai_csrf';
const SESSION_COOKIE = 'studyai_sid';
const SESSION_LIFETIME = 60 * 60 * 24 * 7;

function appEnv(): string
{
    return strtolower((string) env('APP_ENV', 'production'));
}

function getDatabaseDsn(?string $database = null): string
{
    $host = env(DB_HOST, '127.0.0.1');
    $port = env(DB_PORT, '3306');
    $name = $database ?? env(DB_NAME, 'studyai');

    $dsn = "mysql:host={$host};port={$port};charset=" . DB_CHARSET;
    if ($name !== '') {
        $dsn .= ";dbname={$name}";
    }

    return $dsn;
}

function getAiKey(): ?string
{
    return env(GEMINI_API_KEY, null);
}

function getGeminiModel(): string
{
    return env(GEMINI_MODEL, 'gemini-1.5-flash');
}
