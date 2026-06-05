<?php
declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
secureHeaders();
allowCorsPreflight();
validateCsrf();
$user = requireAuth();
rateLimit($user['user_id'], 'ai', 10, 1);

$input = parseJsonInput();
$prompt = trim((string) ($input['prompt'] ?? ''));
$jsonMode = filter_var($input['jsonMode'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$prompt) {
    errorResponse('AI prompt gerekli.', 422);
}

$key = getAiKey();
if (!$key) {
    errorResponse('Sunucu yapısında AI anahtarı tanımlı değil.', 500);
}

$responseText = '';
$success = true;

try {
    $responseText = callGemini($prompt, $key, $jsonMode);
} catch (Throwable $exception) {
    $success = false;
    $responseText = 'AI hizmetine bağlanırken sorun oluştu: ' . $exception->getMessage();
    logError('AI API error', ['user_id' => $user['user_id'], 'error' => $exception->getMessage()]);
}

$dbPayload = [
    'user_id' => (int) $user['user_id'],
    'prompt' => $prompt,
    'response' => $responseText,
    'provider' => 'gemini',
    'is_json' => $jsonMode ? 1 : 0,
    'response_time' => 0,
];

dbQuery('INSERT INTO ai_history (user_id, prompt, response, provider, is_json, response_time, created_at) VALUES (:user_id, :prompt, :response, :provider, :is_json, :response_time, NOW())', $dbPayload);

if (!$success) {
    errorResponse($responseText, 502);
}

jsonResponse(['success' => true, 'text' => $responseText]);

function callGemini(string $prompt, string $apiKey, bool $jsonMode): string
{
    $candidateModels = array_unique(array_filter([
        getGeminiModel(),
        'gemini-1.5-flash',
    ]));

    $lastError = null;
    foreach ($candidateModels as $model) {
        $payload = [
            'prompt' => [
                'text' => $prompt,
            ],
            'temperature' => $jsonMode ? 0.0 : 0.3,
            'maxOutputTokens' => 900,
            'candidateCount' => 1,
        ];

        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta2/models/%s:generateText?key=%s',
            urlencode($model),
            urlencode($apiKey)
        );
        $result = performCurlRequestResponse($url, $payload);
        if ($result['status'] === 404 || $result['status'] === 400) {
            logError('Gemini model endpoint hatasi', ['model' => $model, 'status' => $result['status'], 'body' => $result['body']]);
            $lastError = new RuntimeException("Gemini model hatasi: {$model} ({$result['status']})");
            continue;
        }
        if ($result['error'] || $result['status'] >= 400) {
            throw new RuntimeException($result['error'] ?: "Gemini HTTP status {$result['status']}");
        }

        $data = json_decode($result['body'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $lastError = new RuntimeException('AI yanıtı JSON olarak çözümlenemedi.');
            continue;
        }

        if (isset($data['candidates'][0]['output'])) {
            return trim((string) $data['candidates'][0]['output']);
        }
        if (isset($data['candidates'][0]['content'][0]['text'])) {
            return trim((string) $data['candidates'][0]['content'][0]['text']);
        }
        if (isset($data['output'])) {
            return trim((string) $data['output']);
        }

        $lastError = new RuntimeException('AI yanıtı beklenen formatta değildi.');
    }

    throw $lastError ?: new RuntimeException('Gemini API ile iletişim kurulamadı.');
}

function performCurlRequestResponse(string $url, array $payload, array $headers = []): array
{
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($curl);
    $error = curl_error($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    return [
        'status' => $status,
        'error' => $error,
        'body' => $response,
    ];
}

function performCurlRequest(string $url, array $payload, array $headers = []): string
{
    $result = performCurlRequestResponse($url, $payload, $headers);
    if ($result['error'] || $result['status'] >= 400) {
        throw new RuntimeException($result['error'] ?: "HTTP status {$result['status']}");
    }

    $data = json_decode($result['body'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('AI yanıtı JSON olarak çözümlenemedi.');
    }

    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        return trim((string) $data['candidates'][0]['content']['parts'][0]['text']);
    }
    if (isset($data['completion'])) {
        return trim((string) $data['completion']);
    }

    throw new RuntimeException('AI yanıtı beklenen formatta değildi.');
}
