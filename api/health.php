<?php
declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
secureHeaders();
allowCorsPreflight();

$status = 'ok';
$envStatus = [];

$json = [
    'success' => true,
    'status' => $status,
    'activeProvider' => 'local',
    'envStatus' => $envStatus,
    'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM),
    'environment' => appEnv(),
];

jsonResponse($json);
