// Volledig-schermweergave voor alle links met data-lightbox.
// Pijltjestoetsen of vegen om te bladeren, Esc of klik naast de foto om te sluiten.
(() => {
  const lightbox = document.querySelector(".lightbox");
  const links = [...document.querySelectorAll("[data-lightbox]")];

  if (!lightbox || links.length === 0) {
    return;
  }

  const figure = lightbox.querySelector(".lightbox__figure");
  const image = lightbox.querySelector(".lightbox__image");
  const closeButton = lightbox.querySelector(".lightbox__close");
  const backdrop = lightbox.querySelector("[data-lightbox-close]");
  const prevButton = lightbox.querySelector(".lightbox__nav--prev");
  const nextButton = lightbox.querySelector(".lightbox__nav--next");
  const counter = lightbox.querySelector(".lightbox__counter");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const transitionMs = 260;
  const hasMultiple = links.length > 1;
  const swipeThreshold = 48;

  let index = -1;
  let opener = null;
  let closeTimer = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;

  lightbox.classList.toggle("lightbox--multi", hasMultiple);
  prevButton.hidden = !hasMultiple;
  nextButton.hidden = !hasMultiple;

  function preload(position) {
    const link = links[(position + links.length) % links.length];
    const preloadImage = new Image();
    preloadImage.src = link.href;
  }

  function show(position) {
    index = (position + links.length) % links.length;
    const link = links[index];
    const thumb = link.querySelector("img");

    image.src = link.href;
    image.alt = thumb?.alt || "";
    if (counter) {
      counter.textContent = hasMultiple ? `${index + 1} / ${links.length}` : "";
    }

    if (hasMultiple) {
      preload(index + 1);
      preload(index - 1);
    }
  }

  function open(position, link) {
    window.clearTimeout(closeTimer);
    opener = link;
    show(position);
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    lightbox.classList.remove("is-visible");
    window.requestAnimationFrame(() => lightbox.classList.add("is-visible"));
    closeButton.focus();
  }

  function close() {
    if (lightbox.hidden) {
      return;
    }

    lightbox.classList.remove("is-visible");
    lightbox.setAttribute("aria-hidden", "true");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      lightbox.hidden = true;
      image.src = "";
      image.alt = "";
      document.body.classList.remove("lightbox-open");
    }, reducedMotion.matches ? 0 : transitionMs);
    opener?.focus();
  }

  function move(step) {
    if (hasMultiple) {
      show(index + step);
    }
  }

  links.forEach((link, position) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      open(position, link);
    });
  });

  closeButton.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  prevButton.addEventListener("click", () => move(-1));
  nextButton.addEventListener("click", () => move(1));

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "Tab") {
      // Houd de focus binnen het volledige scherm.
      const focusable = [closeButton, prevButton, nextButton].filter((button) => !button.hidden);
      const current = focusable.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (current - 1 + focusable.length) % focusable.length
        : (current + 1) % focusable.length;
      event.preventDefault();
      focusable[nextIndex].focus();
    }
  });

  function resetDrag() {
    pointerId = null;
    deltaX = 0;
    deltaY = 0;
    figure.classList.remove("is-dragging");
  }

  figure.addEventListener("pointerdown", (event) => {
    if (!hasMultiple || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    deltaX = 0;
    deltaY = 0;
    figure.classList.add("is-dragging");
    figure.setPointerCapture?.(event.pointerId);
  });

  figure.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }

    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
  });

  figure.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }

    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX < 0 ? 1 : -1);
    }

    resetDrag();
  });

  figure.addEventListener("pointercancel", resetDrag);
  figure.addEventListener("dragstart", (event) => event.preventDefault());
})();
