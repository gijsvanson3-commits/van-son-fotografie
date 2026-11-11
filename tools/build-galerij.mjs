// Bouwt de galerij uit tools/galerij.json:
//   - gallery.html            (overzicht van alle series, live op /galerij)
//   - series/<slug>.html      (pagina per serie, live op /galerij/<slug>)
//   - index.html              (alleen de blokken tussen de <!-- galerij:... --> markeringen)
//   - sitemap.xml
// Gebruik: cd tools && node build-galerij.mjs
// Draai eerst optimize-images.mjs als je nieuwe foto's hebt toegevoegd.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://vansonfotografie.nl';
const data = JSON.parse(readFileSync(path.join(root, 'tools', 'galerij.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(root, 'assets', 'images', 'opt', 'manifest.json'), 'utf8'));
const instagram = 'https://www.instagram.com/van_son_fotografie/';

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const problems = [];

function photo(file) {
  const entry = manifest[file];
  const alt = data.alt?.[file];
  if (!entry) problems.push(`"${file}" staat niet in manifest.json; draai eerst optimize-images.mjs`);
  if (!alt) problems.push(`"${file}" heeft geen alt-tekst in galerij.json`);
  if (!entry) return null;
  const url = (w) => `/assets/images/opt/${entry.slug}-${w}.webp`;
  const largest = entry.widths.at(-1);
  return {
    file,
    alt: alt || '',
    src: url(entry.widths.filter((w) => w <= 960).at(-1)),
    og: url(entry.widths.filter((w) => w <= 1440).at(-1)),
    full: url(largest),
    srcset: entry.widths.map((w) => `${url(w)} ${w}w`).join(', '),
    width: largest,
    height: Math.round((entry.height / entry.width) * largest),
    ratio: (entry.width / entry.height).toFixed(4),
    portrait: entry.height > entry.width,
  };
}

function img(p, { sizes, eager = false }) {
  return `<img src="${p.src}" srcset="${p.srcset}" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async">`;
}

function nav(current) {
  const link = (href, label, isCurrent) => `<a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a>`;
  return `  <header class="hero">
    <nav class="topbar" aria-label="Hoofdnavigatie">
      <span class="topbar__title" aria-hidden="true">Galerij</span>
      <div class="topbar__group">
        ${link('/#about', 'Over mij')}
        ${link('/#commercial', 'Opdrachten')}
        ${link('/#art', 'Kunst')}
        ${link('/galerij', 'Galerij', current === 'galerij')}
        ${link('/blogs', 'Blogs')}
        ${link('/fotoshoot', 'Prijscalculator')}
      </div>
      <a class="topbar__contact" href="/#contact">Contact</a>
    </nav>
  </header>`;
}

function head({ title, description, url, image, extraScript = '' }) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Gegenereerd door tools/build-galerij.mjs uit tools/galerij.json. Pas daar aan, niet hier. -->
  <link rel="icon" type="image/png" href="/assets/images/Group16.png">
  <title>${esc(title)}</title>
  <link rel="canonical" href="${site}${url}">
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="nl_NL">
  <meta property="og:site_name" content="van Son fotografie">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${site}${url}">
  <meta property="og:image" content="${site}${image}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap"
    rel="stylesheet"
  >
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/galerij.css">
  <link rel="stylesheet" href="/figma-theme.css">
${extraScript}</head>`;
}

const lightboxMarkup = `  <div class="lightbox" role="dialog" aria-modal="true" aria-label="Foto op volledig scherm" hidden aria-hidden="true">
    <div class="lightbox__backdrop" data-lightbox-close></div>
    <button class="lightbox__close" type="button" aria-label="Sluit foto (Esc)">
      <span aria-hidden="true">&times;</span>
    </button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Vorige foto" hidden>
      <span aria-hidden="true">&#8592;</span>
    </button>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Volgende foto" hidden>
      <span aria-hidden="true">&#8594;</span>
    </button>
    <figure class="lightbox__figure">
      <img class="lightbox__image" src="" alt="">
    </figure>
    <p class="lightbox__counter" aria-live="polite"></p>
  </div>`;

// ---------- Overzicht ----------
const series = data.series.map((serie) => ({ ...serie, coverPhoto: photo(serie.cover) }));
const usedCategories = Object.keys(data.categorieen).filter((key) => series.some((serie) => serie.categorie === key));

for (const serie of series) {
  if (!data.categorieen[serie.categorie]) problems.push(`Serie "${serie.slug}" heeft onbekende categorie "${serie.categorie}"`);
}

// Breedte van de omslagfoto per plek in het mozaïek (zie .serie-grid in figma-theme.css):
// elke 1e van 5 is de grote kaart, elke 5e is half zo breed, de rest smal maar hoog.
// Ruim genomen, omdat de foto de kaart vult (object-fit: cover) en dus ook op hoogte kan schalen.
function cardSizes(index) {
  if (index % 5 === 0) return '(max-width: 920px) 92vw, 55rem';
  if (index % 5 === 4) return '(max-width: 560px) 92vw, (max-width: 920px) 46vw, 37rem';
  return '(max-width: 560px) 92vw, (max-width: 920px) 46vw, 28rem';
}

// Kunstserie in de galerij: geen losse omslagfoto, maar een kleine muur met de eerste vier lijsten.
// Alles is decoratie binnen de kaartlink, dus geen eigen links en lege alt-teksten.
function miniMuur(serie) {
  const pieces = serie.layout
    .flat()
    .filter((block) => typeof block === 'string')
    .slice(0, 4)
    .map((file) => {
      const p = photo(file);
      if (!p) return '';
      const shape = p.ratio > 1.7 ? 'panorama' : p.portrait ? 'portrait' : 'landscape';
      return `<span class="kunst-piece kunst-piece--${shape}"><svg class="kunst-hanger" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 40 L50 4 L96 40" /></svg><span class="kunst-frame"><span class="kunst-frame__mat">${img({ ...p, alt: '' }, { sizes: '16rem' })}</span></span><span class="kunst-plaque"></span></span>`;
    })
    .join('');
  return `<span class="kunst-mini" aria-hidden="true">${pieces}</span>`;
}

const cards = series
  .map((serie, index) => {
    const label = data.categorieen[serie.categorie];
    const count = serie.layout.flat().filter((block) => typeof block === 'string' || typeof block?.breed === 'string').length;
    return `        <div class="serie-card" role="listitem" data-serie-card data-category="${esc(serie.categorie)}">
          <a class="serie-card__link" href="/galerij/${esc(serie.slug)}">
            <figure class="serie-card__media${serie.thema === 'muur' ? ' serie-card__media--muur' : ''}">
              ${serie.thema === 'muur' ? miniMuur(serie) : serie.coverPhoto ? img(serie.coverPhoto, { sizes: cardSizes(index), eager: index < 3 }) : ''}
              <span class="serie-card__label">${esc(label)}</span>
            </figure>
            <div class="serie-card__body">
              <h2 class="serie-card__title">${esc(serie.titel)}</h2>
              <p class="serie-card__context">${esc(serie.context)}</p>
              <div class="serie-card__footer">
                <span class="serie-card__cta">Bekijk serie <span class="serie-card__arrow" aria-hidden="true">&rarr;</span></span>
                <span class="serie-card__count">${count} foto's</span>
              </div>
            </div>
          </a>
        </div>`;
  })
  .join('\n');

const filters = [
  `<button class="gallery-filter is-active" type="button" data-filter="all" aria-pressed="true">Alles</button>`,
  ...usedCategories.map(
    (key) => `<button class="gallery-filter" type="button" data-filter="${esc(key)}" aria-pressed="false">${esc(data.categorieen[key])}</button>`
  ),
].join('\n          ');

const overview = `${head({
  title: 'Galerij | van Son fotografie',
  description: 'Fotoseries van van Son fotografie: 21 diners, evenementen, festivals en vrij werk. Elke serie vertelt het verhaal van één dag.',
  url: '/galerij',
  image: series[0].coverPhoto?.og || '',
  extraScript: '  <script src="/gallery.js" defer></script>\n',
})}
<body class="galerij-page">
${nav('galerij')}

  <main class="page-shell galerij-shell">
    <section class="galerij-intro">
      <h1 class="galerij-title visually-hidden">Galerij: authentieke momenten, stijlvol vastgelegd</h1>
      <div class="gallery-filterbar" role="group" aria-label="Filter series op categorie">
          ${filters}
      </div>
    </section>

    <section aria-label="Series">
      <div class="serie-grid" role="list">
${cards}
      </div>
      <p class="galerij-empty" data-gallery-empty hidden>Er staan nog geen series in deze categorie.</p>
    </section>

    <section class="gallery-cta">
      <div class="contact-card">
        <h2 class="panel-title">Zelf zulke beelden laten maken?</h2>
        <p>
          Zie je een serie die past bij wat je zoekt? Stel jouw fotoshoot samen, dan kijken we samen welk
          soort shoot of reportage het beste bij jouw moment past.
        </p>
        <div class="contact-actions">
          <a class="button button-primary" href="/fotoshoot">Stel jouw fotoshoot samen</a>
          <a class="button button-secondary" href="/#contact">Neem contact op</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <span class="site-footer__brand">van Son fotografie</span>
      <nav class="site-footer__links" aria-label="Contact">
        <a href="mailto:info@vansonfotografie.nl">Mail</a>
        <a href="https://www.instagram.com/van_son_fotografie/">Instagram</a>
        <a href="https://www.linkedin.com/in/gijs-van-son-98b421199/">LinkedIn</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;

// ---------- Pagina per serie ----------
function seriePage(serie, index) {
  const wall = serie.thema === 'muur';
  const previous = series[(index - 1 + series.length) % series.length];
  const next = series[(index + 1) % series.length];
  let first = true;

  const figure = (p, sizes, extraClass = '') => {
    if (!p) return '';
    const html = `<figure class="serie-photo-wrap${extraClass}">
          <a class="serie-photo" href="${p.full}" data-lightbox>
            ${img(p, { sizes, eager: first })}
          </a>
        </figure>`;
    first = false;
    return html;
  };

  // Kunst: ingelijste foto's aan een muur. Elke lijst is klikbaar.
  const framed = (p) => {
    if (!p) return '';
    const shape = p.ratio > 1.7 ? 'panorama' : p.portrait ? 'portrait' : 'landscape';
    const sizes = { panorama: '(max-width: 720px) 80vw, 34rem', landscape: '(max-width: 720px) 80vw, 28rem', portrait: '(max-width: 720px) 66vw, 17rem' }[shape];
    const html = `      <figure class="kunst-piece kunst-piece--${shape}">
        <svg class="kunst-hanger" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 40 L50 4 L96 40" /></svg>
        <a class="kunst-frame" href="${p.full}" data-lightbox aria-label="Bekijk groot: ${esc(p.alt)}">
          <span class="kunst-frame__mat">
            ${img(p, { sizes, eager: first })}
          </span>
        </a>
        <span class="kunst-plaque" aria-hidden="true"></span>
      </figure>`;
    first = false;
    return html;
  };

  // Opbouw zoals Figma "Desktop 5": de eerste losse foto komt bovenaan naast de titel.
  // Een {"tekst"} komt als crème tekstvak op de foto('s) die erna komen.
  const isText = (block) => block && typeof block.tekst === 'string';
  const isWide = (block) => block && typeof block.breed === 'string';
  const isPhotoBlock = (block) => typeof block === 'string' || Array.isArray(block) || isWide(block);
  let layout = [...serie.layout];
  let heroPhoto = null;
  if (!wall) {
    if (typeof layout[0] === 'string') {
      heroPhoto = photo(layout[0]);
      layout = layout.slice(1);
    } else {
      heroPhoto = photo(serie.cover);
    }
  }
  // De bovenste foto laadt direct; de foto's eronder pas als ze in beeld komen.
  if (heroPhoto) first = false;

  // Tekstvak op een foto, eventueel met een kopje ("kop") erboven.
  const note = (block) => {
    if (!block) return '';
    if (!block.kop) return `\n        <p class="serie-note">${esc(block.tekst)}</p>`;
    return `\n        <div class="serie-note">
          <h2 class="serie-note__title">${esc(block.kop)}</h2>
          <p>${esc(block.tekst)}</p>
        </div>`;
  };

  const blocks = layout
    .map((block, i) => {
      if (wall) {
        if (isText(block)) return `      <p class="kunst-note">${esc(block.tekst)}</p>`;
        return [block].flat().map((file) => framed(photo(file))).join('\n');
      }
      const previous = layout[i - 1];
      const noteBlock = isText(previous) ? previous : null;
      const noteText = noteBlock ? noteBlock.tekst : '';
      // {"breed": "foto"}: ook een staande foto over de volle breedte, bijgesneden zoals in het ontwerp.
      if (isWide(block)) {
        const p = photo(block.breed);
        if (!p) return '';
        // "uitsnede": hoe hoog de foto in het kader staat (0% = bovenkant, 100% = onderkant).
        const focus = /^\d{1,3}%$/.test(block.uitsnede || '') ? ` style="--focus: ${block.uitsnede}"` : '';
        if (block.uitsnede && !focus) problems.push(`Serie "${serie.slug}": uitsnede "${block.uitsnede}" moet een percentage zijn, bijvoorbeeld "20%"`);
        return `      <div class="serie-block serie-block--full serie-block--wide${noteText ? ' serie-block--noted' : ''}"${focus}>
        ${figure(p, '(max-width: 1200px) 92vw, 1170px')}${note(noteBlock)}
      </div>`;
      }
      if (typeof block === 'string') {
        const p = photo(block);
        if (!p) return '';
        const sizes = p.portrait ? '(max-width: 720px) 92vw, 40rem' : '(max-width: 1200px) 92vw, 1170px';
        return `      <div class="serie-block serie-block--full${p.portrait ? ' serie-block--portrait' : ''}${noteText ? ' serie-block--noted' : ''}" style="--ratio: ${p.ratio}">
        ${figure(p, sizes)}${note(noteBlock)}
      </div>`;
      }
      if (Array.isArray(block)) {
        if (block.length !== 2) problems.push(`Serie "${serie.slug}": een paar moet precies twee foto's hebben`);
        const figures = block.map((file) => figure(photo(file), '(max-width: 720px) 92vw, 36rem')).join('\n        ');
        return `      <div class="serie-block serie-block--pair${noteText ? ' serie-block--noted' : ''}">
        ${figures}${note(noteBlock)}
      </div>`;
      }
      if (isText(block)) {
        // Staat er een foto na deze tekst, dan komt de tekst als tekstvak op die foto.
        if (isPhotoBlock(layout[i + 1])) return '';
        return `      <p class="serie-block serie-block--text">${esc(block.tekst)}</p>`;
      }
      problems.push(`Serie "${serie.slug}": onbekend layout-blok ${JSON.stringify(block)}`);
      return '';
    })
    .filter(Boolean)
    .join('\n');

  const heroMedia = heroPhoto
    ? `      <figure class="serie-hero__media">
        <a class="serie-photo" href="${heroPhoto.full}" data-lightbox>
          ${img(heroPhoto, { sizes: '(max-width: 920px) 92vw, 39rem', eager: true })}
        </a>
      </figure>
`
    : '';

  const cta = wall
    ? `    <section class="serie-cta">
      <p class="serie-cta__lead">Benieuwd naar meer vrij werk?</p>
      <a class="button button-primary" href="${instagram}">Bekijk mijn Instagram &rarr;</a>
    </section>`
    : `    <section class="serie-cta">
      <p class="serie-cta__lead">Ook zo'n dag laten vastleggen?</p>
      <a class="button button-primary" href="/fotoshoot">Stel jouw fotoshoot samen &rarr;</a>
    </section>`;

  return `${head({
    title: `${serie.titel} – ${serie.context} | van Son fotografie`,
    description: serie.omschrijving,
    url: `/galerij/${serie.slug}`,
    image: serie.coverPhoto?.og || '',
    extraScript: `  <script src="/lightbox.js" defer></script>\n${wall ? '  <script src="/kunstmuur.js" defer></script>\n' : ''}`,
  })}
<body class="serie-page${wall ? ' serie-page--muur' : ''}">
${nav('galerij')}

  <main class="serie-shell">
    <header class="serie-hero${heroPhoto ? (heroPhoto.portrait ? ' serie-hero--staand' : '') : wall ? ' visually-hidden' : ' serie-hero--text'}">
${heroMedia}      <div class="serie-hero__text">
        <h1 class="serie-hero__title">${esc(serie.titel)}</h1>
        <p class="serie-hero__subtitle">${esc(serie.context)}</p>
        ${serie.introKop ? `<h2 class="serie-hero__kop">${esc(serie.introKop)}</h2>` : ''}
        ${[serie.intro ?? []].flat().map((alinea) => `<p class="serie-hero__intro">${esc(alinea)}</p>`).join('\n        ')}
      </div>
    </header>

${wall ? `    <div class="kunst-gallery">
      <button class="kunst-nav kunst-nav--prev" type="button" aria-label="Vorige foto" hidden><span aria-hidden="true">&larr;</span></button>
      <div class="kunst-wall" tabindex="0" aria-label="Kunstmuur, scroll of gebruik de pijlen om alle foto's te zien">
${blocks}
      </div>
      <button class="kunst-nav kunst-nav--next" type="button" aria-label="Volgende foto" hidden><span aria-hidden="true">&rarr;</span></button>
    </div>` : `    <div class="serie-story">
${blocks}
    </div>`}

${cta}

    <nav class="serie-next" aria-label="Andere series">
      <a href="/galerij/${esc(previous.slug)}"><small>&larr; Vorige serie</small>${esc(previous.titel)}</a>
      <a class="serie-next__next" href="/galerij/${esc(next.slug)}"><small>Volgende serie &rarr;</small>${esc(next.titel)}</a>
    </nav>
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <span class="site-footer__brand">van Son fotografie</span>
      <nav class="site-footer__links" aria-label="Contact">
        <a href="mailto:info@vansonfotografie.nl">Mail</a>
        <a href="https://www.instagram.com/van_son_fotografie/">Instagram</a>
        <a href="https://www.linkedin.com/in/gijs-van-son-98b421199/">LinkedIn</a>
      </nav>
    </div>
  </footer>

${lightboxMarkup}
</body>
</html>
`;
}

const pages = series.map((serie, index) => [serie.slug, seriePage(serie, index)]);

// ---------- Homepage: opdrachten en kunstmuur ----------
// Vult de blokken tussen de <!-- galerij:... --> markeringen in index.html.
const opdrachtSeries = series.filter((serie) => serie.thema !== 'muur').slice(0, 4);
const kunstSerie = series.find((serie) => serie.thema === 'muur');

const homeWork = opdrachtSeries
  .map((serie, index) => {
    const label = data.categorieen[serie.categorie];
    return `          <a class="home-work__item" href="/galerij/${esc(serie.slug)}">
            <figure class="home-work__media">
              ${serie.coverPhoto ? img(serie.coverPhoto, { sizes: '(max-width: 920px) 92vw, 34rem', eager: false }) : ''}
              <span class="home-work__label">${esc(label)}</span>
            </figure>
            <span class="home-work__caption">
              <span class="home-work__title">${esc(serie.titel)}</span>
              <span class="home-work__context">${esc(serie.context)}</span>
              <span class="home-work__cta">Bekijk serie <span aria-hidden="true">&rarr;</span></span>
            </span>
          </a>`;
  })
  .join('\n');

const homeArt = kunstSerie
  ? kunstSerie.layout
      .flat()
      .filter((block) => typeof block === 'string')
      .slice(0, 3)
      .map((file) => {
        const p = photo(file);
        if (!p) return '';
        const shape = p.ratio > 1.7 ? 'panorama' : p.portrait ? 'portrait' : 'landscape';
        return `          <figure class="kunst-piece kunst-piece--${shape}">
            <svg class="kunst-hanger" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 40 L50 4 L96 40" /></svg>
            <a class="kunst-frame" href="/galerij/${esc(kunstSerie.slug)}" aria-label="Naar de kunstmuur: ${esc(p.alt)}">
              <span class="kunst-frame__mat">
                ${img(p, { sizes: '(max-width: 720px) 80vw, 24rem' })}
              </span>
            </a>
            <span class="kunst-plaque" aria-hidden="true"></span>
          </figure>`;
      })
      .join('\n')
  : '';

function fillMarker(html, name, content) {
  const pattern = new RegExp(`(<!-- galerij:${name} -->)[\\s\\S]*?(\\s*<!-- /galerij:${name} -->)`);
  if (!pattern.test(html)) {
    problems.push(`Markering <!-- galerij:${name} --> ontbreekt in index.html`);
    return html;
  }
  return html.replace(pattern, (match, open, close) => `${open}\n${content}${close}`);
}

const indexPath = path.join(root, 'index.html');
const indexBefore = readFileSync(indexPath, 'utf8');
const lineEnding = indexBefore.includes('\r\n') ? '\r\n' : '\n';
let indexAfter = fillMarker(indexBefore.replace(/\r\n/g, '\n'), 'opdrachten', homeWork);
indexAfter = fillMarker(indexAfter, 'kunst', homeArt);
if (kunstSerie) indexAfter = indexAfter.replace(/data-kunst-link href="[^"]*"/g, `data-kunst-link href="/galerij/${kunstSerie.slug}"`);

const slugs = new Set();
for (const serie of series) {
  if (!/^[a-z0-9-]+$/.test(serie.slug)) problems.push(`Slug "${serie.slug}" mag alleen kleine letters, cijfers en streepjes bevatten`);
  if (slugs.has(serie.slug)) problems.push(`Slug "${serie.slug}" komt twee keer voor`);
  slugs.add(serie.slug);
}

if (problems.length) {
  console.error('Niet gebouwd, los eerst dit op:\n- ' + [...new Set(problems)].join('\n- '));
  process.exit(1);
}

// ---------- Schrijven ----------
writeFileSync(path.join(root, 'gallery.html'), overview);
writeFileSync(indexPath, indexAfter.replace(/\n/g, lineEnding));
const seriesDir = path.join(root, 'series');
mkdirSync(seriesDir, { recursive: true });
for (const file of readdirSync(seriesDir)) {
  if (file.endsWith('.html') && !slugs.has(file.replace(/\.html$/, ''))) rmSync(path.join(seriesDir, file));
}
for (const [slug, html] of pages) writeFileSync(path.join(seriesDir, `${slug}.html`), html);

const urls = [
  '/',
  '/galerij',
  ...series.map((serie) => `/galerij/${serie.slug}`),
  '/blogs',
  '/blogs/evenementen-fotografie',
  '/blogs/verjaardag-fotoshoot',
  '/fotoshoot',
];
writeFileSync(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${site}${url}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);

console.log(`Galerij gebouwd: overzicht + ${pages.length} series (${[...slugs].join(', ')}) + homepage-blokken + sitemap.xml`);
