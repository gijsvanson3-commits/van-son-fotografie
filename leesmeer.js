// "Lees meer": de tekst staat volledig in de HTML (goed voor Google en zonder JavaScript),
// maar wordt ingeklapt tot iemand op de knop klikt. Openen en sluiten schuift soepel.
(function () {
  const supportsUntilFound = "onbeforematch" in document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DURATION = 520;
  const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

  document.querySelectorAll("[data-lees-meer]").forEach((button) => {
    const target = document.getElementById(button.getAttribute("aria-controls"));
    if (!target) return;
    const label = button.querySelector("[data-lees-meer-label]") || button;
    const closedText = label.textContent;
    let animation = null;

    function hide() {
      // "until-found": zoeken met Ctrl+F vindt de ingeklapte tekst nog steeds.
      target.setAttribute("hidden", supportsUntilFound ? "until-found" : "");
    }

    function setState(open) {
      button.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Lees minder" : closedText;
    }

    function animate(open) {
      if (animation) animation.cancel();
      const from = target.getBoundingClientRect().height;
      setState(open);
      // Open: rand en ruimte direct aan, zodat de hoogte klopt. Dicht: pas na het inschuiven weg.
      if (open) target.classList.add("is-open");
      target.removeAttribute("hidden");
      const to = open ? target.scrollHeight : 0;

      if (reduceMotion.matches || !target.animate) {
        if (!open) {
          target.classList.remove("is-open");
          hide();
        }
        return;
      }

      // Rand, binnenruimte en marge schuiven mee, zodat er aan het eind niets verspringt.
      const cs = getComputedStyle(target);
      const box = { paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom };
      const flat = { paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px" };
      target.style.overflow = "hidden";
      animation = target.animate(
        [
          { height: `${from}px`, opacity: open ? 0 : 1, ...(open ? flat : box) },
          { height: `${to}px`, opacity: open ? 1 : 0, ...(open ? box : flat) },
        ],
        { duration: DURATION, easing: EASING }
      );
      // Afronden zodra de animatie klaar is; de timer is een vangnet voor tabbladen op de achtergrond.
      const current = animation;
      const finish = () => {
        if (animation !== current) return;
        animation = null;
        if (current.playState !== "finished") current.cancel();
        target.style.overflow = "";
        if (!open) {
          target.classList.remove("is-open");
          hide();
        }
      };
      current.finished.then(finish, () => {});
      setTimeout(finish, DURATION + 80);
    }

    setState(false);
    hide();
    button.hidden = false;

    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      animate(open);
      if (!open) button.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    target.addEventListener("beforematch", () => {
      setState(true);
      target.classList.add("is-open");
    });
  });
})();
