# Fotoshootconfigurator — Van Son Fotografie

De uitbreiding staat op `/fotoshoot`. Het ontwerp van de bestaande website is behouden: dezelfde algemene stylesheet, kleuren, lettertypen, navigatie en knoppen. De homepage heeft een losse, gecentreerde knop onder de zonnen van de werkwijze, buiten het opdrachtenvlak. Alle pagina’s krijgen ‘Prijscalculator’ in de bovenbalk; op de homepage staat die ook in het zonnemenu. De bestaande sliders, portfolio-indeling en inhoud van de andere pagina's zijn behouden. De botcontrole vereist eenmalige serverinstellingen; zie [Turnstile instellen](TURNSTILE-INSTELLEN.md).

## Bestanden

| Bestand | Functie |
| --- | --- |
| `index.html` | Knop onder de zonnen van de werkwijze en de link Prijscalculator in de bovenbalk en het zonnemenu. |
| `gallery.html`, `blog.html`, beide blogartikelen | Prijscalculator in de bestaande bovenbalk. |
| `styles.css` | Laat navigatielinks bij onvoldoende ruimte doorlopen naar een volgende regel. |
| `fotoshoot.html` | Nieuwe pagina, routekeuze en toegankelijke formulierstructuur. |
| `fotoshoot.css` | Aanvullende styling, uitsluitend voor de nieuwe pagina. |
| `fotoshoot.js` | Stappen, keuzes, vervolgvragen, overzichten, validatie en verzending. |
| `fotoshoot-turnstile.js` | Laadt Turnstile uitsluitend bij de laatste stap; bewaakt tokens en herstel na fouten. |
| `api/fotoshoot-turnstile.php` | Verifieert tokens bij Cloudflare, inclusief hostname, actie en aanvraagreferentie. |
| `fotoshoot-calendar.js` | Nederlandse datumkiezer, toetsenbordbediening en datumvalidatie. |
| `fotoshoot-model.js` | Prijsberekening in gehele eurocenten en Nederlandse geldweergave. |
| `assets/config/fotoshoot.json` | Eén centrale configuratie voor alle pakketten, prijzen, prijsteksten en keuzes. |
| `api/fotoshoot.php` | Publiek PHP-endpoint: configuratie laden en aanvragen verzenden. |
| `api/fotoshoot-lib.php` | Servervalidatie, prijsberekening, mailopmaak en spamlimiet. |
| `api/config.example.php` | Voorbeeld van uitsluitend serverinstellingen. |
| `.htaccess` | Route `/fotoshoot` en afscherming van interne API-, test- en ontwikkelbestanden. |
| `.gitignore` | Negeert lokale serverinstellingen en controlescreenshots. |
| `tests/fotoshoot.test.php` | Servervalidatie en prijscontroles. |
| `tests/fotoshoot.test.mjs` | Vergelijkt de JavaScript- en PHP-prijsberekening. |
| `tests/fotoshoot.browser.mjs` | Browser-, mobiele en verzendtests met uitsluitend lokale SMTP-opvang. |
| `tools/preview-router.php` | Lokale PHP-preview met dezelfde paginaroutes; niet gebruiken als productieserver. |

Particulieren kiezen uit portret- en koppelfotografie, met tekstkaarten zonder foto. Andere ideeën kunnen rechtstreeks per e-mail worden besproken. De pagina heeft een compacte intro zonder grote foto; de particuliere tool staat direct open en de zakelijke route blijft erboven beschikbaar.

## Nog instellen vóór ingebruikname op Hostinger

1. Gebruik PHP 8.2 of hoger, HTTPS en de bestaande Apache/LiteSpeed `.htaccess`-routing. Er is geen npm-build, database of extra PHP-library nodig. Zorg dat PHP-sessies en de tijdelijke servermap beschrijfbaar zijn.
2. Controleer de prijzen en pas zo nodig `priceNotice`, `travelNotice` en `taxNotice` in `assets/config/fotoshoot.json` aan op je werkelijke tarieven en btw-situatie. De eigenaar heeft bevestigd dat KOR-deelname actief is. `taxNotice` vermeldt uitsluitend: ‘Alle prijzen zijn totaalprijzen.’ De KOR-vermelding wordt op de factuur opgenomen. De code rekent geen btw boven op de bedragen. Een boeking en de definitieve totaalprijs worden persoonlijk bevestigd.
3. Kopieer `api/config.example.php` naar `api/config.local.php` op de server. Controleer `from` en `to` (standaard beide `info@vansonfotografie.nl`) en zet pas daarna `enabled` op `true`. Dit lokale bestand wordt niet opgenomen in Git en is via `.htaccess` afgeschermd. Zonder inschakeling blijft echte verzending bewust uit en krijgt de bezoeker bij verzending een duidelijke mailmogelijkheid.
4. De verzendfunctie gebruikt PHP `mail()` en de mailvoorziening van de hosting. Controleer bij Hostinger dat deze voorziening beschikbaar is voor je hostingpakket en dat het afzenderadres op je domein is toegestaan. Stel de domeinverificatie voor je mailbox in volgens je mailprovider. De mailsleutels blijven op de server. De optionele botcontrole gebruikt uitsluitend een publieke sitekey in de browser; de secret key blijft op de server. Als je hosting uitsluitend SMTP met authenticatie toestaat, is nog een SMTP-transport op de server nodig; de configurator simuleert geen verzending.
5. Controleer op een afgeschermde testomgeving de complete route, inclusief ontvangst van een particuliere aanvraag, horeca-aanvraag en evenementaanvraag in je echte inbox. De lokale tests bewijzen verwerking en acceptatie door een lokale SMTP-server; ontvangst op Hostinger is nog niet gecontroleerd. PHP `mail()` bevestigt acceptatie voor transport, geen gegarandeerde inboxbezorging.
6. Activeer de extra botcontrole met de stappen in [Turnstile instellen](TURNSTILE-INSTELLEN.md). De bestaande verzending blijft zonder deze sleutels werken met de bestaande spambeveiliging. Publiceer daarna de gewenste commit via GitHub en Hostinger.

Je kunt serverinstellingen ook via omgevingsvariabelen instellen:

| Variabele | Betekenis |
| --- | --- |
| `FOTOSHOOT_MAIL_ENABLED=true` | Schakelt echte verzending in. Standaard uit. |
| `FOTOSHOOT_MAIL_FROM` | Vertrouwd afzenderadres op je eigen domein. |
| `FOTOSHOOT_TURNSTILE_SITE_KEY` | Publieke sitekey van de Managed-widget. |
| `FOTOSHOOT_TURNSTILE_SECRET_KEY` | Bijbehorende geheime serversleutel. Nooit in Git of frontendcode. |
| `FOTOSHOOT_RATE_DIRECTORY` | Optionele beschrijfbare map buiten `public_html` voor gehashte spamlimieten. Standaard de tijdelijke systeemmap. |

Waarden in `api/config.local.php` hebben voorrang. Zet alleen op een afgeschermde testomgeving een ander ontvangstadres. Voeg voor een testdomein de exacte HTTPS-origin toe aan `allowedOrigins`; gebruik geen wildcard. De ontwikkelserver staat automatisch zijn eigen loopback-origin toe. Publieke HTTP-hosting wordt niet ondersteund voor verzending, omdat de sessiecookie in productie `Secure` is.

## Tarieven wijzigen

Alleen `assets/config/fotoshoot.json` aanpassen. Bedragen staan in gehele eurocenten:

- `packages[].priceCents`: Mini Shoot is 6500 (€65); Standaard Shoot is 8900 (€89). Beide duren 30 minuten, met respectievelijk 5 en 10 professioneel nabewerkte foto’s naar keuze. Klanten kiezen uit een persoonlijke online selectiegalerij en ontvangen de gekozen foto’s digitaal in hoge resolutie.
- `packages[].minutes` en `packages[].photos`: duur en inbegrepen foto's.
- `extras.photoPriceCents`: prijs per extra foto, nu 1200.
- `extras.rushPriceCents`: toeslag voor spoedlevering, nu 3500.
- `extras.maxExtraPhotos`: maximum voor het aantal extra foto's.

Eventuele reiskosten buiten het standaard werkgebied worden vooraf besproken, zoals vermeld in `travelNotice`; de definitieve totaalprijs volgt pas na overleg en persoonlijke bevestiging. Deze tekst staat bij de prijs, in het aanvraagoverzicht en in de e-mail.

Standaard Shoot krijgt het label ‘Meer foto’s’. Het verschil van €24 voor vijf extra nabewerkte foto’s wordt uit de actuele pakketbedragen berekend. `editingNotice` en `retouchNotice` beschrijven de inbegrepen nabewerking en de grenzen daarvan. `standardDeliveryNotice` vermeldt oplevering binnen 7 werkdagen na de fotokeuze. `rushNotice` vermeldt oplevering binnen 2 werkdagen na de fotokeuze, afhankelijk van beschikbaarheid en persoonlijke bevestiging. Beide termijnen zijn door de eigenaar bevestigd. De selectiegalerij is de stap na de shoot; er wordt in de aanvraag nog geen galerij aangemaakt. De voorwaarden over totaalprijzen, boeking en reiskosten staan bij het rechteroverzicht; bij de laatste controlestap is dat overzicht verborgen en staan de voorwaarden eenmaal in de aanvraag zelf. Voorbeelden: Mini Shoot + 2 extra foto’s = €89; Standaard Shoot + 2 extra foto’s = €113; met spoed is dat laatste €148.

Voor toekomstige verschillen per fotografiecategorie staan in `photography[].packageIds` de toegestane pakket-ID’s. Met `photography[].packageOverrides` kun je de eigenschappen van een bestaand pakket voor uitsluitend die categorie aanpassen. Bijvoorbeeld bij portretfotografie:

```json
"packageIds": ["mini", "standaard"],
"packageOverrides": {
  "mini": { "priceCents": 7900, "minutes": 45, "photos": 6 }
}
```

Dit voorbeeld is niet ingeschakeld. Nu gelden voor portret en koppel dezelfde twee pakketten. Een nieuw pakket maak je aan in `packages` en voeg je met zijn ID toe aan de bedoelde categorieën. Browser en server gebruiken dezelfde toegestane pakketten en aanpassingen. Als een gewijzigd type fotografie het gekozen pakket nog aanbiedt, blijft de keuze behouden en worden de gegevens en de prijs opnieuw berekend. Alleen als duur, prijs en aantallen een zuivere foto-upgrade ondersteunen, verschijnt de vergelijkingstekst.

De server leest hetzelfde bestand als de browser. De server berekent opnieuw en weigert gemanipuleerde bedragen. Als de configuratie wijzigt terwijl een bezoeker bezig is, wordt verzending geblokkeerd totdat die de pagina herlaadt en de aanvraag opnieuw controleert. Publiceer een JSON-bestand steeds volledig, niet halfgeschreven. Houd identifiers uniek, alle bedragen geheel en niet-negatief en de JSON geldig. Prijsinstellingen worden nooit gebruikt voor zakelijke opdrachten of evenementen.

## Werking en gegevensverwerking

Particulier: fotografie → pakket en opties → contact en voorkeuren → overzicht → verzenden. Zakelijk/evenement: opdracht en relevante vragen → contact → overzicht → verzenden. Teruggaan en wisselen van categorie/route bewaart keuzes zolang de pagina open blijft. Herladen of sluiten wist de invoer. Een evenement heeft één verplichte keuze uit de drie aangeleverde opties; horeca ondersteunt meerdere onderwerpen. Een aparte einddatum maakt fotografie na middernacht mogelijk. Alle datumvelden hebben een eigen Nederlandse kalender, maand-/jaarkeuze en invoer als dd-mm-jjjj. Naar de server gaan datums als JJJJ-MM-DD. Pijltjestoetsen, Home/End en Page Up/Down werken in het datumrooster; Escape sluit de kalender. De kalender controleert invoer, schrikkeldagen en minimumdatums, zonder beschikbaarheid te beloven.

Aanvragen worden als UTF-8-tekstmail met alle relevante keuzes verstuurd. De bezoeker wordt uitsluitend als `Reply-To` gebruikt. Er is geen klantendatabase en geen opslag van contactgegevens in localStorage, sessionStorage, cookies of applicatielogs. Verwerk en bewaar ontvangen aanvragen in je mailbox volgens je eigen privacybeleid.

Beveiliging: servervalidatie, maximale aanvraaggrootte 32 KiB, vaste ontvanger/afzender, CSRF-token, origincontrole, honeypot, maximaal vijf valide verzendpogingen per IP per uur en bescherming tegen dubbele verzending binnen dezelfde sessie. De noodzakelijke sessiecookie is `HttpOnly`, `SameSite=Strict` en op productie `Secure`; sessiedata bevat alleen tokens, vervaltijd en verzendreferenties, geen formulierinhoud. Voor de spamlimiet staan met een willekeurige serversleutel gehashte IP-tellers buiten de publieke website. De limiet vervalt na een uur; oude tellerbestanden worden opportunistisch opgeruimd. Bij onbeschikbare sessie- of limiteropslag wordt niet verzonden.

Als beide Turnstile-sleutels zijn ingevuld, is verificatie verplicht voor beide routes, ook voor rechtstreekse API-aanvragen. Eén ingevulde sleutel is een configuratiefout en blokkeert verzending. De server controleert eenmalige tokens bij Cloudflare via HTTPS met certificaatcontrole en een timeout; hostname, actie en aanvraagreferentie moeten overeenkomen. Bij ontbrekende/verlopen/afgewezen tokens, een onbereikbare verificatiedienst of ongeldige configuratie wordt geen mail verstuurd. De controles op CSRF, origin, honeypot, prijzen, limieten en dubbele verzending blijven bestaan. Alleen sitekey en actie gaan naar de browser; nooit de secret key. Cloudflare ontvangt voor verificatie het token en de serversleutel; contactvelden worden niet meegestuurd. Het widgetscript laadt pas bij de laatste stap. Tokens blijven uitsluitend in het geheugen van de pagina. Na een verzendfout, teruggaan of wisselen van route volgt een nieuwe controle; de aanvraagreferentie blijft bij een verzendretry gelijk om dubbele mail te voorkomen.

Een succesmelding verschijnt alleen als het mailtransport de aanvraag accepteert. Bij een fout blijven de velden beschikbaar voor een nieuwe poging. Dubbelklikken en het opnieuw versturen van dezelfde aanvraagreferentie leveren binnen de sessie geen tweede mail op.

## Lokaal controleren

Benodigd: PHP 8.2+, Node.js voor tests en optioneel Playwright met een beschikbare Edge- of Chrome-browser. Deze testtools zijn niet nodig op Hostinger.

```powershell
php -S 127.0.0.1:8765 tools/preview-router.php
```

Open `http://127.0.0.1:8765/fotoshoot`. Dit gebruikt de echte PHP-backend; uitsluitend een statische HTML-server kan het endpoint niet uitvoeren. Verzending staat standaard uit. Stop de server na gebruik met Ctrl+C.

In een tweede terminal:

```powershell
php tests/fotoshoot.test.php
php tests/fotoshoot-turnstile.test.php
$env:FOTOSHOOT_PHP = (Get-Command php).Source
node --test tests/fotoshoot.test.mjs
```

Browser- en integratietests gebruiken Playwright (module beschikbaar via `NODE_PATH` of lokale installatie), standaard met de bestaande Edge-browser. Eventueel: `$env:FOTOSHOOT_BROWSER = 'chrome'`. Houd de gewone preview op poort 8765 actief. De test start zelf een tweede PHP-server op poort 8766 met tijdelijk ingeschakelde verzending en een uitsluitend lokale SMTP-opvang op 1026. Er wordt geen productie-instelling gewijzigd en er gaat geen mail naar buiten. De test schakelt de lokale opvang bewust uit om een mailfout te controleren. Controleer dat deze drie poorten vrij zijn.

```powershell
node tests/fotoshoot.browser.mjs
node tests/fotoshoot-turnstile.browser.mjs
```

Uitgevoerde controles: 13 browser- en integratietestgroepen; 113 PHP-asserties; 24 prijscombinaties en een categoriegebonden prijsvoorbeeld tussen JavaScript en PHP; ongeldige prijzen/keuzes/datums/contactgegevens; alle zakelijke categorieën; verplichte evenementkeuze; horeca-multiselect; aanvraagoverzichten; veilige tekstweergave; lokaal mailtransport en foutafhandeling; dubbele verzending; CSRF, origin, honeypot en spamlimiet; toetsenbord en focus; schermbreedtes 320/375/390/768/1366; bestaande pagina's, sliders en galerijfilters. Screenshots staan lokaal in de genegeerde map `.local/`. De echte Hostinger-router en inboxbezorging vragen nog de test hierboven.

De Turnstile-tests gebruiken 36 PHP-controles met providerfixtures en 6 browser/API-testgroepen op poort 8767. Ze controleren afgeschermde sleutels, verplichte tokens, hostname/actie/referentie, verlopen en dubbele tokens, fouten/herstel, behoud van invoer, een stabiele verzendreferentie en de zakelijke route op 320px. De positieve providerantwoorden worden gesimuleerd; er gaat geen mail naar buiten en hiermee is geen echte Cloudflare- of Hostinger-configuratie getest. Controleer na activatie met de eigen sleutels beide routes in een gewone browser en de daadwerkelijke inboxbezorging.
