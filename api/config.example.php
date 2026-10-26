<?php
declare(strict_types=1);

// Alleen serverinstellingen; dit bestand is geen frontendconfiguratie.
// Kopieer naar config.local.php (Git negeert dat bestand), of gebruik omgevingsvariabelen.
return [
    'enabled' => false,
    'from' => 'info@vansonfotografie.nl',
    'to' => 'info@vansonfotografie.nl',
    'allowedOrigins' => ['https://vansonfotografie.nl', 'https://www.vansonfotografie.nl'],
    // Optioneel: een eigen, beschrijfbare map BUITEN public_html voor de spamlimiet.
    'rateDirectory' => '',
];
