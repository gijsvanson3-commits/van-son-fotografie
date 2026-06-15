const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const featuredBlog = document.querySelector("[data-featured-blog]");
const blogDocumentCache = new Map();

function shouldOpenInNewTab(link) {
  const href = link.getAttribute("href")?.trim() || "";

  if (!href || href.startsWith("#") || link.hasAttribute("download")) {
    return false;
  }

  if (/^(mailto:|tel:|javascript:)/i.test(href)) {
    return false;
  }

  try {
    const targetUrl = new URL(href, window.location.href);
    return targetUrl.origin !== window.location.origin;
  } catch (error) {
    return false;
  }
}

function applyNewTabBehavior(root = document) {
  const links = root.matches?.("a[href]") ? [root] : [...root.querySelectorAll("a[href]")];

  links.forEach((link) => {
    if (!shouldOpenInNewTab(link)) {
      return;
    }

    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

applyNewTabBehavior();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function extractText(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function humanizeSourceTitle(source) {
  return source
    .replace(/^blog-/i, "")
    .replace(/\.html$/i, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBlogSources() {
  const sourceLists = [...document.querySelectorAll("[data-blog-source-list]")];

  if (!sourceLists.length) {
    return [];
  }

  return sourceLists
    .flatMap((sourceList) => [...sourceList.querySelectorAll("li")])
    .map((item) => item.textContent?.trim() || "")
    .filter(Boolean);
}

function getCardLabelFromDocument(doc) {
  const firstTag = extractText(doc.querySelector(".blog-tag"));

  if (firstTag) {
    return firstTag;
  }

  const breadcrumb = extractText(doc.querySelector(".blog-breadcrumb"));

  if (!breadcrumb) {
    return "Blog";
  }

  const breadcrumbParts = breadcrumb.split("/");
  return breadcrumbParts[breadcrumbParts.length - 1].trim() || "Blog";
}

async function fetchBlogDocument(source) {
  if (blogDocumentCache.has(source)) {
    return blogDocumentCache.get(source);
  }

  const documentPromise = (async () => {
    const response = await fetch(new URL(source, window.location.href), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Kon blog niet laden: ${response.status}`);
    }

    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  })();

  blogDocumentCache.set(source, documentPromise);
  return documentPromise;
}

async function getBlogData(source) {
  if (!source) {
    return null;
  }

  if (window.location.protocol === "file:") {
    return null;
  }

  try {
    const doc = await fetchBlogDocument(source);
    const image = doc.querySelector(".blog-article-cover img");
    const title = extractText(doc.querySelector(".blog-article-title"));
    const intro =
      extractText(doc.querySelector(".blog-article-lead")) ||
      doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
      "";

    if (!title) {
      return null;
    }

    return {
      href: source,
      title,
      intro,
      imageSrc: image?.getAttribute("src") || "",
      imageAlt: image?.getAttribute("alt") || `Afbeelding bij ${title}`,
      label: getCardLabelFromDocument(doc),
    };
  } catch (error) {
    console.warn(`Automatisch laden van ${source} is niet gelukt.`, error);
    return null;
  }
}

function createBlogCard(data) {
  const card = document.createElement("a");
  card.className = "blog-card";
  card.href = data.href;
  applyNewTabBehavior(card);

  const media = document.createElement("div");
  media.className = "blog-card__media";

  if (data.imageSrc) {
    const image = document.createElement("img");
    image.src = data.imageSrc;
    image.alt = data.imageAlt || "";
    media.appendChild(image);
  } else {
    media.classList.add("blog-card__media--placeholder");

    const placeholderLabel = document.createElement("span");
    placeholderLabel.className = "blog-card__placeholder-label";
    placeholderLabel.textContent = "Blog";
    media.appendChild(placeholderLabel);
  }

  const body = document.createElement("div");
  body.className = "blog-card__body";

  const eyebrow = document.createElement("p");
  eyebrow.className = "blog-card__eyebrow";
  eyebrow.textContent = data.label || "Blog";

  const title = document.createElement("h3");
  title.className = "blog-card__title";
  title.textContent = data.title;

  const excerpt = document.createElement("p");
  excerpt.className = "blog-card__excerpt";
  excerpt.textContent = data.intro;

  const footer = document.createElement("div");
  footer.className = "blog-card__footer";

  const cta = document.createElement("span");
  cta.className = "blog-card__cta";
  cta.textContent = "Lees blog";

  footer.appendChild(cta);
  body.append(eyebrow, title, excerpt, footer);
  card.append(media, body);

  return card;
}

function createBlogEmptyState(message) {
  const emptyState = document.createElement("p");
  emptyState.className = "blog-empty-state";
  emptyState.textContent = message;
  return emptyState;
}

async function initBlogCards() {
  const track = document.querySelector("[data-blog-track]");

  if (!track) {
    return [];
  }

  const sources = getBlogSources();

  if (!sources.length) {
    track.replaceChildren(
      createBlogEmptyState("Voeg een blogbestand toe aan de bronlijst om hier kaartjes te tonen.")
    );
    return [];
  }

  const blogData = (await Promise.all(sources.map((source) => getBlogData(source)))).filter(Boolean);

  if (!blogData.length) {
    const message =
      window.location.protocol === "file:"
        ? "Open deze pagina via je hosting of een lokale server om je blogkaartjes automatisch te laden."
        : "Er zijn nu geen geldige blogs gevonden in je overzicht.";

    track.replaceChildren(createBlogEmptyState(message));
    return [];
  }

  const cards = blogData.map((data) => createBlogCard(data));
  track.replaceChildren(...cards);
  return blogData;
}

function applyFeaturedBlogData(data) {
  if (!featuredBlog || !data) {
    return;
  }

  const featuredImage = featuredBlog.querySelector("[data-featured-image]");
  const featuredTitle = featuredBlog.querySelector("[data-featured-title]");
  const featuredIntro = featuredBlog.querySelector("[data-featured-intro]");

  if (data.href) {
    featuredBlog.href = data.href;
  }

  applyNewTabBehavior(featuredBlog);

  if (featuredImage && data.imageSrc) {
    featuredImage.src = data.imageSrc;
  }

  if (featuredImage && data.imageAlt) {
    featuredImage.alt = data.imageAlt;
  }

  if (featuredTitle && data.title) {
    featuredTitle.textContent = data.title;
  }

  if (featuredIntro && data.intro) {
    featuredIntro.textContent = data.intro;
  }
}

async function initFeaturedBlog(validBlogData = []) {
  if (!featuredBlog) {
    return;
  }

  const source = featuredBlog.dataset.featuredSource?.trim() || featuredBlog.getAttribute("href");
  let featuredData =
    validBlogData.find((item) => item.href === source) ||
    validBlogData[0] ||
    null;

  if (!featuredData && source && window.location.protocol !== "file:") {
    featuredData = await getBlogData(source);
  }

  if (!featuredData) {
    featuredBlog.closest(".blog-showcase")?.setAttribute("hidden", "");
    return;
  }

  featuredBlog.closest(".blog-showcase")?.removeAttribute("hidden");
  applyFeaturedBlogData(featuredData);
}

function initBlogCarousel(carousel) {
  const track = carousel.querySelector("[data-blog-track]");
  const controls = carousel.querySelector(".blog-carousel__controls");
  const dotsContainer = carousel.querySelector("[data-blog-dots]");

  if (!track) {
    return;
  }

  const slides = [...track.querySelectorAll(".blog-card")];
  let pointerId = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let startScrollLeft = 0;
  let suppressClickUntil = 0;
  let hasDragged = false;
  let scrollFrame = null;
  let dots = [];
  let scrollPoints = [];

  if (!slides.length) {
    if (controls) {
      controls.hidden = true;
    }
    return;
  }

  function getScrollStep() {
    const firstCard = slides[0];
    const gap = Number.parseFloat(window.getComputedStyle(track).gap || "0");

    if (!firstCard) {
      return track.clientWidth * 0.86;
    }

    return firstCard.getBoundingClientRect().width + gap;
  }

  function getMaxScrollLeft() {
    return Math.max(track.scrollWidth - track.clientWidth, 0);
  }

  function getSlideScrollLeft(index) {
    const slide = slides[index];

    if (!slide) {
      return 0;
    }

    const trackBox = track.getBoundingClientRect();
    const slideBox = slide.getBoundingClientRect();
    const maxScrollLeft = getMaxScrollLeft();
    const nextScrollLeft = track.scrollLeft + (slideBox.left - trackBox.left);

    return clamp(nextScrollLeft, 0, maxScrollLeft);
  }

  function updateDots(activeIndex) {
    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function buildDots() {
    if (!dotsContainer) {
      return;
    }

    const uniquePoints = [];

    slides.forEach((_, index) => {
      const scrollLeft = getSlideScrollLeft(index);
      const hasCloseMatch = uniquePoints.some((value) => Math.abs(value - scrollLeft) < 6);

      if (!hasCloseMatch) {
        uniquePoints.push(scrollLeft);
      }
    });

    scrollPoints = uniquePoints;
    dotsContainer.replaceChildren();

    dots = scrollPoints.map((scrollLeft, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", `Ga naar blogpositie ${index + 1}`);
      dot.addEventListener("click", () => {
        track.scrollTo({
          left: scrollLeft,
          behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        });
      });
      dotsContainer.appendChild(dot);
      return dot;
    });

    if (controls) {
      controls.hidden = dots.length <= 1;
    }
  }

  function getActiveScrollPointIndex() {
    if (!scrollPoints.length) {
      return 0;
    }

    let activeIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    scrollPoints.forEach((scrollLeft, index) => {
      const distance = Math.abs(track.scrollLeft - scrollLeft);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        activeIndex = index;
      }
    });

    return activeIndex;
  }

  function updateControls() {
    updateDots(getActiveScrollPointIndex());
  }

  function queueControlUpdate() {
    if (scrollFrame !== null) {
      return;
    }

    scrollFrame = window.requestAnimationFrame(() => {
      updateControls();
      scrollFrame = null;
    });
  }

  function scrollTrack(direction) {
    track.scrollBy({
      left: direction * getScrollStep(),
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  }

  function endDrag(event) {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    if (track.hasPointerCapture?.(pointerId)) {
      track.releasePointerCapture(pointerId);
    }

    track.classList.remove("is-dragging");

    if (hasDragged) {
      suppressClickUntil = Date.now() + 260;
    }

    pointerId = null;
    pointerStartX = 0;
    pointerStartY = 0;
    startScrollLeft = 0;
    hasDragged = false;
  }

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollTrack(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollTrack(1);
    }
  });

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    startScrollLeft = track.scrollLeft;
    hasDragged = false;
  });

  track.addEventListener("pointermove", (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;

    if (!hasDragged) {
      const hasPassedThreshold = Math.abs(deltaX) > 7;
      const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

      if (!hasPassedThreshold || !isMostlyHorizontal) {
        return;
      }

      hasDragged = true;
      track.classList.add("is-dragging");
      track.setPointerCapture?.(pointerId);
    }

    event.preventDefault();
    track.scrollLeft = startScrollLeft - deltaX;
  });

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("lostpointercapture", (event) => {
    if (pointerId !== null && event.pointerId === pointerId) {
      track.classList.remove("is-dragging");
      pointerId = null;
      pointerStartX = 0;
      pointerStartY = 0;
      startScrollLeft = 0;
      hasDragged = false;
    }
  });

  track.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  track.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
    }
  });

  track.addEventListener("scroll", queueControlUpdate, { passive: true });
  window.addEventListener("resize", () => {
    buildDots();
    updateControls();
  });
  window.addEventListener("load", updateControls, { once: true });

  buildDots();
  updateControls();
}

async function initBlogPage() {
  const validBlogData = await initBlogCards();
  await initFeaturedBlog(validBlogData);
  document.querySelectorAll("[data-blog-carousel]").forEach((carousel) => initBlogCarousel(carousel));
}

initBlogPage();
