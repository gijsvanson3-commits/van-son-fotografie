# Hostinger Git deploy

Deze website is een statische site en kan direct vanaf GitHub naar Hostinger worden gedeployed.

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
& 'C:\Program Files\Git\cmd\git.exe' add .
& 'C:\Program Files\Git\cmd\git.exe' commit -m "Beschrijf je wijziging"
& 'C:\Program Files\Git\cmd\git.exe' push
```

Daarna haal je in Hostinger de nieuwste versie binnen, of zet je auto deploy aan als die optie zichtbaar is.
