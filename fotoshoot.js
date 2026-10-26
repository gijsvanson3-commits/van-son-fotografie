import { createBotCheck } from './fotoshoot-turnstile.js';
import { calculatePrice, formatMoney, getPackages, getPackageUpgrade } from './fotoshoot-model.js';
import { bindDatePickers, dateField, parseDate, formatDate, validateDateInput } from './fotoshoot-calendar.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const workspace = $('#shoot-workspace');
const form = $('#shoot-form');
const panels = $('#shoot-panels');
const errors = $('#shoot-errors');
const next = $('#shoot-next');
const prev = $('#shoot-prev');
const steps = { private: ['type', 'package', 'details', 'review'], business: ['brief', 'details', 'review'] };
const titles = { type: 'Fotografie', package: 'Jouw pakket', brief: 'Jouw opdracht', details: 'Jouw gegevens', review: 'Controleren' };
let config;
let session;
let route = null;
let step = 0;
let sending = false;
let completed = false;
let datePickers;
let botCheck;

function updateSubmitState() {
  const reviewing = route && steps[route][step] === 'review';
  next.disabled = sending || Boolean(reviewing && botCheck?.required && !botCheck.token);
}
const money = cents => formatMoney(cents, config.currency);
const selected = name => form.querySelector(`[name="${name}"]:checked`)?.value || '';
const value = name => {
  const input = form.elements.namedItem(name);
  const raw = input?.value.trim() || '';
  return input?.hasAttribute('data-date-input') ? parseDate(raw) || raw : raw;
};
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());

function field(name, label, type = 'text', options = {}) {
  const { required = true, max = 200, wide = false, autocomplete = '', hint = '', min = '' } = options;
  const id = `shoot-${name}`;
  const attributes = `id="${id}" name="${name}" ${required ? 'required' : ''} aria-describedby="${id}-hint ${id}-error"`;
  let input;
  if (type === 'date') input = dateField({ id, name, label, required, min, describedBy: `${id}-hint ${id}-error` });
  else if (type === 'textarea') input = `<textarea ${attributes} maxlength="${max}" rows="3"></textarea>`;
  else input = `<input ${attributes} type="${type}" ${['text', 'email', 'tel'].includes(type) ? `maxlength="${max}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${min ? `min="${min}"` : ''} ${type === 'number' ? `max="10000000" step="1"` : ''}>`;
  return `<div class="shoot-field ${wide ? 'shoot-field--wide' : ''}"><label for="${id}">${escape(label)}${required ? ' *' : ' (optioneel)'}</label>${input}<small id="${id}-hint">${escape(hint || (type === 'date' ? 'Kies een datum of typ dd-mm-jjjj.' : ''))}</small><span class="shoot-field-error" id="${id}-error"></span></div>`;
}

function choice(name, id, label, description = '', type = 'radio') {
  return `<label class="shoot-choice"><input type="${type}" name="${name}" value="${escape(id)}" ${type === 'radio' ? 'required' : ''}><span><strong>${escape(label)}</strong>${description ? `<small>${escape(description)}</small>` : ''}</span></label>`;
}

function panel(id, title, content) {
  return `<fieldset class="shoot-panel" data-panel="${id}" hidden disabled><legend tabindex="-1">${title}</legend>${content}</fieldset>`;
}

function render() {
  $('#shoot-summary').innerHTML = `<p class="shoot-kicker">Speciaal voor jou</p><h3>Jouw fotoshoot</h3><div id="shoot-summary-details"></div><p class="shoot-total"><span>Totale prijsindicatie</span><strong id="shoot-summary-price" role="status" aria-live="polite" aria-atomic="true">—</strong></p><p class="shoot-travel-note">${escape(config.travelNotice)}</p><p class="shoot-note">${escape(config.taxNotice)}</p><p class="shoot-note">${escape(config.priceNotice)}</p>`;
  panels.innerHTML = panel('type', 'Welke fotografie past bij jou?', `<p>Een shoot voor jou of voor jullie samen.</p><div class="shoot-choices">${config.photography.map(item => `<label class="shoot-choice"><input type="radio" name="photography" value="${escape(item.id)}" required><span>${item.image ? `<img src="${escape(item.image)}" alt="${escape(item.alt)}" loading="lazy" width="480" height="160">` : ''}<strong>${escape(item.label)}</strong><small>${escape(item.description)}</small></span></label>`).join('')}</div><p class="shoot-note">Wil je een evenement laten vastleggen? Kies dan bovenaan voor zakelijke fotografie of evenementen.</p><p class="shoot-note">Voor een ander idee kun je <a href="mailto:info@vansonfotografie.nl">mij rechtstreeks mailen</a>.</p>`)
    + panel('package', 'Kies jouw fotoshoot', `<p>Kies het pakket dat bij jouw wensen past.</p><div class="shoot-choices" id="shoot-package-choices"></div><div class="shoot-package-explanation"><p class="shoot-note"><strong>Wat betekent professioneel nabewerkt?</strong><br>${escape(config.editingNotice)}</p><p class="shoot-note">${escape(config.retouchNotice)}</p></div><p class="shoot-note" id="shoot-standard-delivery">${escape(config.standardDeliveryNotice)}</p><div class="shoot-field"><label for="shoot-extraPhotos">Extra professioneel nabewerkte foto's · ${money(config.extras.photoPriceCents)} per foto</label><input type="number" id="shoot-extraPhotos" name="extraPhotos" value="0" min="0" max="${config.extras.maxExtraPhotos}" step="1" required aria-describedby="shoot-extraPhotos-error"><span class="shoot-field-error" id="shoot-extraPhotos-error"></span></div><label class="shoot-inline"><input type="checkbox" name="rush"> Spoedlevering · +${money(config.extras.rushPriceCents)}</label><p class="shoot-note">${escape(config.rushNotice)}</p><p class="shoot-total shoot-package-total"><span>Jouw prijsindicatie</span><strong id="shoot-package-price">—</strong></p>`)
    + panel('brief', 'Vertel me over jouw opdracht', `<p>Iedere opdracht is uniek. Vertel me wat je zoekt, dan maak ik een persoonlijk voorstel dat aansluit op jouw wensen.</p><div class="shoot-field"><label for="shoot-category">Wat wil je laten fotograferen? *</label><select id="shoot-category" name="category" required aria-describedby="shoot-category-error"><option value="">Kies het type opdracht</option>${config.business.map(item => `<option value="${escape(item.id)}">${escape(item.label)}</option>`).join('')}</select><span class="shoot-field-error" id="shoot-category-error"></span></div><fieldset class="shoot-group" data-category="evenement" hidden disabled><legend>Jouw evenement</legend><fieldset class="shoot-group"><legend>Ik ben op zoek naar: *</legend>${config.eventCoverage.map((label, index) => choice('coverage', String(index), label)).join('')}</fieldset><div class="shoot-fields">${field('eventName', 'Naam van het evenement', 'text', { wide: true })}${field('eventDate', 'Datum van het evenement', 'date', { min: today() })}${field('visitors', 'Verwacht aantal bezoekers', 'number', { min: '1' })}${field('eventLocation', 'Locatie', 'text', { wide: true, hint: 'Bijvoorbeeld een plaats en de naam van de locatie.' })}${field('startTime', 'Gewenste begintijd fotografie', 'time')}${field('endTime', 'Gewenste eindtijd fotografie', 'time')}${field('endDate', 'Einddatum fotografie', 'date', { min: today(), hint: 'Ook bij fotografie die doorloopt na middernacht.', wide: true })}${field('eventWishes', 'Aanvullende wensen voor het evenement', 'textarea', { required: false, max: 3000, wide: true })}</div></fieldset><fieldset class="shoot-group" data-category="horeca" hidden disabled><legend>Wat wil je laten fotograferen? * (meerdere keuzes mogelijk)</legend>${config.hospitalitySubjects.map((label, index) => choice('subjects', String(index), label, '', 'checkbox')).join('')}</fieldset><fieldset class="shoot-group" data-category="other" hidden disabled><legend>Meer over jouw opdracht</legend><div class="shoot-fields">${field('subject', 'Wat wil je laten fotograferen?', 'textarea', { max: 3000, wide: true })}${field('scope', 'De geschatte omvang', 'text', { wide: true })}${field('period', 'Gewenste datum of periode', 'text', { hint: 'Een concrete datum, een periode of in overleg.' })}${field('businessLocation', 'Locatie')}${field('usage', "Waarvoor worden de foto's gebruikt?", 'textarea', { max: 1500, wide: true, hint: 'Bijvoorbeeld website, social media, drukwerk of advertenties.' })}${field('businessWishes', 'Specifieke wensen', 'textarea', { max: 3000, wide: true, required: false })}</div></fieldset>`)
    + panel('details', 'Hoe kan ik je bereiken?', `<p>Velden met een * zijn verplicht. Ik gebruik je gegevens om jouw aanvraag te beantwoorden.</p><div class="shoot-fields">${field('name', 'Naam', 'text', { autocomplete: 'name' })}<div id="shoot-company-wrap">${field('company', 'Bedrijfsnaam', 'text', { required: false, autocomplete: 'organization' })}</div>${field('email', 'E-mailadres', 'email', { max: 254, autocomplete: 'email' })}${field('phone', 'Telefoonnummer', 'tel', { required: false, max: 40, autocomplete: 'tel' })}</div><fieldset class="shoot-group" id="shoot-private-details"><legend>Jouw gewenste moment</legend><div class="shoot-fields">${field('date', 'Gewenste datum', 'date', { min: today() })}${field('location', 'Gewenste locatie', 'text', { hint: 'Een plaats, locatie of samen in overleg.' })}</div></fieldset>${field('comments', 'Aanvullende opmerkingen', 'textarea', { required: false, max: 3000, wide: true })}`)
    + panel('review', 'Alles naar wens?', `<p>Controleer je aanvraag. Met ‘Terug’ kun je je antwoorden aanpassen.</p><div id="shoot-review"></div><p class="shoot-note">Je gegevens worden alleen gebruikt voor je aanvraag en het persoonlijke contact daarover. Ze worden per e-mail verzonden en niet in deze browser opgeslagen.</p>`);
}

function renderPackages() {
  const packages = getPackages(config, selected('photography'));
  const previous = selected('package');
  $('#shoot-package-choices').innerHTML = packages.map(pack => {
    const upgrade = getPackageUpgrade(packages, pack);
    return `<label class="shoot-choice ${pack.badge ? 'shoot-choice--featured' : ''}"><input type="radio" name="package" value="${escape(pack.id)}" required ${pack.id === previous ? 'checked' : ''}><span><span class="shoot-price">${money(pack.priceCents)}</span>${pack.badge ? `<span class="shoot-package-badge">${escape(pack.badge)}</span>` : ''}<strong>${escape(pack.label)}</strong><small>${pack.minutes} minuten fotografie<br>${escape(pack.selection)}<br>${pack.photos} professioneel nabewerkte foto's naar keuze<br>${escape(pack.delivery)}<br>Extra foto's bij te bestellen</small>${upgrade ? `<small class="shoot-package-upgrade">Voor ${money(upgrade.extraCents)} extra krijg je ${upgrade.extraPhotos} extra professioneel nabewerkte foto's.</small>` : ''}</span></label>`;
  }).join('');
}

function selection() {
  return { photography: selected('photography'), package: selected('package'), extraPhotos: Number(form.elements.extraPhotos.value), rush: form.elements.rush.checked };
}

function businessData() {
  const category = value('category');
  if (category === 'evenement') return { category, coverage: selected('coverage'), eventName: value('eventName'), eventDate: value('eventDate'), visitors: value('visitors'), eventLocation: value('eventLocation'), startTime: value('startTime'), endTime: value('endTime'), endDate: value('endDate'), eventWishes: value('eventWishes') };
  return { category, subject: value('subject'), scope: value('scope'), period: value('period'), businessLocation: value('businessLocation'), usage: value('usage'), businessWishes: value('businessWishes'), ...(category === 'horeca' ? { subjects: [...form.querySelectorAll('[name="subjects"]:checked')].map(input => input.value) } : {}) };
}

function contactData() {
  return { name: value('name'), email: value('email'), phone: value('phone'), comments: value('comments'), ...(route === 'business' ? { company: value('company') } : { date: value('date'), location: value('location') }) };
}

function details(rows, review = false) {
  return `<dl class="shoot-details ${review ? 'shoot-details--review' : ''}">${rows.filter(([, val]) => val !== undefined && val !== '').map(([label, val]) => `<div><dt>${escape(label)}</dt><dd>${escape(val)}</dd></div>`).join('')}</dl>`;
}

function privateRows() {
  const chosen = selection();
  const quote = calculatePrice(config, chosen);
  return [
    ['Fotografie', config.photography.find(item => item.id === chosen.photography)?.label || 'Nog te kiezen'],
    ['Pakket', quote ? quote.package.label : 'Nog te kiezen'],
    ['Fotografieduur', quote ? `${quote.package.minutes} minuten` : '—'],
    ['Oplevering', quote ? quote.package.delivery : '—'],
    ['Inbegrepen foto’s', quote ? `${quote.package.photos} naar keuze` : '—'],
    ['Extra foto’s', quote ? `${chosen.extraPhotos} · ${money(quote.extraCents)}` : '—'],
    ['Spoedlevering', quote ? (chosen.rush ? money(quote.rushCents) : 'Nee') : '—'],
    ['Totaal aantal foto’s', quote ? String(quote.totalPhotos) : '—']
  ];
}

function updateSummary() {
  if (route !== 'private') return;
  const quote = calculatePrice(config, selection());
  $('#shoot-summary-details').innerHTML = details(privateRows());
  $('#shoot-summary-price').textContent = quote ? money(quote.totalCents) : '—';
  $('#shoot-package-price').textContent = quote ? money(quote.totalCents) : '—';
}

function updateCategory() {
  const category = value('category');
  for (const group of form.querySelectorAll('[data-category]')) {
    const show = !!category && (group.dataset.category === category || (group.dataset.category === 'other' && category !== 'evenement'));
    group.hidden = !show;
    group.disabled = !show;
  }
  const selectedCategory = config.business.find(item => item.id === category);
  if (selectedCategory?.subjectLabel) {
    form.querySelector('[for="shoot-subject"]').textContent = `${selectedCategory.subjectLabel} *`;
    form.querySelector('[for="shoot-scope"]').textContent = `${selectedCategory.scopeLabel} *`;
  }
}

function renderReview() {
  const contact = contactData();
  const contactRows = [['Naam', contact.name], ['Bedrijfsnaam', contact.company], ['E-mailadres', contact.email], ['Telefoonnummer', contact.phone || 'Niet ingevuld'], ['Gewenste datum', contact.date], ['Gewenste locatie', contact.location], ['Aanvullende opmerkingen', contact.comments || 'Geen']];
  let rows;
  if (route === 'private') {
    const quote = calculatePrice(config, selection());
    rows = [...privateRows(), ['Fotokeuze', quote?.package.selection], ['Levertijd', selection().rush ? config.rushNotice : config.standardDeliveryNotice], ['Totale prijsindicatie', quote ? money(quote.totalCents) : '—'], ['Reiskosten', config.travelNotice], ['Prijsafspraak', config.priceNotice], ['Btw', config.taxNotice]];
  } else {
    const data = businessData();
    rows = [['Type opdracht', config.business.find(item => item.id === data.category)?.label]];
    if (data.category === 'evenement') rows.push(['Ik ben op zoek naar', config.eventCoverage[Number(data.coverage)]], ['Naam evenement', data.eventName], ['Datum evenement', data.eventDate], ['Locatie', data.eventLocation], ['Verwacht aantal bezoekers', data.visitors], ['Begin fotografie', `${data.eventDate} ${data.startTime}`], ['Einde fotografie', `${data.endDate} ${data.endTime}`], ['Aanvullende wensen', data.eventWishes || 'Geen']);
    else {
      if (data.category === 'horeca') rows.push(['Onderwerpen', data.subjects.map(id => config.hospitalitySubjects[Number(id)]).join(', ')]);
      rows.push(['Wat wil je laten fotograferen', data.subject], ['Geschatte omvang', data.scope], ['Datum of periode', data.period], ['Locatie', data.businessLocation], ['Gebruik van de foto’s', data.usage], ['Specifieke wensen', data.businessWishes || 'Geen']);
    }
  }
  $('#shoot-review').innerHTML = `<section class="shoot-review-block"><h3>${route === 'private' ? 'Jouw fotoshoot' : 'Jouw opdracht'}</h3>${details(rows, true)}</section><section class="shoot-review-block"><h3>Jouw gegevens</h3>${details(contactRows, true)}</section>`;
}

function clearErrors() {
  errors.hidden = true;
  errors.replaceChildren();
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
  for (const message of form.querySelectorAll('.shoot-field-error')) message.textContent = '';
}

function showErrors(messages) {
  errors.innerHTML = `<strong>Controleer je aanvraag</strong><ul>${messages.map(message => `<li>${escape(message)}</li>`).join('')}</ul>`;
  errors.hidden = false;
  errors.focus();
}

function validatePanel(id) {
  const active = form.querySelector(`[data-panel="${id}"]`);
  const messages = [];
  const seenRadios = new Set();
  for (const input of active.querySelectorAll('input, select, textarea')) {
    if (input.matches(':disabled')) continue;
    input.setCustomValidity('');
    if (input.hasAttribute('data-date-input')) validateDateInput(input, today());
    if (input.name === 'phone' && input.value.trim() && !/^\+?[0-9 ().-]{6,40}$/.test(input.value.trim())) input.setCustomValidity('Vul een geldig telefoonnummer in of laat het veld leeg.');
    if (['text', 'textarea'].includes(input.type) && input.required && !input.value.trim()) input.setCustomValidity('Vul dit veld in.');
    if (!input.checkValidity()) {
      if (input.type === 'radio' && seenRadios.has(input.name)) continue;
      seenRadios.add(input.name);
      const label = input.type === 'radio' ? (input.name === 'photography' ? 'Type fotografie' : input.name === 'package' ? 'Pakket' : 'Ik ben op zoek naar') : form.querySelector(`label[for="${input.id}"]`)?.textContent.replace(/ \*$/, '') || 'Keuze';
      const message = `${label}: ${input.validationMessage}`;
      input.setAttribute('aria-invalid', 'true');
      const inline = document.getElementById(`${input.id}-error`);
      if (inline) inline.textContent = input.validationMessage;
      messages.push(message);
    }
  }
  if (id === 'brief' && value('category') === 'horeca' && !form.querySelector('[name="subjects"]:checked')) messages.push('Kies minimaal één onderwerp voor de horecafotografie.');
  if (id === 'brief' && value('category') === 'evenement') {
    const start = `${value('eventDate')}T${value('startTime')}`;
    const end = `${value('endDate')}T${value('endTime')}`;
    if (value('endDate') && value('startTime') && value('endTime') && end <= start) messages.push('De einddatum en eindtijd van de fotografie moeten na de begintijd liggen.');
    if (value('endDate') < value('eventDate')) messages.push('De einddatum kan niet vóór de datum van het evenement liggen.');
  }
  if (messages.length) showErrors(messages);
  return messages.length === 0;
}

function displayStep(focus = true) {
  datePickers?.close();
  clearErrors();
  const list = steps[route];
  const active = list[step];
  $('#shoot-progress').innerHTML = list.map((id, index) => `<li ${index === step ? 'aria-current="step"' : ''} class="${index < step ? 'is-complete' : ''}">${titles[id]}</li>`).join('');
  for (const element of panels.children) {
    element.hidden = element.dataset.panel !== active;
    element.disabled = element.hidden;
  }
  const isPrivate = route === 'private';
  $('#shoot-private-details').hidden = !isPrivate;
  $('#shoot-private-details').disabled = !isPrivate;
  $('#shoot-company-wrap').hidden = isPrivate;
  form.elements.company.disabled = isPrivate;
  const showSummary = isPrivate && active !== 'review';
  $('#shoot-summary').hidden = !showSummary;
  $('.shoot-layout').classList.toggle('has-summary', showSummary);
  $('#shoot-booking-note').hidden = isPrivate;
  updateCategory();
  if (active === 'package') renderPackages();
  updateSummary();
  if (active === 'review') renderReview();
  next.textContent = active === 'review' ? (isPrivate ? 'Verstuur mijn fotoshootaanvraag' : 'Verstuur mijn offerteaanvraag') : 'Verder';
  prev.textContent = 'Terug';
  botCheck?.setVisible(active === 'review');
  updateSubmitState();
  if (focus) panels.querySelector(`[data-panel="${active}"] > legend`).focus();
}

async function bootstrap() {
  const response = await fetch('/api/fotoshoot.php', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Configuratie niet beschikbaar');
  const data = await response.json();
  if (!data.config?.packages || !data.csrfToken || !data.requestId) throw new Error('Ongeldige configuratie');
  return data;
}

async function submit() {
  if (sending || completed) return;
  clearErrors();
  // Ook eerdere stappen opnieuw controleren; bijvoorbeeld een inmiddels verstreken datum.
  for (let index = 0; index < steps[route].length - 1; index++) {
    const element = form.querySelector(`[data-panel="${steps[route][index]}"]`);
    element.disabled = false;
    const valid = validatePanel(steps[route][index]);
    element.disabled = true;
    if (!valid) {
      step = index;
      displayStep();
      validatePanel(steps[route][index]);
      return;
    }
  }
  if (botCheck?.required && !botCheck.token) { botCheck.focus(); return; }
  const quote = route === 'private' ? calculatePrice(config, selection()) : null;
  const payload = { route, contact: contactData(), ...(route === 'private' ? { selection: selection(), expectedTotalCents: quote?.totalCents } : { brief: businessData() }), configVersion: session.configVersion, csrfToken: session.csrfToken, requestId: session.requestId, website: value('website'), ...(botCheck?.required ? { turnstileToken: botCheck.token } : {}) };
  sending = true;
  next.disabled = true;
  prev.disabled = true;
  form.setAttribute('aria-busy', 'true');
  document.querySelectorAll('[data-route]').forEach(button => { button.disabled = true; });
  next.textContent = 'Bezig met versturen…';
  try {
    const response = await fetch('/api/fotoshoot.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) {
      if (response.status === 403) {
        session = await bootstrap();
        botCheck.configure(session.captcha);
        throw new Error('Je sessie is vernieuwd. Je keuzes zijn bewaard; controleer je aanvraag en verstuur deze opnieuw.');
      }
      if (result.code === 'captcha' && !botCheck.required) {
        // Ook een formulier dat al openstond toen de controle werd geactiveerd moet die tonen.
        try { session = await bootstrap(); botCheck.configure(session.captcha); } catch { /* Toon de oorspronkelijke verzendfout. */ }
      }
      throw new Error(result.message || 'Versturen is niet gelukt. Probeer het nogmaals of mail info@vansonfotografie.nl.');
    }
    completed = true;
    botCheck.setVisible(false);
    workspace.hidden = true;
    $('#shoot-routes').hidden = true;
    $('#shoot-success').hidden = false;
    $('#shoot-success-title').focus();
    // Geen persoonsgegevens achterlaten in verborgen formuliervelden na verzending.
    form.reset();
    $('#shoot-review').replaceChildren();
  } catch (error) {
    showErrors([error.message || 'Geen verbinding. Je keuzes zijn bewaard. Probeer opnieuw of mail info@vansonfotografie.nl.']);
  } finally {
    sending = false;
    if (!completed) botCheck.reset();
    updateSubmitState();
    prev.disabled = false;
    form.removeAttribute('aria-busy');
    document.querySelectorAll('[data-route]').forEach(button => { button.disabled = false; });
    next.textContent = route === 'private' ? 'Verstuur mijn fotoshootaanvraag' : 'Verstuur mijn offerteaanvraag';
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!route || sending || completed) return;
  clearErrors();
  const active = steps[route][step];
  if (active === 'review') { void submit(); return; }
  if (validatePanel(active)) { step++; displayStep(); }
});
prev.addEventListener('click', () => {
  if (step > 0) { step--; displayStep(); }
  else {
    workspace.hidden = true;
    botCheck?.setVisible(false);
    document.querySelector(`[data-route="${route}"]`).focus();
    document.querySelectorAll('[data-route]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    route = null;
  }
});
form.addEventListener('input', event => {
  event.target.setCustomValidity?.('');
  event.target.removeAttribute('aria-invalid');
  if (event.target.name === 'eventDate') {
    const date = parseDate(form.elements.eventDate.value);
    form.elements.endDate.dataset.dateMin = date || today();
    if (date && (!parseDate(form.elements.endDate.value) || value('endDate') < date)) form.elements.endDate.value = formatDate(date);
  }
  if (route === 'private') updateSummary();
});
form.addEventListener('change', event => {
  if (event.target.name === 'category') updateCategory();
  if (event.target.name === 'photography') { renderPackages(); updateSummary(); }
});
document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => {
  if (sending || completed) return;
  route = button.dataset.route;
  step = 0;
  workspace.hidden = false;
  document.querySelectorAll('[data-route]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  displayStep();
  workspace.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}));

try {
  session = await bootstrap();
  config = session.config;
  render();
  botCheck = createBotCheck({ container: $('#shoot-bot-check'), getSession: () => session, onChange: updateSubmitState });
  botCheck.configure(session.captcha);
  datePickers = bindDatePickers(form, today);
  $('#shoot-routes').hidden = false;
  route = 'private';
  workspace.hidden = false;
  document.querySelector('[data-route="private"]').setAttribute('aria-pressed', 'true');
  displayStep(false);
} catch {
  $('#shoot-init-error').hidden = false;
} finally {
  $('#shoot-loading').hidden = true;
}
