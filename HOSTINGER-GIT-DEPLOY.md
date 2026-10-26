# Hostinger Git deploy

De pagina’s zijn HTML/CSS/JavaScript zonder buildstap. De fotoshootconfigurator gebruikt daarnaast PHP 8.2+ voor validatie en e-mailverzending. Hostinger moet het endpoint `/api/fotoshoot.php` als PHP uitvoeren; alleen statische hosting is onvoldoende.

Voor de botcontrole zijn eenmalig twee Turnstile-sleutels nodig, zie [Turnstile instellen](TURNSTILE-INSTELLEN.md). Het geheime bestand `api/config.local.php` stel je op de server in; dit wordt niet meegestuurd met Git.

## Eenmalig

1. Maak een lege repository aan op GitHub, bijvoorbeeld `fotografie-website`.
2. Voeg de remote toe:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' remote add origin https://github.com/JOUW_NAAM/fotografie-website.git
```

3. Push de eerste versie:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' push -u origin main
```

4. Open in Hostinger:
   - `Websites -> Manage -> Advanced -> Git`
   - koppel je GitHub-account
   - kies de repository en branch `main`
   - laat `Install Path` leeg zodat Hostinger naar `public_html` deployt

## Daarna

Bij elke wijziging:

```powershell
Set-Location 'C:\Users\Gijsv\Documents\Website'
& 'C:\Program Files\Git\cmd\git.exe' add .
& 'C:\Program Files\Git\cmd\git.exe' commit -m "Beschrijf je wijziging"
& 'C:\Program Files\Git\cmd\git.exe' push origin HEAD:main
```

Daarna haal je in Hostinger de nieuwste versie binnen, of zet je auto deploy aan als die optie zichtbaar is.
