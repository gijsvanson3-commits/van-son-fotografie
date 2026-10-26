let scriptPromise;

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error('Botcontrole niet beschikbaar'));
    };
    const timer = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      if (!window.turnstile?.render) return fail();
      clearTimeout(timer);
      resolve(window.turnstile);
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export function createBotCheck({ container, getSession, onChange }) {
  const mount = container.querySelector('[data-bot-widget]');
  const status = container.querySelector('[data-bot-status]');
  const retry = container.querySelector('[data-bot-retry]');
  let config = null;
  let token = '';
  let visible = false;
  let widget;
  let generation = 0;

  function update(message, canRetry = false) {
    status.textContent = message;
    retry.hidden = !canRetry;
    onChange();
  }

  function remove() {
    generation++;
    token = '';
    if (widget !== undefined) {
      try { window.turnstile?.remove(widget); } catch { /* Verwijder ook een door de provider al opgeruimd widget. */ }
    }
    widget = undefined;
    mount.replaceChildren();
  }

  async function render() {
    const current = generation;
    update('Botcontrole laden…');
    try {
      const api = await loadTurnstile();
      if (!visible || !config || current !== generation) return;
      // De compacte variant past ook op een smal telefoonscherm.
      widget = api.render(mount, {
        sitekey: config.siteKey, action: config.action, cData: getSession().requestId,
        language: 'nl', theme: 'light', size: mount.clientWidth < 300 ? 'compact' : 'flexible',
        'response-field': false,
        callback: value => {
          if (current !== generation || !visible) return;
          token = value;
          update('Controle voltooid. Je kunt je aanvraag versturen.');
        },
        'expired-callback': () => {
          if (current !== generation) return;
          token = '';
          update('De controle is verlopen. Controleer opnieuw.', true);
        },
        'error-callback': () => {
          if (current !== generation) return;
          token = '';
          update('De botcontrole is niet gelukt. Probeer opnieuw of mail info@vansonfotografie.nl.', true);
        },
        'timeout-callback': () => {
          if (current !== generation) return;
          token = '';
          update('Rond de botcontrole opnieuw af.', true);
        },
      });
      if (!token) update('Rond de botcontrole af om je aanvraag te versturen.');
    } catch {
      if (current === generation && visible) update('De botcontrole kon niet laden. Probeer opnieuw of mail info@vansonfotografie.nl.', true);
    }
  }

  function reset() {
    remove();
    if (visible && config) void render();
    else onChange();
  }

  retry.addEventListener('click', reset);
  return {
    get required() { return Boolean(config); },
    get token() { return token; },
    configure(value) {
      config = value || null;
      container.hidden = !visible || !config;
      reset();
    },
    setVisible(value) {
      if (visible === value) return;
      visible = value;
      container.hidden = !visible || !config;
      reset();
    },
    reset,
    focus() { container.focus(); },
  };
}
