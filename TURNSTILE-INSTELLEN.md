# Botcontrole activeren op Hostinger

De code voor Cloudflare Turnstile staat klaar voor beide aanvraagroutes. Deze wijziging is nog niet gepusht. Zonder sleutels blijft de bestaande spambeveiliging actief; Turnstile zelf staat dan uit. PHP blijft nodig voor het veilig verwerken en mailen van aanvragen.

1. Log in op het [Cloudflare-dashboard](https://dash.cloudflare.com/). Open **Turnstile** en voeg een widget toe. Hiervoor hoef je je website of nameservers niet te verhuizen.
2. Geef de widget bijvoorbeeld de naam **Van Son Fotografie**. Voeg de hostnamen `vansonfotografie.nl` en `www.vansonfotografie.nl` toe. Kies **Managed**: automatische controle, zo nodig een vinkje, zonder plaatjespuzzels.
3. Cloudflare geeft een **site key** en een **secret key**. Bewaar de secret key privé; zet deze uitsluitend in de serverinstellingen, niet in chat of Git.
4. Publiceer de code via je gebruikelijke GitHub/Hostinger-deploy. Open daarna in Hostinger Bestandsbeheer het bestaande bestand **public_html/api/config.local.php**. Voeg deze twee regels toe binnen de bestaande `return [...]`, vóór de afsluitende `];`, en vul de bijbehorende sleutels in:

   ```php
   'turnstileSiteKey' => 'HIER_JE_SITE_KEY',
   'turnstileSecretKey' => 'HIER_JE_SECRET_KEY',
   ```

   Behoud je bestaande mailinstellingen (`enabled`, `from`, `to`). Zorg dat ook de regel vóór deze twee regels eindigt met een komma. Sla op als `config.local.php`, zonder `.txt` achter de bestandsnaam.

5. Herlaad de calculator en vul in een gewone browser beide routes in. De controle verschijnt alleen bij de laatste stap. De verzendknop werkt zodra de controle slaagt. Controleer na een echte testaanvraag ook of de mail aankomt. Controleer op een telefoon dat de controle past.

Beide sleutels ingevuld betekent dat controle verplicht is. Eén sleutel ontbreekt, een sleutel klopt niet of Cloudflare is onbereikbaar: er wordt geen mail verstuurd. De bezoeker kan opnieuw proberen en behoudt de invoer. Zonder beide sleutels blijft de eerdere bescherming werken: onder andere honeypot, CSRF, origincontrole en een verzendlimiet. Gebruik op de live website uitsluitend eigen geregistreerde sleutels; bekende Cloudflare-testsleutels worden daar geweigerd.

Hostinger moet PHP met cURL ondersteunen, of als alternatief OpenSSL met `allow_url_fopen`. De server moet HTTPS-verzoeken naar `challenges.cloudflare.com` kunnen uitvoeren. Certificaatcontrole blijft ingeschakeld. Werkt verzenden na activatie niet, controleer de domeinen en het sleutelpaar in Cloudflare en deze PHP-instellingen in Hostinger.

De volledige keten met jouw echte sleutels kan pas na deze activatie worden gecontroleerd. De lokale tests gebruiken gesimuleerde providerantwoorden en lokale mailopvang.

Officiële uitleg: [Turnstile instellen](https://developers.cloudflare.com/turnstile/get-started/) en [verificatie op de server](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
