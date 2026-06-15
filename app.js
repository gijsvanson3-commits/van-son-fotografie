const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const topbar = document.querySelector(".topbar");
const topbarLinks = topbar ? [...topbar.querySelectorAll('a[href^="#"]')] : [];
const sunNav = document.querySelector("[data-sun-nav]");
const sunNavButton = sunNav?.querySelector(".sun-nav__button");
const sunNavLinks = sunNav ? [...sunNav.querySelectorAll("[data-sun-link]")] : [];
const sunNavMenu = sunNav?.querySelector(".sun-nav__menu");
const lightbox = document.querySelector(".lightbox");
const lightboxFigure = document.querySelector(".lightbox__figure");
const lightboxImage = document.querySelector(".lightbox__image");
const lightboxClose = document.querySelector(".lightbox__close");
const lightboxBackdrop = document.querySelector("[data-lightbox-close]");
const lightboxPrev = document.querySelector(".lightbox__nav--prev");
const lightboxNext = document.querySelector(".lightbox__nav--next");
const lightboxTransitionMs = 260;
const sunNavOpenDelayMs = 140;
const sunNavCloseDelayMs = 170;
const sectionTargets = ["about", "commercial", "art", "contact"]
  .map((id) => document.getElementById(id))
  .filter(Boolean);
let lightboxImages = [];
let lightboxIndex = -1;
let lightboxSlider = null;
let lightboxCloseTimer = null;
let lightboxPointerId = null;
let lightboxPointerStartX = 0;
let lightboxPointerStartY = 0;
let lightboxPointerDeltaX = 0;
let lightboxPointerDeltaY = 0;
let sunNavOpenTimer = null;
let sunNavCloseTimer = null;
let sunNavPinnedOpen = false;

function getScrollOffset() {
  return (topbar?.offsetHeight || 0) + 18;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function interpolateChannel(start, end, progress) {
  return Math.round(start + (end - start) * progress);
}

function interpolateColor(start, end, progress) {
  return `rgb(${interpolateChannel(start[0], end[0], progress)}, ${interpolateChannel(start[1], end[1], progress)}, ${interpolateChannel(start[2], end[2], progress)})`;
}

function interpolateAlpha(start, end, progress) {
  return (start + (end - start) * progress).toFixed(3);
}

function setSunNavOpen(isOpen) {
  if (!sunNav || !sunNavButton) {
    return;
  }

  sunNav.classList.toggle("is-open", isOpen);
  sunNavButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function clearSunNavTimers() {
  if (sunNavOpenTimer) {
    window.clearTimeout(sunNavOpenTimer);
    sunNavOpenTimer = null;
  }

  if (sunNavCloseTimer) {
    window.clearTimeout(sunNavCloseTimer);
    sunNavCloseTimer = null;
  }
}

function scheduleSunNavOpen() {
  if (!sunNav) {
    return;
  }

  if (sunNavPinnedOpen) {
    setSunNavOpen(true);
    return;
  }

  if (sunNavCloseTimer) {
    window.clearTimeout(sunNavCloseTimer);
    sunNavCloseTimer = null;
  }

  if (sunNavOpenTimer) {
    return;
  }

  sunNavOpenTimer = window.setTimeout(() => {
    setSunNavOpen(true);
    sunNavOpenTimer = null;
  }, sunNavOpenDelayMs);
}

function scheduleSunNavClose() {
  if (!sunNav || sunNavPinnedOpen) {
    return;
  }

  if (sunNavOpenTimer) {
    window.clearTimeout(sunNavOpenTimer);
    sunNavOpenTimer = null;
  }

  if (sunNavCloseTimer) {
    window.clearTimeout(sunNavCloseTimer);
  }

  sunNavCloseTimer = window.setTimeout(() => {
    setSunNavOpen(false);
    sunNavCloseTimer = null;
  }, sunNavCloseDelayMs);
}

function updateSunPalette(progress) {
  if (!sunNav) {
    return;
  }

  const dawn = {
    highlight: [255, 245, 205],
    core: [255, 190, 102],
    deep: [255, 121, 88],
    ray: [255, 154, 101],
    glow: [255, 196, 124],
    shadow: [192, 105, 54],
  };
  const noon = {
    highlight: [255, 250, 214],
    core: [255, 212, 74],
    deep: [255, 166, 24],
    ray: [255, 193, 77],
    glow: [255, 223, 118],
    shadow: [210, 146, 26],
  };
  const dusk = {
    highlight: [255, 225, 150],
    core: [255, 156, 28],
    deep: [255, 98, 0],
    ray: [255, 132, 20],
    glow: [255, 143, 22],
    shadow: [169, 72, 0],
  };

  const phaseProgress = progress < 0.5 ? progress / 0.5 : (progress - 0.5) / 0.5;
  const startPalette = progress < 0.5 ? dawn : noon;
  const endPalette = progress < 0.5 ? noon : dusk;
  const minY = 108;
  const maxY = Math.max(minY + 88, window.innerHeight - 112);
  const y = minY + (maxY - minY) * progress;
  const scale = 0.94 + progress * 0.12;
  const rotation = -20 + progress * 170;

  document.documentElement.style.setProperty("--sun-nav-y", `${y}px`);
  document.documentElement.style.setProperty("--sun-nav-scale", scale.toFixed(3));
  document.documentElement.style.setProperty("--sun-nav-rotate", `${rotation.toFixed(2)}deg`);
  document.documentElement.style.setProperty(
    "--sun-nav-highlight",
    interpolateColor(startPalette.highlight, endPalette.highlight, phaseProgress)
  );
  document.documentElement.style.setProperty(
    "--sun-nav-core",
    interpolateColor(startPalette.core, endPalette.core, phaseProgress)
  );
  document.documentElement.style.setProperty(
    "--sun-nav-core-deep",
    interpolateColor(startPalette.deep, endPalette.deep, phaseProgress)
  );
  document.documentElement.style.setProperty(
    "--sun-nav-ray",
    `rgba(${interpolateChannel(startPalette.ray[0], endPalette.ray[0], phaseProgress)}, ${interpolateChannel(startPalette.ray[1], endPalette.ray[1], phaseProgress)}, ${interpolateChannel(startPalette.ray[2], endPalette.ray[2], phaseProgress)}, ${interpolateAlpha(0.94, 1, progress)})`
  );
  document.documentElement.style.setProperty(
    "--sun-nav-glow",
    `rgba(${interpolateChannel(startPalette.glow[0], endPalette.glow[0], phaseProgress)}, ${interpolateChannel(startPalette.glow[1], endPalette.glow[1], phaseProgress)}, ${interpolateChannel(startPalette.glow[2], endPalette.glow[2], phaseProgress)}, ${interpolateAlpha(0.3, 0.42, progress)})`
  );
  document.documentElement.style.setProperty(
    "--sun-nav-shadow",
    `rgba(${interpolateChannel(startPalette.shadow[0], endPalette.shadow[0], phaseProgress)}, ${interpolateChannel(startPalette.shadow[1], endPalette.shadow[1], phaseProgress)}, ${interpolateChannel(startPalette.shadow[2], endPalette.shadow[2], phaseProgress)}, ${interpolateAlpha(0.24, 0.34, progress)})`
  );
}

function updateSectionHighlights() {
  if (!sectionTargets.length) {
    return;
  }

  let currentId = sectionTargets[0].id;
  const threshold = window.innerHeight * 0.36;
  const isNearPageBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;

  sectionTargets.forEach((section) => {
    if (section.getBoundingClientRect().top <= threshold) {
      currentId = section.id;
    }
  });

  if (isNearPageBottom) {
    currentId = sectionTargets[sectionTargets.length - 1].id;
  }

  [...sunNavLinks, ...topbarLinks].forEach((link) => {
    const targetId = link.getAttribute("href")?.slice(1);
    const isActive = targetId === currentId;

    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    const target = targetId ? document.querySelector(targetId) : null;

    if (!target) {
      return;
    }

    event.preventDefault();

    const targetTop = target.getBoundingClientRect().top + window.scrollY - getScrollOffset();
    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  });
});

function updateScrollEffects() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 12);
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const progress = clamp(window.scrollY / maxScroll, 0, 1);

  if (!prefersReducedMotion.matches) {
    document.documentElement.style.setProperty(
      "--timeline-sun-rotation",
      `${window.scrollY * 0.12}deg`
    );
  }

  updateSunPalette(progress);
  updateSectionHighlights();
}

function initSlider(slider) {
  const slides = [...slider.querySelectorAll(".slider-slide")];
  const dotsContainer = slider.querySelector(".slider-dots");
  const prevButton = slider.querySelector('[data-direction="prev"]');
  const nextButton = slider.querySelector('[data-direction="next"]');
  const frame = slider.querySelector(".slider-frame");

  if (!slides.length || !dotsContainer) {
    return;
  }

  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let pointerId = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerDeltaX = 0;
  let pointerDeltaY = 0;

  if (activeIndex < 0) {
    activeIndex = 0;
  }

  function suppressSliderImageClick() {
    slider.dataset.suppressClickUntil = `${Date.now() + 320}`;
  }

  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slider-dot";
    dot.setAttribute("aria-label", `Ga naar foto ${index + 1}`);
    dot.addEventListener("click", () => setActiveSlide(index));
    dotsContainer.appendChild(dot);
    return dot;
  });

  function setActiveSlide(nextIndex) {
    activeIndex = (nextIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  slider.setActiveSlide = setActiveSlide;
  slider.getSlides = () => slides;

  prevButton?.addEventListener("click", () => setActiveSlide(activeIndex - 1));
  nextButton?.addEventListener("click", () => setActiveSlide(activeIndex + 1));

  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveSlide(activeIndex + 1);
    }
  });

  function endPointerGesture(event) {
    if (!frame || pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    frame.classList.remove("is-dragging");

    if (frame.hasPointerCapture?.(pointerId)) {
      frame.releasePointerCapture(pointerId);
    }

    if (Math.abs(pointerDeltaX) > 42 && Math.abs(pointerDeltaX) > Math.abs(pointerDeltaY)) {
      setActiveSlide(activeIndex + (pointerDeltaX < 0 ? 1 : -1));
      suppressSliderImageClick();
    }

    pointerId = null;
    pointerStartX = 0;
    pointerStartY = 0;
    pointerDeltaX = 0;
    pointerDeltaY = 0;
  }

  frame?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (event.target.closest(".slider-control")) {
      return;
    }

    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerDeltaX = 0;
    pointerDeltaY = 0;
    frame.classList.add("is-dragging");
    frame.setPointerCapture?.(pointerId);
  });

  frame?.addEventListener("pointermove", (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    pointerDeltaX = event.clientX - pointerStartX;
    pointerDeltaY = event.clientY - pointerStartY;
  });

  frame?.addEventListener("pointerup", endPointerGesture);
  frame?.addEventListener("pointercancel", endPointerGesture);
  frame?.addEventListener("lostpointercapture", (event) => {
    if (pointerId !== null && event.pointerId === pointerId) {
      frame.classList.remove("is-dragging");
      pointerId = null;
      pointerStartX = 0;
      pointerStartY = 0;
      pointerDeltaX = 0;
      pointerDeltaY = 0;
    }
  });

  frame?.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  frame?.addEventListener("click", (event) => {
    if (event.target.closest(".slider-control")) {
      return;
    }

    const suppressUntil = Number(slider.dataset.suppressClickUntil || 0);

    if (Date.now() < suppressUntil) {
      return;
    }

    const activeImage = slider.querySelector(".slider-slide.is-active img");

    if (activeImage) {
      openLightbox(activeImage);
    }
  });

  setActiveSlide(activeIndex);
}

document.querySelectorAll("[data-slider]").forEach((slider) => initSlider(slider));

if (sunNav && sunNavButton) {
  sunNav.addEventListener("mouseenter", scheduleSunNavOpen);
  sunNav.addEventListener("mouseleave", scheduleSunNavClose);
  sunNav.addEventListener("focusin", () => {
    clearSunNavTimers();
    setSunNavOpen(true);
  });
  sunNav.addEventListener("focusout", (event) => {
    if (!sunNav.contains(event.relatedTarget) && !sunNavPinnedOpen) {
      setSunNavOpen(false);
    }
  });

  sunNavButton.addEventListener("click", (event) => {
    event.preventDefault();
    clearSunNavTimers();
    sunNavPinnedOpen = !sunNavPinnedOpen;
    setSunNavOpen(sunNavPinnedOpen);
  });

  sunNavLinks.forEach((link) => {
    link.addEventListener("click", () => {
      sunNavPinnedOpen = false;
      setSunNavOpen(false);
    });
  });

  document.addEventListener("click", (event) => {
    if (!sunNav.contains(event.target)) {
      sunNavPinnedOpen = false;
      setSunNavOpen(false);
    }
  });

  sunNavMenu?.addEventListener("mouseenter", () => {
    clearSunNavTimers();
    setSunNavOpen(true);
  });

  sunNavMenu?.addEventListener("mouseleave", scheduleSunNavClose);
}

let scrollFrame = null;

function requestScrollEffects() {
  if (scrollFrame !== null) {
    return;
  }

  scrollFrame = window.requestAnimationFrame(() => {
    updateScrollEffects();
    scrollFrame = null;
  });
}

updateScrollEffects();
window.addEventListener("scroll", requestScrollEffects, { passive: true });
window.addEventListener("resize", requestScrollEffects);
window.addEventListener("load", updateScrollEffects);

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

function openLightbox(image) {
  if (!lightbox || !lightboxImage) {
    return;
  }

  if (lightboxCloseTimer) {
    window.clearTimeout(lightboxCloseTimer);
    lightboxCloseTimer = null;
  }

  const slider = image.closest("[data-slider]");
  lightboxImages = slider
    ? [...slider.querySelectorAll(".slider-slide img")]
    : [image];
  lightboxIndex = Math.max(lightboxImages.indexOf(image), 0);
  lightboxSlider = slider;

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
    lightboxSlider = null;
    updateLightboxNavigation();
    lightboxCloseTimer = null;
  }, prefersReducedMotion.matches ? 0 : lightboxTransitionMs);
}

function renderLightboxImage() {
  const currentImage = lightboxImages[lightboxIndex];

  if (!currentImage || !lightboxImage) {
    return;
  }

  lightboxImage.src = currentImage.currentSrc || currentImage.src;
  lightboxImage.alt = currentImage.alt || "";
  lightboxFigure?.scrollTo({ top: 0, left: 0, behavior: "auto" });

  if (lightboxSlider?.setActiveSlide) {
    lightboxSlider.setActiveSlide(lightboxIndex);
  }
}

function moveLightbox(step) {
  if (lightboxImages.length <= 1) {
    return;
  }

  lightboxIndex = (lightboxIndex + step + lightboxImages.length) % lightboxImages.length;
  renderLightboxImage();
}

document.querySelectorAll(".about-photo-card img").forEach((image) => {
  image.addEventListener("click", (event) => {
    openLightbox(image);
  });
});

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

if (!prefersReducedMotion.matches) {
  document.body.classList.add("js-ready");

  const revealTargets = [
    ...document.querySelectorAll(".about-media, .copy-block, .gallery-slider, .timeline-step, .contact-card"),
  ];

  revealTargets.forEach((element, index) => {
    const parent = element.closest(".feature-section, .contact-section, .timeline");
    const siblings = parent ? [...parent.children] : [...(element.parentElement?.children || [])];
    const siblingIndex = siblings.indexOf(element);
    const delayIndex = siblingIndex >= 0 ? siblingIndex : index;
    element.style.setProperty("--reveal-delay", `${Math.min(delayIndex * 90, 260)}ms`);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    document.querySelectorAll(".timeline-section").forEach((section) => {
      observer.observe(section);
    });

    revealTargets.forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll(".timeline-section").forEach((section) => {
      section.classList.add("is-visible");
    });

    revealTargets.forEach((element) => element.classList.add("is-visible"));
  }
}
