<?php
declare(strict_types=1);

final class ShootBotException extends RuntimeException {}
final class ShootBotUnavailableException extends RuntimeException {}

function shoot_bot_config(array $settings, bool $local = false): ?array
{
    $site = trim((string)($settings['turnstileSiteKey'] ?? ''));
    $secret = trim((string)($settings['turnstileSecretKey'] ?? ''));
    if ($site === '' && $secret === '') return null;
    // Een gedeeltelijke configuratie of testsleutel op productie mag nooit controles overslaan.
    if ($site === '' || $secret === '' || (!$local && (preg_match('/^[123]x000000/', $site) || preg_match('/^[123]x000000/', $secret)))) {
        throw new ShootBotUnavailableException();
    }
    return ['siteKey' => $site, 'action' => 'fotoshoot_request'];
}

function shoot_bot_token(mixed $token): string
{
    if (!is_string($token) || $token === '' || strlen($token) > 2048 || preg_match('/[\x00-\x20\x7f]/', $token)) throw new ShootBotException();
    return $token;
}

function shoot_bot_siteverify(string $secret, string $token): array
{
    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    // Geen contactgegevens of aanvullende IP-parameter naar de verificatiedienst sturen.
    $body = http_build_query(['secret' => $secret, 'response' => $token]);
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($status !== 200) throw new ShootBotUnavailableException();
    } else {
        if (!extension_loaded('openssl') || !filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) throw new ShootBotUnavailableException();
        $context = stream_context_create([
            'http' => ['method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $body, 'timeout' => 8, 'follow_location' => 0],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $raw = @file_get_contents($url, false, $context, 0, 16385);
        if (!str_contains($http_response_header[0] ?? '', ' 200 ')) throw new ShootBotUnavailableException();
    }
    if (!is_string($raw) || strlen($raw) > 16384) throw new ShootBotUnavailableException();
    try { $result = json_decode($raw, true, 8, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ShootBotUnavailableException(); }
    if (!is_array($result) || !is_bool($result['success'] ?? null)) throw new ShootBotUnavailableException();
    return $result;
}

function shoot_bot_verify(array $settings, mixed $token, string $requestId, ?callable $verify = null): void
{
    $token = shoot_bot_token($token);
    // De optionele transportfunctie is uitsluitend voor geïsoleerde tests, nooit een requestinstelling.
    $result = ($verify ?? 'shoot_bot_siteverify')(trim($settings['turnstileSecretKey']), $token);
    if (($result['success'] ?? null) !== true) {
        $codes = $result['error-codes'] ?? [];
        if (!is_array($codes) || array_intersect(['internal-error', 'invalid-input-secret', 'missing-input-secret', 'bad-request'], $codes)) throw new ShootBotUnavailableException();
        throw new ShootBotException();
    }
    $hosts = array_map(static fn($origin) => strtolower(parse_url($origin, PHP_URL_HOST) ?: ''), $settings['allowedOrigins']);
    if (!is_string($result['hostname'] ?? null) || !in_array(strtolower($result['hostname']), $hosts, true)
        || ($result['action'] ?? '') !== 'fotoshoot_request' || ($result['cdata'] ?? '') !== $requestId) throw new ShootBotException();
}
