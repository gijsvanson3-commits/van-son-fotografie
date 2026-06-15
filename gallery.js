const galleryGrid = document.querySelector("[data-gallery-grid]");
const gallerySourceList = document.querySelector("[data-gallery-source-list]");
const galleryEmptyState = document.querySelector("[data-gallery-empty]");
const galleryFilters = [...document.querySelectorAll("[data-filter]")];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightbox = document.querySelector(".lightbox");
const lightboxFigure = document.querySelector(".lightbox__figure");
const lightboxImage = document.querySelector(".lightbox__image");
const lightboxClose = document.querySelector(".lightbox__close");
const lightboxBackdrop = document.querySelector("[data-lightbox-close]");
const lightboxPrev = document.querySelector(".lightbox__nav--prev");
const lightboxNext = document.querySelector(".lightbox__nav--next");
const lightboxTransitionMs = 260;
let activeGalleryFilter = "all";
let lightboxImages = [];
let lightboxIndex = -1;
let lightboxCloseTimer = null;
let lightboxPointerId = null;
let lightboxPointerStartX = 0;
let lightboxPointerStartY = 0;
let lightboxPointerDeltaX = 0;
let lightboxPointerDeltaY = 0;

function normalizePagePath(pathname) {
  return pathname
    .replace(/\\/g, "/")
    .replace(/\/index\.html$/i, "/")
    .replace(/\/+$/, "") || "/";
}

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
    const currentPath = normalizePagePath(window.location.pathname);
    const targetPath = normalizePagePath(targetUrl.pathname);

    return targetUrl.origin !== window.location.origin || targetPath !== currentPath;
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

const galleryCategoryLabels = {
  verjaardag: "Verjaardag",
  trouwen: "Trouwen",
  evenementen: "Evenementen / festivals",
  overig: "Overig",
};

const galleryShapePattern = [
  "wide",
  "tall",
  "standard",
  "standard",
  "panorama",
  "standard",
  "tall",
  "standard",
  "wide",
];

function humanizeImageName(path) {
  return path
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Foto";
}

function normalizeGalleryCategory(category) {
  return Object.hasOwn(galleryCategoryLabels, category) ? category : "overig";
}

function normalizeGalleryShape(shape, index) {
  const allowedShapes = new Set(["wide", "tall", "standard", "panorama"]);

  if (allowedShapes.has(shape)) {
    return shape;
  }

  return galleryShapePattern[index % galleryShapePattern.length];
}

function getGalleryItems() {
  if (!gallerySourceList) {
    return [];
  }

  return [...gallerySourceList.querySelectorAll("li")]
    .map((item, index) => {
      const src = item.textContent?.trim() || "";
      const category = normalizeGalleryCategory(item.dataset.category?.trim() || "overig");

      if (!src) {
        return null;
      }

      return {
        src,
        category,
        alt: item.dataset.alt?.trim() || `${galleryCategoryLabels[category]} - ${humanizeImageName(src)}`,
        shape: normalizeGalleryShape(item.dataset.shape?.trim() || "", index),
        desktopAspectRatio: item.dataset.aspectDesktop?.trim() || "",
      };
    })
    .filter(Boolean);
}

function createGalleryCard(item, options = {}) {
  const article = document.createElement("article");
  article.className = `gallery-card gallery-card--${item.shape}`;
  article.dataset.category = item.category;

  if (options.uniformLayout) {
    article.classList.add("gallery-card--filtered");
  }

  const media = document.createElement("div");
  media.className = "gallery-card__media";
  media.setAttribute("role", "button");
  media.setAttribute("tabindex", "0");
  media.setAttribute("aria-label", `Open foto: ${item.alt}`);

  const image = document.createElement("img");
  image.src = item.src;
  image.alt = item.alt;
  image.loading = "lazy";
  image.decoding = "async";

  if (window.innerWidth > 920 && item.desktopAspectRatio && !options.uniformLayout) {
    media.style.aspectRatio = item.desktopAspectRatio;
  }

  const overlay = document.createElement("div");
  overlay.className = "gallery-card__overlay";

  const pill = document.createElement("span");
  pill.className = "gallery-card__pill";
  pill.textContent = galleryCategoryLabels[item.category];

  media.appendChild(image);
  overlay.appendChild(pill);
  media.appendChild(overlay);
  article.append(media);

  media.addEventListener("click", () => {
    openLightbox(image);
  });

  media.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openLightbox(image);
  });

  return article;
}

function resetLightboxDrag() {
  lightboxPointerId = null;
  lightboxPointerStartX = 0;
  lightboxPointerStartY = 0;
  lightboxPointerDeltaX = 0;
  lightboxPointerDeltaY = 0;
  lightboxFigure?.classList.remove("is-dragging");
}

function updateLightboxNavigation() {
  const hasMultipleImages = lightboxImages.length > 1;

  lightbox?.classList.toggle("lightbox--multi", hasMultipleImages);

  if (lightboxPrev) {
    lightboxPrev.hidden = !hasMultipleImages;
    lightboxPrev.disabled = !hasMultipleImages;
  }

  if (lightboxNext) {
    lightboxNext.hidden = !hasMultipleImages;
    lightboxNext.disabled = !hasMultipleImages;
  }
}

function getVisibleGalleryImages() {
  return [...document.querySelectorAll(".gallery-grid .gallery-card__media img")].filter(
    (image) => image instanceof HTMLImageElement
  );
}

function renderLightboxImage() {
  const currentImage = lightboxImages[lightboxIndex];

  if (!currentImage || !lightboxImage) {
    return;
  }

  lightboxImage.src = currentImage.currentSrc || currentImage.src;
  lightboxImage.alt = currentImage.alt || "";
  lightboxFigure?.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function openLightbox(image) {
  if (!lightbox || !lightboxImage) {
    return;
  }

  if (lightboxCloseTimer) {
    window.clearTimeout(lightboxCloseTimer);
    lightboxCloseTimer = null;
  }

  lightboxImages = getVisibleGalleryImages();
  lightboxIndex = Math.max(lightboxImages.indexOf(image), 0);

  updateLightboxNavigation();
  renderLightboxImage();
  lightbox.hidden = false;
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  lightbox.classList.remove("is-visible");
  window.requestAnimationFrame(() => {
    lightbox.classList.add("is-visible");
  });
  lightboxClose?.focus();
}

function closeLightbox() {
  if (!lightbox || !lightboxImage) {
    return;
  }

  resetLightboxDrag();
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.classList.remove("is-visible");

  if (lightboxCloseTimer) {
    window.clearTimeout(lightboxCloseTimer);
  }

  lightboxCloseTimer = window.setTimeout(() => {
    lightbox.hidden = true;
    lightboxImage.src = "";
    lightboxImage.alt = "";
    document.body.classList.remove("lightbox-open");
    lightboxImages = [];
    lightboxIndex = -1;
    updateLightboxNavigation();
    lightboxCloseTimer = null;
  }, prefersReducedMotion.matches ? 0 : lightboxTransitionMs);
}

function moveLightbox(step) {
  if (lightboxImages.length <= 1) {
    return;
  }

  lightboxIndex = (lightboxIndex + step + lightboxImages.length) % lightboxImages.length;
  renderLightboxImage();
}

function getGalleryColumnCount() {
  if (window.innerWidth <= 560) {
    return 1;
  }

  if (window.innerWidth <= 920) {
    return 2;
  }

  return 3;
}

function getGalleryShapeRatio(shape) {
  const shapeRatios = {
    wide: 4 / 5,
    tall: 6 / 4,
    panorama: 10 / 16,
    standard: 5 / 4,
  };

  return shapeRatios[shape] || shapeRatios.standard;
}

function estimateGalleryItemHeight(item) {
  const gapWeight = 0.08;

  return getGalleryShapeRatio(item.shape) + gapWeight;
}

function buildGreedyGalleryColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => []);
  const heights = Array.from({ length: columnCount }, () => 0);

  items.forEach((item) => {
    const shortestColumnIndex = heights.indexOf(Math.min(...heights));

    columns[shortestColumnIndex].push(item);
    heights[shortestColumnIndex] += estimateGalleryItemHeight(item);
  });

  return { columns, heights };
}

function buildBalancedGalleryPlan(items, columnCount) {
  if (items.length === 0) {
    return Array.from({ length: columnCount }, () => []);
  }

  const indexedItems = items.map((item, index) => ({
    ...item,
    originalIndex: index,
    estimatedHeight: estimateGalleryItemHeight(item),
  }));
  const sortedItems = [...indexedItems].sort((left, right) => right.estimatedHeight - left.estimatedHeight);
  const greedyResult = buildGreedyGalleryColumns(sortedItems, columnCount);
  const averageHeight = sortedItems.reduce((sum, item) => sum + item.estimatedHeight, 0) / columnCount;
  let bestScore = {
    range: Math.max(...greedyResult.heights) - Math.min(...greedyResult.heights),
    overflow: Math.max(...greedyResult.heights) - averageHeight,
  };
  let bestColumns = greedyResult.columns.map((column) => [...column]);
  const heights = Array.from({ length: columnCount }, () => 0);
  const counts = Array.from({ length: columnCount }, () => 0);
  const columns = Array.from({ length: columnCount }, () => []);

  function isBetterScore(nextHeights) {
    const nextRange = Math.max(...nextHeights) - Math.min(...nextHeights);
    const nextOverflow = Math.max(...nextHeights) - averageHeight;

    if (nextRange < bestScore.range - 0.0001) {
      return { range: nextRange, overflow: nextOverflow };
    }

    if (Math.abs(nextRange - bestScore.range) <= 0.0001 && nextOverflow < bestScore.overflow - 0.0001) {
      return { range: nextRange, overflow: nextOverflow };
    }

    return null;
  }

  function backtrack(itemIndex) {
    if (itemIndex >= sortedItems.length) {
      const improvedScore = isBetterScore(heights);

      if (improvedScore) {
        bestScore = improvedScore;
        bestColumns = columns.map((column) => [...column]);
      }

      return;
    }

    const currentItem = sortedItems[itemIndex];
    const triedHeights = new Set();

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const signature = `${heights[columnIndex].toFixed(4)}-${counts[columnIndex]}`;

      if (triedHeights.has(signature)) {
        continue;
      }

      triedHeights.add(signature);

      heights[columnIndex] += currentItem.estimatedHeight;
      counts[columnIndex] += 1;
      columns[columnIndex].push(currentItem);

      const currentRange = Math.max(...heights) - Math.min(...heights);

      if (currentRange <= bestScore.range + 0.45) {
        backtrack(itemIndex + 1);
      }

      columns[columnIndex].pop();
      counts[columnIndex] -= 1;
      heights[columnIndex] -= currentItem.estimatedHeight;
    }
  }

  if (sortedItems.length <= 14) {
    backtrack(0);
  }

  return bestColumns.map((column) =>
    column
      .sort((left, right) => left.originalIndex - right.originalIndex)
      .map(({ estimatedHeight, originalIndex, ...item }) => item)
  );
}

function buildGalleryColumns(items) {
  const columnCount = getGalleryColumnCount();
  const plannedColumns = buildBalancedGalleryPlan(items, columnCount);

  return plannedColumns.map((columnItems) => {
    const column = document.createElement("div");
    column.className = "gallery-grid__column";

    columnItems.forEach((item) => {
      column.appendChild(createGalleryCard(item));
    });

    return column;
  });
}

function buildFilteredGalleryGrid(items) {
  return items.map((item) => createGalleryCard(item, { uniformLayout: true }));
}

function setActiveFilter(filter) {
  galleryFilters.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function applyGalleryFilter(filter) {
  if (!galleryGrid) {
    return;
  }

  const items = getGalleryItems().filter((item) => filter === "all" || item.category === filter);
  const isFilteredView = filter !== "all";

  if (galleryEmptyState) {
    galleryEmptyState.hidden = items.length > 0;
  }

  galleryGrid.classList.toggle("gallery-grid--filtered", isFilteredView);
  galleryGrid.classList.toggle("gallery-grid--all", !isFilteredView);
  galleryGrid.replaceChildren(
    ...(isFilteredView ? buildFilteredGalleryGrid(items) : buildGalleryColumns(items))
  );
  activeGalleryFilter = filter;
  setActiveFilter(filter);
}

function initGalleryPage() {
  if (!galleryGrid) {
    return;
  }

  galleryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      applyGalleryFilter(button.dataset.filter || "all");
    });
  });

  applyGalleryFilter("all");
  window.addEventListener("resize", () => {
    applyGalleryFilter(activeGalleryFilter);
  });
}

lightboxClose?.addEventListener("click", closeLightbox);
lightboxBackdrop?.addEventListener("click", closeLightbox);
lightboxPrev?.addEventListener("click", () => moveLightbox(-1));
lightboxNext?.addEventListener("click", () => moveLightbox(1));

lightboxFigure?.addEventListener("pointerdown", (event) => {
  if (lightboxImages.length <= 1) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  lightboxPointerId = event.pointerId;
  lightboxPointerStartX = event.clientX;
  lightboxPointerStartY = event.clientY;
  lightboxPointerDeltaX = 0;
  lightboxPointerDeltaY = 0;
  lightboxFigure.classList.add("is-dragging");
  lightboxFigure.setPointerCapture?.(event.pointerId);
});

lightboxFigure?.addEventListener("pointermove", (event) => {
  if (lightboxPointerId === null || event.pointerId !== lightboxPointerId) {
    return;
  }

  lightboxPointerDeltaX = event.clientX - lightboxPointerStartX;
  lightboxPointerDeltaY = event.clientY - lightboxPointerStartY;
});

lightboxFigure?.addEventListener("pointerup", (event) => {
  if (lightboxPointerId === null || event.pointerId !== lightboxPointerId) {
    return;
  }

  if (lightboxFigure?.hasPointerCapture?.(lightboxPointerId)) {
    lightboxFigure.releasePointerCapture(lightboxPointerId);
  }

  if (
    Math.abs(lightboxPointerDeltaX) > 48 &&
    Math.abs(lightboxPointerDeltaX) > Math.abs(lightboxPointerDeltaY)
  ) {
    moveLightbox(lightboxPointerDeltaX < 0 ? 1 : -1);
  }

  resetLightboxDrag();
});

lightboxFigure?.addEventListener("pointercancel", (event) => {
  if (lightboxPointerId !== null && event.pointerId === lightboxPointerId) {
    resetLightboxDrag();
  }
});

lightboxFigure?.addEventListener("lostpointercapture", (event) => {
  if (lightboxPointerId !== null && event.pointerId === lightboxPointerId) {
    resetLightboxDrag();
  }
});

lightboxFigure?.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox && !lightbox.hidden) {
    closeLightbox();
    return;
  }

  if (!lightbox || lightbox.hidden) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveLightbox(1);
  }
});

initGalleryPage();
