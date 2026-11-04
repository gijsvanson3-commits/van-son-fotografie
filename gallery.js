// Filter de series op de galerijpagina op categorie (?categorie=... in de URL blijft bewaard).
(() => {
  const buttons = [...document.querySelectorAll("[data-filter]")];
  const cards = [...document.querySelectorAll("[data-serie-card]")];
  const emptyState = document.querySelector("[data-gallery-empty]");

  if (buttons.length === 0 || cards.length === 0) {
    return;
  }

  const known = new Set(buttons.map((button) => button.dataset.filter));

  function apply(filter, updateUrl = true) {
    const active = known.has(filter) ? filter : "all";

    cards.forEach((card) => {
      card.hidden = active !== "all" && card.dataset.category !== active;
    });

    buttons.forEach((button) => {
      const isActive = button.dataset.filter === active;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (emptyState) {
      emptyState.hidden = cards.some((card) => !card.hidden);
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (active === "all") {
        url.searchParams.delete("categorie");
      } else {
        url.searchParams.set("categorie", active);
      }
      window.history.replaceState(null, "", url);
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => apply(button.dataset.filter));
  });

  apply(new URLSearchParams(window.location.search).get("categorie") || "all", false);
})();
