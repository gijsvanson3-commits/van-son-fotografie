// Blogoverzicht: één brede kaart per blog. De gegevens (foto, titel, intro, leestijd)
// worden uit de blogpagina zelf gehaald, zodat je alleen de link in blog.html hoeft toe te voegen.

const WORDS_PER_MINUTE = 200;

function extractText(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function getBlogSources() {
  return [...document.querySelectorAll("[data-blog-source-list] li")]
    .map((item) => item.textContent?.trim() || "")
    .filter(Boolean);
}

function getReadingTime(doc) {
  // Gebruik de leestijd uit de tag van de blog ("Leestijd 3 min"), anders tellen we de woorden.
  const tag = [...doc.querySelectorAll(".blog-tag")].map(extractText).find((text) => /^leestijd/i.test(text));
  const fromTag = tag?.match(/\d+/)?.[0];
  const minutes = fromTag
    ? Number(fromTag)
    : Math.max(1, Math.ceil(extractText(doc.querySelector(".blog-article-body") || doc.body).split(" ").length / WORDS_PER_MINUTE));

  return `Leestijd ${minutes} ${minutes === 1 ? "minuut" : "minuten"}`;
}

async function getBlogData(source) {
  if (window.location.protocol === "file:") {
    return null;
  }

  try {
    const response = await fetch(new URL(source, window.location.href), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Kon blog niet laden: ${response.status}`);
    }

    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const image = doc.querySelector(".blog-article-cover img");
    const title = extractText(doc.querySelector(".blog-article-title"));

    if (!title) {
      return null;
    }

    return {
      href: source,
      title,
      intro:
        extractText(doc.querySelector(".blog-article-lead")) ||
        doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
        "",
      imageSrc: image?.getAttribute("src") || "",
      imageSrcset: image?.getAttribute("srcset") || "",
      imageAlt: image?.getAttribute("alt") || "",
      readingTime: getReadingTime(doc),
    };
  } catch (error) {
    console.warn(`Automatisch laden van ${source} is niet gelukt.`, error);
    return null;
  }
}

function createBlogCard() {
  const card = document.createElement("a");
  card.className = "blog-wide";

  const image = document.createElement("img");
  image.className = "blog-wide__image";
  image.loading = "lazy";
  image.decoding = "async";
  image.sizes = "(max-width: 920px) 92vw, 73rem";

  const title = document.createElement("h2");
  title.className = "blog-wide__title";

  const panel = document.createElement("span");
  panel.className = "blog-wide__panel";

  const intro = document.createElement("span");
  intro.className = "blog-wide__intro";

  const time = document.createElement("span");
  time.className = "blog-wide__time";

  panel.append(intro, time);
  card.append(image, title, panel);
  return card;
}

// Vult een kaart met de gegevens uit de blog. Alleen wat echt anders is wordt aangepast,
// zodat de kaart die al in de HTML staat niet verspringt.
function fillBlogCard(card, data) {
  const image = card.querySelector(".blog-wide__image");
  const title = card.querySelector(".blog-wide__title");
  const intro = card.querySelector(".blog-wide__intro");
  const time = card.querySelector(".blog-wide__time");

  card.href = data.href;
  card.dataset.blogHref = data.href;

  if (data.imageSrc && image.getAttribute("src")?.replace(/^\//, "") !== data.imageSrc.replace(/^\//, "")) {
    image.src = data.imageSrc;
    if (data.imageSrcset) {
      image.srcset = data.imageSrcset;
    } else {
      image.removeAttribute("srcset");
    }
  }

  if (!data.imageSrc) {
    image.remove();
    card.classList.add("blog-wide--no-image");
  }

  image.alt = data.imageAlt || `Foto bij ${data.title}`;

  if (extractText(title) !== data.title) title.textContent = data.title;
  if (data.intro && extractText(intro) !== data.intro) intro.textContent = data.intro;
  if (extractText(time) !== data.readingTime) time.textContent = data.readingTime;
}

async function initBlogList() {
  const list = document.querySelector("[data-blog-list]");

  if (!list) {
    return;
  }

  const sources = getBlogSources();
  const blogData = await Promise.all(sources.map((source) => getBlogData(source)));

  // Op file:// of zonder netwerk blijft de kaart uit de HTML gewoon staan.
  if (!blogData.some(Boolean)) {
    return;
  }

  const existing = new Map([...list.querySelectorAll(".blog-wide")].map((card) => [card.dataset.blogHref, card]));
  const cards = [];

  blogData.forEach((data) => {
    if (!data) return;
    const card = existing.get(data.href) || createBlogCard();
    fillBlogCard(card, data);
    cards.push(card);
  });

  // Kaarten in de volgorde van de bronlijst; kaarten van blogs die niet meer bestaan verdwijnen.
  list.replaceChildren(...cards);
}

// Start pas als de pagina voor het eerst in beeld is getekend, zodat Chrome de laadsnelheid (LCP)
// van de eerste kaart goed kan meten.
function startAfterFirstPaint() {
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(initBlogList, 0)));
}

if (document.readyState === "complete") {
  startAfterFirstPaint();
} else {
  window.addEventListener("load", startAfterFirstPaint, { once: true });
}
