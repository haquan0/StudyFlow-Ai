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

function getCourseIdByUid(?string $uid, int $userId): ?int
{
    if (!$uid) {
        return null;
    }
    $course = dbFetch('SELECT id FROM courses WHERE user_id = :user_id AND uid = :uid', ['user_id' => $userId, 'uid' => $uid]);
    return $course ? (int) $course['id'] : null;
}

function sanitizeUid(?string $uid): string
{
    return trim((string) $uid);
}

if ($method === 'GET') {
    $type = $_GET['type'] ?? 'full';
    if ($type === 'courses') {
        $courses = dbFetchAll('SELECT * FROM courses WHERE user_id = :user_id ORDER BY exam_date ASC', ['user_id' => $userId]);
        jsonResponse(['success' => true, 'data' => $courses]);
    }
    if ($type === 'tasks') {
        $tasks = dbFetchAll('SELECT * FROM tasks WHERE user_id = :user_id ORDER BY created_at DESC', ['user_id' => $userId]);
        jsonResponse(['success' => true, 'data' => $tasks]);
    }
    if ($type === 'settings') {
        $settings = dbFetch('SELECT data FROM settings WHERE user_id = :user_id', ['user_id' => $userId]);
        jsonResponse(['success' => true, 'data' => $settings ? json_decode($settings['data'], true) : null]);
    }
    if ($type === 'full') {
        $courses = dbFetchAll('SELECT * FROM courses WHERE user_id = :user_id ORDER BY exam_date ASC', ['user_id' => $userId]);
        $tasks = dbFetchAll('SELECT * FROM tasks WHERE user_id = :user_id ORDER BY created_at DESC', ['user_id' => $userId]);
        $studySessions = dbFetchAll('SELECT * FROM study_sessions WHERE user_id = :user_id ORDER BY created_at DESC', ['user_id' => $userId]);
        $achievements = dbFetchAll('SELECT * FROM achievements WHERE user_id = :user_id ORDER BY created_at DESC', ['user_id' => $userId]);
        $settings = dbFetch('SELECT data FROM settings WHERE user_id = :user_id', ['user_id' => $userId]);
        $aiHistory = dbFetchAll('SELECT id, prompt, response, provider, created_at FROM ai_history WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 20', ['user_id' => $userId]);
        jsonResponse(['success' => true, 'data' => ['courses' => $courses, 'tasks' => $tasks, 'studySessions' => $studySessions, 'achievements' => $achievements, 'settings' => $settings ? json_decode($settings['data'], true) : null, 'aiHistory' => $aiHistory]]);
    }
    errorResponse('Geçersiz sorgu tipi', 400);
}

$action = $input['action'] ?? null;
if (!$action) {
    errorResponse('action parametresi gereklidir', 400);
}

if ($action === 'sync') {
    $payload = $input['payload'] ?? [];
    $courses = isset($payload['courses']) && is_array($payload['courses']) ? $payload['courses'] : [];
    $tasks = isset($payload['tasks']) && is_array($payload['tasks']) ? $payload['tasks'] : [];
    $achievements = isset($payload['achievements']) && is_array($payload['achievements']) ? $payload['achievements'] : [];
    $studySessions = isset($payload['studySessions']) && is_array($payload['studySessions']) ? $payload['studySessions'] : [];
    $settings = isset($payload['settings']) && is_array($payload['settings']) ? $payload['settings'] : [];

    dbQuery('DELETE FROM courses WHERE user_id = :user_id', ['user_id' => $userId]);
    dbQuery('DELETE FROM tasks WHERE user_id = :user_id', ['user_id' => $userId]);
    dbQuery('DELETE FROM achievements WHERE user_id = :user_id', ['user_id' => $userId]);
    dbQuery('DELETE FROM study_sessions WHERE user_id = :user_id', ['user_id' => $userId]);

    foreach ($courses as $course) {
        dbQuery('INSERT INTO courses (user_id, uid, name, exam_date, daily_hours, difficulty, color, completed_hours, created_at, updated_at) VALUES (:user_id, :uid, :name, :exam_date, :daily_hours, :difficulty, :color, :completed_hours, NOW(), NOW())', [
            'user_id' => $userId,
            'uid' => sanitizeUid($course['id'] ?? $course['uid'] ?? bin2hex(random_bytes(8))),
            'name' => $course['name'] ?? 'Yeni Ders',
            'exam_date' => $course['examDate'] ?? date('Y-m-d', strtotime('+7 days')),
            'daily_hours' => $course['dailyHours'] ?? 2,
            'difficulty' => $course['difficulty'] ?? 2,
            'color' => $course['color'] ?? '#7c3aed',
            'completed_hours' => $course['completedHours'] ?? 0,
        ]);
    }

    foreach ($tasks as $task) {
        $courseUid = sanitizeUid($task['courseId'] ?? $task['courseUid'] ?? null);
        $remoteCourseId = getCourseIdByUid($courseUid, $userId);
        dbQuery('INSERT INTO tasks (user_id, uid, course_uid, course_id, name, date, duration, duration_minutes, done, created_at, updated_at) VALUES (:user_id, :uid, :course_uid, :course_id, :name, :date, :duration, :duration_minutes, :done, NOW(), NOW())', [
            'user_id' => $userId,
            'uid' => sanitizeUid($task['id'] ?? $task['uid'] ?? bin2hex(random_bytes(8))),
            'course_uid' => $courseUid,
            'course_id' => $remoteCourseId,
            'name' => $task['name'] ?? 'Görev',
            'date' => $task['date'] ?? date('Y-m-d'),
            'duration' => $task['duration'] ?? 1,
            'duration_minutes' => $task['durationMinutes'] ?? ceil(($task['duration'] ?? 1) * 60),
            'done' => $task['done'] ? 1 : 0,
        ]);
    }

    foreach ($achievements as $achievement) {
        dbQuery('INSERT INTO achievements (user_id, uid, achievement_key, unlocked_at, progress, metadata, created_at) VALUES (:user_id, :uid, :achievement_key, :unlocked_at, :progress, :metadata, NOW())', [
            'user_id' => $userId,
            'uid' => sanitizeUid($achievement['id'] ?? $achievement['uid'] ?? uniqid('ach_', true)),
            'achievement_key' => $achievement['id'] ?? $achievement['uid'] ?? uniqid('ach_key_', true),
            'unlocked_at' => $achievement['unlockedAt'] ?? null,
            'progress' => $achievement['progress'] ?? 0,
            'metadata' => json_encode($achievement, JSON_UNESCAPED_UNICODE),
        ]);
    }

    foreach ($studySessions as $session) {
        $courseUid = sanitizeUid($session['courseId'] ?? $session['courseUid'] ?? null);
        $remoteCourseId = getCourseIdByUid($courseUid, $userId);
        dbQuery('INSERT INTO study_sessions (user_id, uid, type, title, minutes, course_id, course_uid, created_at) VALUES (:user_id, :uid, :type, :title, :minutes, :course_id, :course_uid, :created_at)', [
            'user_id' => $userId,
            'uid' => sanitizeUid($session['id'] ?? $session['uid'] ?? bin2hex(random_bytes(8))),
            'type' => $session['type'] ?? 'task',
            'title' => $session['title'] ?? 'Oturum',
            'minutes' => $session['minutes'] ?? 0,
            'course_id' => $remoteCourseId,
            'course_uid' => $courseUid,
            'created_at' => $session['createdAt'] ?? date('Y-m-d H:i:s'),
        ]);
    }

    dbQuery('INSERT INTO settings (user_id, data, updated_at) VALUES (:user_id, :data, NOW()) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()', [
        'user_id' => $userId,
        'data' => json_encode($settings, JSON_UNESCAPED_UNICODE),
    ]);

    jsonResponse(['success' => true, 'message' => 'Veri başarıyla senkronize edildi.']);
}

if ($method === 'POST') {
    if ($action === 'toggleTask') {
        $taskId = (int) ($input['taskId'] ?? 0);
        if (!$taskId) {
            errorResponse('taskId gerekli', 422);
        }
        $task = dbFetch('SELECT id, done, duration, course_id FROM tasks WHERE id = :id AND user_id = :user_id', ['id' => $taskId, 'user_id' => $userId]);
        if (!$task) {
            errorResponse('Görev bulunamadı', 404);
        }
        $done = $task['done'] ? 0 : 1;
        dbQuery('UPDATE tasks SET done = :done, updated_at = NOW() WHERE id = :id', ['done' => $done, 'id' => $taskId]);
        jsonResponse(['success' => true, 'task' => ['id' => $taskId, 'done' => $done]]);
    }

    if ($action === 'addCourse') {
        $course = $input['course'] ?? [];
        $name = trim((string) ($course['name'] ?? 'Yeni Ders'));
        $examDate = $course['examDate'] ?? date('Y-m-d', strtotime('+7 days'));
        $dailyHours = (float) ($course['dailyHours'] ?? 2);
        $difficulty = (int) ($course['difficulty'] ?? 2);
        $color = $course['color'] ?? '#7c3aed';

        dbQuery('INSERT INTO courses (user_id, name, exam_date, daily_hours, difficulty, color, completed_hours, created_at, updated_at) VALUES (:user_id, :name, :exam_date, :daily_hours, :difficulty, :color, 0, NOW(), NOW())', [
            'user_id' => $userId,
            'name' => $name,
            'exam_date' => $examDate,
            'daily_hours' => $dailyHours,
            'difficulty' => $difficulty,
            'color' => $color,
        ]);
        $courseId = (int) getPDO()->lastInsertId();
        jsonResponse(['success' => true, 'course' => ['id' => $courseId, 'name' => $name, 'examDate' => $examDate, 'dailyHours' => $dailyHours, 'difficulty' => $difficulty, 'color' => $color]]);
    }
}

errorResponse('Geçersiz endpoint veya action', 400);
