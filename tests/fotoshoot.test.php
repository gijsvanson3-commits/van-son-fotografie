<?php
declare(strict_types=1);
require __DIR__ . '/../api/fotoshoot-lib.php';
[$config] = shoot_config();
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function rejects(callable $action, string $label): void {
    try { $action(); } catch (ShootValidationException) { check(true, $label); return; }
    throw new RuntimeException('Expected rejection: ' . $label);
}
$contact = ['name' => 'Test Aanvraag', 'email' => 'test@example.com', 'phone' => '', 'date' => '2099-10-20', 'location' => 'In overleg', 'comments' => 'Een test met accenten: café.'];
$matrix = [];
foreach ($config['photography'] as $photography) {
    foreach (shoot_packages($config, $photography['id']) as $pack) {
        foreach ([0, 2, $config['extras']['maxExtraPhotos']] as $extra) {
            foreach ([false, true] as $rush) {
                $selection = ['photography' => $photography['id'], 'package' => $pack['id'], 'extraPhotos' => $extra, 'rush' => $rush];
                $quote = shoot_quote($config, $selection);
                $expected = $pack['priceCents'] + $extra * $config['extras']['photoPriceCents'] + ($rush ? $config['extras']['rushPriceCents'] : 0);
                check($quote['totalCents'] === $expected, 'Price calculation');
                $valid = shoot_validate($config, ['route' => 'private', 'selection' => $selection, 'expectedTotalCents' => $expected, 'contact' => $contact]);
                check($valid['request']['Totale prijsindicatie'] === shoot_money($expected), 'Validated quote');
                $matrix[] = ['selection' => $selection, 'totalCents' => $quote['totalCents']];
            }
        }
    }
}
$selection = ['photography' => 'portret', 'package' => 'mini', 'extraPhotos' => 0, 'rush' => false];
foreach ([-1, 101, 1.5, '2', null] as $invalid) rejects(fn() => shoot_quote($config, array_replace($selection, ['extraPhotos' => $invalid])), 'Invalid extra photos');
rejects(fn() => shoot_quote($config, array_replace($selection, ['rush' => 'false'])), 'Boolean rush only');
rejects(fn() => shoot_quote($config, array_replace($selection, ['photography' => 'evenement'])), 'No events in private route');
rejects(fn() => shoot_quote($config, array_replace($selection, ['package' => 'premium'])), 'Old premium package removed');
rejects(fn() => shoot_quote($config, array_replace($selection, ['photography' => 'automotive'])), 'Automotive unavailable');
check(str_contains(shoot_message(shoot_validate($config, ['route' => 'private', 'selection' => $selection, 'expectedTotalCents' => 6500, 'contact' => $contact]), 'TEST'), $config['travelNotice']), 'Travel costs in request email');
rejects(fn() => shoot_quote($config, array_replace($selection, ['package' => 'unknown'])), 'Unknown package');
foreach (['mini' => 8900, 'standaard' => 11300] as $id => $total) {
    $example = shoot_quote($config, array_replace($selection, ['package' => $id, 'extraPhotos' => 2]));
    check($example['totalCents'] === $total, 'Exact requested example');
    check($example['rows']['Duur'] === '30 minuten', 'Both packages are 30 minutes');
    check($example['rows']['Oplevering'] === 'Digitale oplevering in hoge resolutie', 'Digital delivery in email');
}
$normalQuote = shoot_quote($config, $selection);
$rushQuote = shoot_quote($config, array_replace($selection, ['rush' => true]));
check($normalQuote['rows']['Levertijd'] === $config['standardDeliveryNotice'], 'Standard delivery after client selection');
check($rushQuote['rows']['Levertijd'] === $config['rushNotice'], 'Rush delivery after client selection');
check($normalQuote['rows']['Fotokeuze'] === 'Keuze uit een persoonlijke online selectiegalerij', 'Client chooses from gallery');
check($normalQuote['rows']['Inbegrepen professioneel nabewerkte foto’s'] === '5 naar keuze', 'Included photos chosen by client');
check($normalQuote['rows']['Btw-afspraak'] === 'Alle prijzen zijn totaalprijzen.', 'Total price notice');
$custom = $config;
$custom['photography'][0]['packageIds'] = ['mini'];
$custom['photography'][0]['packageOverrides']['mini'] = ['priceCents' => 7900, 'minutes' => 45, 'photos' => 6];
$customQuote = shoot_quote($custom, $selection);
check($customQuote['totalCents'] === 7900 && $customQuote['rows']['Duur'] === '45 minuten', 'Category-specific price and package settings');
rejects(fn() => shoot_quote($custom, array_replace($selection, ['package' => 'standaard'])), 'Category package restriction');
$matrix[] = ['selection' => $selection, 'config' => $custom, 'totalCents' => 7900];
$private = ['route' => 'private', 'selection' => $selection, 'expectedTotalCents' => 6500, 'contact' => $contact];
rejects(fn() => shoot_validate($config, array_replace($private, ['expectedTotalCents' => 1])), 'Tampered price');
foreach ([['email' => "test@example.com\r\nBcc: bad@example.com"], ['date' => '2020-01-01'], ['date' => '2099-02-30'], ['name' => '   '], ['comments' => str_repeat('a', 3001)], ['phone' => 'abc']] as $invalid) {
    rejects(fn() => shoot_validate($config, array_replace($private, ['contact' => array_replace($contact, $invalid)])), 'Invalid contact');
}
$brief = ['category' => 'evenement', 'coverage' => '0', 'eventName' => 'Test feest', 'eventDate' => '2099-10-20', 'visitors' => '80', 'eventLocation' => 'Testlocatie', 'startTime' => '20:00', 'endTime' => '01:00', 'endDate' => '2099-10-21', 'eventWishes' => 'Groepsfoto bij binnenkomst.'];
foreach (['0', '1', '2'] as $coverage) {
    $rows = shoot_business($config, array_replace($brief, ['coverage' => $coverage]));
    check($rows['Ik ben op zoek naar'] === $config['eventCoverage'][(int)$coverage], 'Event coverage choice');
    check(!array_key_exists('Totale prijsindicatie', $rows), 'No event prices');
}
foreach ([['coverage' => ''], ['coverage' => ['0', '1']], ['visitors' => '0'], ['endDate' => '2099-10-20'], ['startTime' => '25:00']] as $invalid) rejects(fn() => shoot_business($config, array_replace($brief, $invalid)), 'Invalid event details');
foreach ($config['business'] as $category) {
    $data = $category['id'] === 'evenement' ? $brief : ['category' => $category['id'], 'subject' => 'Test onderwerp', 'scope' => 'Tien beelden', 'period' => 'In overleg', 'businessLocation' => 'Testlocatie', 'usage' => 'Website', 'subjects' => ['0', '1']];
    $validated = shoot_validate($config, ['route' => 'business', 'brief' => $data, 'contact' => $contact]);
    check($validated['request']['Type opdracht'] === $category['label'], 'Every business category');
    $body = shoot_message($validated, 'TEST123');
    check(!str_contains($body, '€') && !str_contains($body, 'Pakketprijs'), 'No business pricing');
    check(str_contains($body, 'test@example.com') && str_contains($body, 'Test onderwerp') || $category['id'] === 'evenement', 'Complete email body');
}
$hospitality = ['category' => 'horeca', 'subject' => 'Test', 'scope' => 'Tien beelden', 'period' => 'In overleg', 'businessLocation' => 'Test', 'usage' => 'Website'];
rejects(fn() => shoot_business($config, $hospitality), 'Hospitality subjects required');
rejects(fn() => shoot_business($config, $hospitality + ['subjects' => ['99']]), 'Only known hospitality subjects');
if (in_array('--matrix', $argv, true)) echo json_encode($matrix, JSON_THROW_ON_ERROR);
else echo "PHP: $checks checks passed.\n";
