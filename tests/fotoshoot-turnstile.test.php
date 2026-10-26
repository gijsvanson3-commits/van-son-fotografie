<?php
declare(strict_types=1);
require __DIR__ . '/../api/fotoshoot-turnstile.php';
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function rejects(callable $action, string $class): void {
    try { $action(); } catch (Throwable $error) { check($error instanceof $class, 'Expected ' . $class); return; }
    throw new RuntimeException('Expected rejection: ' . $class);
}
$settings = ['turnstileSiteKey' => 'registered-site-key', 'turnstileSecretKey' => 'private-test-secret', 'allowedOrigins' => ['https://vansonfotografie.nl', 'https://www.vansonfotografie.nl']];
$id = str_repeat('a', 32);
$accepted = ['success' => true, 'hostname' => 'vansonfotografie.nl', 'action' => 'fotoshoot_request', 'cdata' => $id];
check(shoot_bot_config([]) === null, 'Unconfigured keeps existing spam controls');
check(shoot_bot_config($settings) === ['siteKey' => 'registered-site-key', 'action' => 'fotoshoot_request'], 'Only public settings exposed');
rejects(fn() => shoot_bot_config(['turnstileSiteKey' => 'one-key']), ShootBotUnavailableException::class);
rejects(fn() => shoot_bot_config(['turnstileSecretKey' => 'one-key']), ShootBotUnavailableException::class);
foreach (['1', '2', '3'] as $prefix) {
    rejects(fn() => shoot_bot_config(array_replace($settings, ['turnstileSiteKey' => $prefix . 'x00000000000000000000AA'])), ShootBotUnavailableException::class);
    rejects(fn() => shoot_bot_config(array_replace($settings, ['turnstileSecretKey' => $prefix . 'x0000000000000000000000000000000AA'])), ShootBotUnavailableException::class);
}
check(shoot_bot_config(array_replace($settings, ['turnstileSiteKey' => '1x00000000000000000000AA']), true) !== null, 'Test keys only on local CLI server');
foreach ([null, [], 4, '', 'token with spaces', "token\n", str_repeat('a', 2049)] as $token) {
    rejects(fn() => shoot_bot_verify($settings, $token, $id, fn() => throw new RuntimeException('Transport must not run')), ShootBotException::class);
}
check(shoot_bot_token(str_repeat('a', 2048)) === str_repeat('a', 2048), 'Maximum token size');
$calls = 0;
shoot_bot_verify($settings, 'opaque-token', $id, function ($secret, $token) use (&$calls, $accepted) {
    $calls++;
    check($secret === 'private-test-secret' && $token === 'opaque-token', 'Secret and token supplied to server transport');
    return $accepted;
});
check($calls === 1, 'Provider consulted before success');
shoot_bot_verify($settings, 'opaque-token', $id, fn() => array_replace($accepted, ['hostname' => 'www.vansonfotografie.nl']));
check(true, 'WWW host allowed');
foreach ([['hostname' => 'attacker.example'], ['hostname' => 'vansonfotografie.nl.attacker.example'], ['hostname' => ''], ['action' => 'other_form'], ['cdata' => 'other-request'], ['cdata' => '']] as $change) {
    rejects(fn() => shoot_bot_verify($settings, 'opaque-token', $id, fn() => array_replace($accepted, $change)), ShootBotException::class);
}
foreach (['invalid-input-response', 'timeout-or-duplicate', 'missing-input-response'] as $error) {
    rejects(fn() => shoot_bot_verify($settings, 'opaque-token', $id, fn() => ['success' => false, 'error-codes' => [$error]]), ShootBotException::class);
}
foreach (['invalid-input-secret', 'missing-input-secret', 'bad-request', 'internal-error'] as $error) {
    rejects(fn() => shoot_bot_verify($settings, 'opaque-token', $id, fn() => ['success' => false, 'error-codes' => [$error]]), ShootBotUnavailableException::class);
}
rejects(fn() => shoot_bot_verify($settings, 'opaque-token', $id, fn() => throw new ShootBotUnavailableException()), ShootBotUnavailableException::class);
echo 'Turnstile PHP: ' . $checks . " checks passed (provider fixtures, no external mail).\n";
