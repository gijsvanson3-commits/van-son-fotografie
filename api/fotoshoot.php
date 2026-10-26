<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require_once __DIR__ . '/fotoshoot-lib.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function shoot_response(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        shoot_response(405, ['message' => 'Deze aanvraagmethode wordt niet ondersteund.']);
    }
    $settings = shoot_settings();
    [$config, $version] = shoot_config();
    $isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true) && PHP_SAPI === 'cli-server';
    if ($isLocal) $settings['allowedOrigins'][] = 'http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if (($origin !== null && !in_array($origin, $settings['allowedOrigins'], true)) || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        shoot_response(403, ['message' => 'Open de aanvraag via de website en probeer opnieuw.']);
    }
    $captcha = shoot_bot_config($settings, $isLocal);
    session_name('vanson_shoot');
    if (!session_start([
        'use_strict_mode' => 1,
        'use_only_cookies' => 1,
        'cookie_httponly' => 1,
        'cookie_secure' => !$isLocal,
        'cookie_samesite' => 'Strict',
        'cookie_path' => '/api',
        'gc_maxlifetime' => 7200,
    ])) throw new RuntimeException('Session unavailable');
    if (!isset($_SESSION['csrf']) || ($_SESSION['expires'] ?? 0) < time()) {
        $_SESSION = ['csrf' => bin2hex(random_bytes(32)), 'expires' => time() + 7200, 'sent' => []];
    }
    if ($method === 'GET') {
        shoot_response(200, ['captcha' => $captcha, 'config' => $config, 'configVersion' => $version, 'csrfToken' => $_SESSION['csrf'], 'requestId' => bin2hex(random_bytes(16))]);
    }
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') shoot_response(415, ['message' => 'Verstuur je aanvraag via het formulier.']);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) shoot_response(413, ['message' => 'De aanvraag is te groot. Kort je opmerkingen in.']);
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if ($raw === false || strlen($raw) > 32768) shoot_response(413, ['message' => 'De aanvraag is te groot.']);
    try {
        $payload = json_decode($raw, true, 24, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        shoot_response(400, ['message' => 'De aanvraag kon niet worden gelezen. Probeer opnieuw.']);
    }
    if (!is_array($payload)) shoot_response(400, ['message' => 'Ongeldige aanvraag.']);
    if (!is_string($payload['csrfToken'] ?? null) || !hash_equals($_SESSION['csrf'], $payload['csrfToken'])) shoot_response(403, ['message' => 'Je sessie is verlopen. Probeer opnieuw.']);
    if (($payload['website'] ?? '') !== '') shoot_response(422, ['message' => 'De aanvraag kon niet worden verwerkt. Mail je wensen naar info@vansonfotografie.nl.']);
    $requestId = $payload['requestId'] ?? null;
    if (!is_string($requestId) || !preg_match('/^[a-f0-9]{32}$/D', $requestId)) shoot_response(422, ['message' => 'Ongeldige aanvraagreferentie. Herlaad het formulier.']);
    // De sessielock voorkomt gelijktijdige dubbele mails, ook bij opnieuw proberen na een netwerkfout.
    if (isset($_SESSION['sent'][$requestId])) shoot_response(200, ['success' => true, 'reference' => $_SESSION['sent'][$requestId]]);
    if (($payload['configVersion'] ?? '') !== $version) shoot_response(409, ['message' => 'De instellingen of tarieven zijn gewijzigd. Herlaad de pagina en controleer je aanvraag opnieuw.']);
    $validated = shoot_validate($config, $payload);
    if ($settings['enabled'] !== true) shoot_response(503, ['message' => 'Online versturen is tijdelijk niet beschikbaar. Mail je wensen naar info@vansonfotografie.nl.']);
    if ($captcha !== null) shoot_bot_token($payload['turnstileToken'] ?? null);
    if (!shoot_rate_limit($settings['rateDirectory'], $_SERVER['REMOTE_ADDR'] ?? 'unknown')) {
        header('Retry-After: 3600');
        shoot_response(429, ['message' => 'Er zijn te veel aanvragen verstuurd. Probeer het over een uur opnieuw of mail info@vansonfotografie.nl.']);
    }
    if ($captcha !== null) shoot_bot_verify($settings, $payload['turnstileToken'] ?? null, $requestId);
    $reference = strtoupper(substr($requestId, 0, 12));
    if (!shoot_send($settings, $validated, $reference)) shoot_response(502, ['message' => 'Versturen is niet gelukt. Je keuzes zijn bewaard. Probeer opnieuw of mail info@vansonfotografie.nl.']);
    $_SESSION['sent'][$requestId] = $reference;
    if (count($_SESSION['sent']) > 20) array_shift($_SESSION['sent']);
    shoot_response(200, ['success' => true, 'reference' => $reference]);
} catch (ShootBotException) {
    shoot_response(422, ['code' => 'captcha', 'message' => 'Rond de botcontrole opnieuw af en verstuur je aanvraag nogmaals.']);
} catch (ShootBotUnavailableException) {
    shoot_response(503, ['code' => 'captcha', 'message' => 'De botcontrole is tijdelijk niet beschikbaar. Je keuzes zijn bewaard. Probeer opnieuw of mail info@vansonfotografie.nl.']);
} catch (ShootValidationException $error) {
    shoot_response(422, ['message' => $error->getMessage()]);
} catch (Throwable) {
    // Geen persoonsgegevens, sessies, sleutels of ruwe foutdetails naar logs of bezoekers.
    shoot_response(500, ['message' => 'De aanvraag kon tijdelijk niet worden verwerkt. Probeer opnieuw of mail info@vansonfotografie.nl.']);
}
