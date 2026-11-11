// Kunstmuur: de lijsten hangen vrij op de muur, maximaal twee rijen hoog.
// Past een lijst niet meer in twee rijen, dan komt hij op een volgende wand.
// Met de pijlen (of swipen / pijltjestoetsen) loop je langs de wanden.
(function () {
  const MAX_ROWS = 2;
  const gallery = document.querySelector(".kunst-gallery");
  const wall = gallery?.querySelector(".kunst-wall");
  if (!wall) return;

  const prev = gallery.querySelector(".kunst-nav--prev");
  const next = gallery.querySelector(".kunst-nav--next");
  const pieces = [...wall.querySelectorAll(".kunst-piece")];
  let panels = [];
  let lastWidth = 0;

  // Lijsten op dezelfde rij hangen verticaal gecentreerd en hebben dus een andere bovenkant;
  // een nieuwe rij begint pas als een lijst helemaal onder de vorige rij hangt.
  function rowCount(panel) {
    const boxes = [...panel.children]
      .map((piece) => ({ top: piece.offsetTop, bottom: piece.offsetTop + piece.offsetHeight }))
      .sort((a, b) => a.top - b.top);
    let rows = 0;
    let rowBottom = -Infinity;
    boxes.forEach((box) => {
      if (box.top >= rowBottom) {
        rows += 1;
        rowBottom = box.bottom;
      } else {
        rowBottom = Math.max(rowBottom, box.bottom);
      }
    });
    return rows;
  }

  // Verdeel de lijsten over wanden: vul een wand tot er een derde rij zou ontstaan.
  function layout() {
    if (wall.clientWidth === lastWidth && panels.length) return;
    lastWidth = wall.clientWidth;

    wall.classList.add("is-paged");
    wall.replaceChildren();
    panels = [];

    let panel = null;
    pieces.forEach((piece) => {
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "kunst-panel";
        wall.append(panel);
        panels.push(panel);
      }
      panel.append(piece);
      if (panel.children.length > 1 && rowCount(panel) > MAX_ROWS) {
        panel = document.createElement("div");
        panel.className = "kunst-panel";
        wall.append(panel);
        panels.push(panel);
        panel.append(piece);
      }
    });

    wall.scrollLeft = 0;
    update();
  }

  function currentIndex() {
    return Math.round(wall.scrollLeft / wall.clientWidth);
  }

  function goTo(index) {
    const target = Math.max(0, Math.min(panels.length - 1, index));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wall.scrollTo({ left: target * wall.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  function update() {
    const paged = panels.length > 1;
    prev.hidden = !paged;
    next.hidden = !paged;
    const index = currentIndex();
    prev.disabled = index <= 0;
    next.disabled = index >= panels.length - 1;
  }

  prev.addEventListener("click", () => goTo(currentIndex() - 1));
  next.addEventListener("click", () => goTo(currentIndex() + 1));

  wall.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(currentIndex() - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(currentIndex() + 1);
    }
  });

  wall.addEventListener("scroll", update, { passive: true });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  layout();
})();
