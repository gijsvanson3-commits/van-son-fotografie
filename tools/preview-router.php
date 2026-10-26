<?php
// Alleen voor php -S bij lokale ontwikkeling. Geen onderdeel van productie-routing.
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('~^/(?:api/(?!fotoshoot\.php$)|tests(?:/|$)|tools(?:/|$)|\.)~i', $path)) {
    http_response_code(403);
    exit('Niet toegankelijk');
}
$routes = [
    '/' => 'index.html', '/fotoshoot' => 'fotoshoot.html', '/galerij' => 'gallery.html',
    '/blogs' => 'blog.html', '/blogs/evenementen-fotografie' => 'blog-evenementen-fotografie.html',
    '/blogs/verjaardag-fotoshoot' => 'Blog-verjaardag-fotoshoot.html',
];
if (isset($routes[$path])) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/../' . $routes[$path]);
    return true;
}
return false;
