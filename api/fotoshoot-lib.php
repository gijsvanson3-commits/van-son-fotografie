<?php
declare(strict_types=1);

require_once __DIR__ . '/fotoshoot-turnstile.php';

final class ShootValidationException extends RuntimeException {}

function shoot_config(): array
{
    $raw = file_get_contents(__DIR__ . '/../assets/config/fotoshoot.json');
    if ($raw === false) throw new RuntimeException('Configuration unavailable');
    $config = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    return [$config, hash('sha256', $raw)];
}

function shoot_settings(): array
{
    $settings = [
        'enabled' => getenv('FOTOSHOOT_MAIL_ENABLED') === 'true',
        'from' => getenv('FOTOSHOOT_MAIL_FROM') ?: 'info@vansonfotografie.nl',
        'to' => 'info@vansonfotografie.nl',
        'allowedOrigins' => ['https://vansonfotografie.nl', 'https://www.vansonfotografie.nl'],
        'rateDirectory' => getenv('FOTOSHOOT_RATE_DIRECTORY') ?: '',
        'turnstileSiteKey' => getenv('FOTOSHOOT_TURNSTILE_SITE_KEY') ?: '',
        'turnstileSecretKey' => getenv('FOTOSHOOT_TURNSTILE_SECRET_KEY') ?: '',
    ];
    if (is_file(__DIR__ . '/config.local.php')) {
        $local = require __DIR__ . '/config.local.php';
        if (!is_array($local)) throw new RuntimeException('Invalid server settings');
        $settings = array_replace($settings, $local);
    }
    return $settings;
}

function shoot_text(array $data, string $key, string $label, int $max = 200, bool $required = true): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value) || preg_match('//u', $value) !== 1) throw new ShootValidationException($label . ': ongeldige tekst.');
    $value = trim($value);
    $length = preg_match_all('/./us', $value);
    if (($required && $value === '') || $length === false || $length > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        throw new ShootValidationException($label . ': vul een geldige waarde in (maximaal ' . $max . ' tekens).');
    }
    return $value;
}

function shoot_find(array $items, mixed $id, string $label): array
{
    foreach ($items as $item) if ($item['id'] === $id) return $item;
    throw new ShootValidationException('Kies een geldig ' . $label . '.');
}

function shoot_date(string $value, string $label): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Europe/Amsterdam'));
    if (!$date || $date->format('Y-m-d') !== $value || $date < new DateTimeImmutable('today', new DateTimeZone('Europe/Amsterdam'))) {
        throw new ShootValidationException($label . ': kies vandaag of een toekomstige datum.');
    }
    return $value;
}

function shoot_money(int $cents): string
{
    return '€' . number_format($cents / 100, 2, ',', '.');
}

function shoot_packages(array $config, string $photographyId): array
{
    $category = shoot_find($config['photography'], $photographyId, 'type fotografie');
    $allowed = $category['packageIds'] ?? array_column($config['packages'], 'id');
    $packages = [];
    foreach ($config['packages'] as $pack) {
        if (in_array($pack['id'], $allowed, true)) {
            $packages[] = array_replace($pack, $category['packageOverrides'][$pack['id']] ?? [], ['id' => $pack['id']]);
        }
    }
    return $packages;
}

function shoot_quote(array $config, array $selection): array
{
    $photography = shoot_find($config['photography'], $selection['photography'] ?? null, 'type fotografie');
    $package = shoot_find(shoot_packages($config, $photography['id']), $selection['package'] ?? null, 'pakket');
    $extra = $selection['extraPhotos'] ?? null;
    $rush = $selection['rush'] ?? null;
    if (!is_int($extra) || $extra < 0 || $extra > $config['extras']['maxExtraPhotos'] || !is_bool($rush)) {
        throw new ShootValidationException('Controleer het aantal extra foto’s en de spoedlevering.');
    }
    $extraCents = $extra * $config['extras']['photoPriceCents'];
    $rushCents = $rush ? $config['extras']['rushPriceCents'] : 0;
    return [
        'totalCents' => $package['priceCents'] + $extraCents + $rushCents,
        'rows' => [
            'Fotografie' => $photography['label'],
            'Pakket' => $package['label'],
            'Pakketprijs' => shoot_money($package['priceCents']),
            'Duur' => $package['minutes'] . ' minuten',
            'Inbegrepen professioneel nabewerkte foto’s' => $package['photos'] . ' naar keuze',
            'Fotokeuze' => $package['selection'],
            'Oplevering' => $package['delivery'],
            'Extra foto’s' => $extra . ' (' . shoot_money($extraCents) . ')',
            'Spoedlevering' => $rush ? shoot_money($rushCents) : 'Nee',
            'Levertijd' => $rush ? $config['rushNotice'] : $config['standardDeliveryNotice'],
            'Totaal aantal foto’s' => (string)($package['photos'] + $extra),
            'Totale prijsindicatie' => shoot_money($package['priceCents'] + $extraCents + $rushCents),
            'Reiskosten' => $config['travelNotice'],
            'Prijsinformatie' => $config['priceNotice'],
            'Btw-afspraak' => $config['taxNotice'],
        ],
    ];
}

function shoot_option(array $data, string $key, array $options, string $label): string
{
    $id = $data[$key] ?? null;
    if (!is_string($id) || !ctype_digit($id) || (string)(int)$id !== $id || !array_key_exists((int)$id, $options)) {
        throw new ShootValidationException('Kies een geldige optie bij ' . $label . '.');
    }
    return $options[(int)$id];
}

function shoot_business(array $config, array $brief): array
{
    $category = shoot_find($config['business'], $brief['category'] ?? null, 'type opdracht');
    $rows = ['Type opdracht' => $category['label']];
    if ($category['id'] === 'evenement') {
        $rows['Ik ben op zoek naar'] = shoot_option($brief, 'coverage', $config['eventCoverage'], 'Ik ben op zoek naar');
        $rows['Naam evenement'] = shoot_text($brief, 'eventName', 'Naam evenement');
        $date = shoot_date(shoot_text($brief, 'eventDate', 'Datum evenement', 10), 'Datum evenement');
        $rows['Datum evenement'] = $date;
        $rows['Locatie'] = shoot_text($brief, 'eventLocation', 'Locatie');
        $visitors = $brief['visitors'] ?? null;
        if (!is_string($visitors) || !preg_match('/^[1-9][0-9]{0,7}$/D', $visitors) || (int)$visitors > 10000000) throw new ShootValidationException('Vul een geldig verwacht aantal bezoekers in.');
        $rows['Verwacht aantal bezoekers'] = $visitors;
        $start = shoot_text($brief, 'startTime', 'Begintijd', 5);
        $end = shoot_text($brief, 'endTime', 'Eindtijd', 5);
        foreach ([$start, $end] as $time) if (!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $time)) throw new ShootValidationException('Vul geldige begin- en eindtijden in.');
        $endDate = shoot_date(shoot_text($brief, 'endDate', 'Einddatum', 10), 'Einddatum');
        if ($endDate . 'T' . $end <= $date . 'T' . $start) throw new ShootValidationException('Het einde van de fotografie moet na het begin liggen. Controleer ook de einddatum.');
        $rows['Begin fotografie'] = $date . ' ' . $start;
        $rows['Einde fotografie'] = $endDate . ' ' . $end;
        $rows['Aanvullende wensen'] = shoot_text($brief, 'eventWishes', 'Aanvullende wensen', 3000, false) ?: 'Geen';
    } else {
        if ($category['id'] === 'horeca') {
            $subjects = $brief['subjects'] ?? null;
            if (!is_array($subjects) || !array_is_list($subjects) || count($subjects) < 1 || count($subjects) > count($config['hospitalitySubjects'])) throw new ShootValidationException('Kies minimaal één onderwerp voor de horecafotografie.');
            $labels = [];
            foreach ($subjects as $id) $labels[] = shoot_option(['id' => $id], 'id', $config['hospitalitySubjects'], 'horecaonderwerpen');
            $rows['Onderwerpen horeca'] = implode(', ', array_unique($labels));
        }
        $rows['Wat wil je laten fotograferen'] = shoot_text($brief, 'subject', 'Onderwerp', 3000);
        $rows['Geschatte omvang'] = shoot_text($brief, 'scope', 'Geschatte omvang');
        $rows['Datum of periode'] = shoot_text($brief, 'period', 'Datum of periode');
        $rows['Locatie'] = shoot_text($brief, 'businessLocation', 'Locatie');
        $rows['Gebruik van de foto’s'] = shoot_text($brief, 'usage', 'Gebruik van de foto’s', 1500);
        $rows['Specifieke wensen'] = shoot_text($brief, 'businessWishes', 'Specifieke wensen', 3000, false) ?: 'Geen';
    }
    return $rows;
}

function shoot_validate(array $config, array $payload): array
{
    $route = $payload['route'] ?? '';
    if (!in_array($route, ['private', 'business'], true)) throw new ShootValidationException('Kies een geldige route.');
    $contact = $payload['contact'] ?? null;
    if (!is_array($contact)) throw new ShootValidationException('Vul je contactgegevens in.');
    $rows = [
        'Naam' => shoot_text($contact, 'name', 'Naam'),
        'E-mailadres' => shoot_text($contact, 'email', 'E-mailadres', 254),
        'Telefoonnummer' => shoot_text($contact, 'phone', 'Telefoonnummer', 40, false) ?: 'Niet ingevuld',
    ];
    if (!filter_var($rows['E-mailadres'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $rows['E-mailadres'])) throw new ShootValidationException('Vul een geldig e-mailadres in.');
    if ($rows['Telefoonnummer'] !== 'Niet ingevuld' && !preg_match('/^\+?[0-9 ()\.\-]{6,40}$/D', $rows['Telefoonnummer'])) throw new ShootValidationException('Vul een geldig telefoonnummer in of laat het veld leeg.');
    if ($route === 'private') {
        if (!is_array($payload['selection'] ?? null)) throw new ShootValidationException('Stel eerst je fotoshoot samen.');
        $quote = shoot_quote($config, $payload['selection']);
        if (($payload['expectedTotalCents'] ?? null) !== $quote['totalCents']) throw new ShootValidationException('De prijsindicatie klopt niet meer. Controleer je pakket en extra opties opnieuw.');
        $rows['Gewenste datum'] = shoot_date(shoot_text($contact, 'date', 'Gewenste datum', 10), 'Gewenste datum');
        $rows['Gewenste locatie'] = shoot_text($contact, 'location', 'Gewenste locatie');
        $request = $quote['rows'];
    } else {
        $rows['Bedrijfsnaam'] = shoot_text($contact, 'company', 'Bedrijfsnaam', 200, false) ?: 'Niet van toepassing';
        if (!is_array($payload['brief'] ?? null)) throw new ShootValidationException('Vertel eerst iets over je opdracht.');
        $request = shoot_business($config, $payload['brief']);
    }
    $rows['Aanvullende opmerkingen'] = shoot_text($contact, 'comments', 'Aanvullende opmerkingen', 3000, false) ?: 'Geen';
    return ['route' => $route, 'contact' => $rows, 'request' => $request, 'replyTo' => $rows['E-mailadres']];
}

function shoot_message(array $validated, string $reference): string
{
    $heading = $validated['route'] === 'private' ? 'Particuliere fotoshootaanvraag' : 'Persoonlijke offerteaanvraag';
    $body = $heading . "\nReferentie: " . $reference . "\n\n";
    foreach (['request' => 'DE AANVRAAG', 'contact' => 'CONTACTGEGEVENS'] as $section => $title) {
        $body .= $title . "\n" . str_repeat('-', 40) . "\n";
        foreach ($validated[$section] as $label => $value) $body .= $label . ":\n" . $value . "\n\n";
    }
    return $validated['route'] === 'private' ? $body : $body . "Deze aanvraag is vrijblijvend. Een boeking is pas definitief na persoonlijke bevestiging.\n";
}

function shoot_send(array $settings, array $validated, string $reference): bool
{
    foreach (['from', 'to'] as $key) {
        if (!is_string($settings[$key]) || !filter_var($settings[$key], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $settings[$key])) throw new RuntimeException('Invalid mail configuration');
    }
    $headers = [
        'From' => 'Van Son Fotografie <' . $settings['from'] . '>',
        'Reply-To' => $validated['replyTo'],
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'quoted-printable',
    ];
    // Ontvanger, afzender en onderwerp komen uitsluitend uit vertrouwde servergegevens.
    $subject = ($validated['route'] === 'private' ? 'Fotoshootaanvraag' : 'Offerteaanvraag') . ' | Van Son Fotografie | ' . $reference;
    return @mail($settings['to'], $subject, quoted_printable_encode(shoot_message($validated, $reference)), $headers);
}

function shoot_rate_limit(string $directory, string $address): bool
{
    $directory = $directory ?: sys_get_temp_dir() . '/vanson-fotoshoot-rate';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Rate storage unavailable');
    $resolved = realpath($directory);
    $publicRoot = realpath(__DIR__ . '/..');
    if (!$resolved || !$publicRoot || str_starts_with(strtolower(str_replace('\\', '/', $resolved)) . '/', strtolower(str_replace('\\', '/', $publicRoot)) . '/')) throw new RuntimeException('Rate storage must be outside the public website');
    // Sleutel en gehashte IP-tellers blijven buiten de publieke website. Geen aanvraaggegevens.
    $keyFile = $directory . '/key';
    $handle = @fopen($keyFile, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('Rate key unavailable');
    $key = stream_get_contents($handle);
    if (!$key) {
        $key = bin2hex(random_bytes(32));
        if (fwrite($handle, $key) === false) throw new RuntimeException('Rate key write failed');
        @chmod($keyFile, 0600);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    $path = $directory . '/' . hash_hmac('sha256', $address, $key) . '.json';
    $handle = @fopen($path, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('Rate storage unavailable');
    $record = json_decode(stream_get_contents($handle) ?: '{}', true);
    $now = time();
    if (!is_array($record) || ($record['until'] ?? 0) <= $now) $record = ['until' => $now + 3600, 'count' => 0];
    $allowed = $record['count'] < 5;
    if ($allowed) $record['count']++;
    rewind($handle);
    if (!ftruncate($handle, 0) || fwrite($handle, json_encode($record, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Rate write failed');
    @chmod($path, 0600);
    flock($handle, LOCK_UN);
    fclose($handle);
    // Verwijder verlopen, gehashte tellers; werk per aanvraag begrenzen.
    if (random_int(1, 20) === 1) {
        $iterator = new DirectoryIterator($directory);
        $checked = 0;
        foreach ($iterator as $file) {
            if (++$checked > 200) break;
            if ($file->isFile() && preg_match('/^[a-f0-9]{64}\.json$/D', $file->getFilename()) && $file->getMTime() < $now - 7200) @unlink($file->getPathname());
        }
    }
    return $allowed;
}
