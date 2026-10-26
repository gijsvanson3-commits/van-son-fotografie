const pad = value => String(value).padStart(2, '0');
const isoFromDate = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const utcDate = iso => new Date(`${iso}T12:00:00Z`);
const months = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
const weekdays = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const dateLabel = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full', timeZone: 'UTC' });

export function parseDate(value) {
  const raw = String(value).trim();
  let iso = raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return '';
    iso = `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  }
  const date = utcDate(iso);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1000 && isoFromDate(date) === iso ? iso : '';
}

export function formatDate(value) {
  const iso = parseDate(value);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
}

export function validateDateInput(input, today) {
  const raw = input.value.trim();
  const iso = parseDate(raw);
  const minimum = input.dataset.dateMin > today ? input.dataset.dateMin : today;
  if (raw && !iso) input.setCustomValidity('Vul een geldige datum in als dd-mm-jjjj, of kies een datum in de kalender.');
  else if (iso && iso < minimum) input.setCustomValidity(`Kies ${formatDate(minimum)} of een latere datum.`);
}

export function dateField({ id, name, label, required, min, describedBy }) {
  // id, naam en label zijn vaste ontwikkelaarswaarden uit het formulier, geen bezoekersinvoer.
  return `<div class="shoot-date"><div class="shoot-date__control"><input id="${id}" name="${name}" type="text" data-date-input data-date-min="${min}" ${required ? 'required' : ''} aria-describedby="${describedBy}" placeholder="dd-mm-jjjj" inputmode="numeric" autocomplete="off" maxlength="10"><button class="shoot-date__toggle" type="button" aria-label="Open kalender voor ${label}" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}-calendar"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3v5M16.5 3v5M3.5 11h17M8 15h1M12 15h1M16 15h1"/></svg></button></div><div id="${id}-calendar" class="shoot-calendar" role="dialog" aria-label="Kalender: ${label}" hidden></div></div>`;
}

export function bindDatePickers(root, getToday) {
  let active = null;
  const close = (restoreFocus = false) => {
    if (!active) return;
    const { popup, toggle } = active;
    popup.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    active = null;
    if (restoreFocus) toggle.focus();
  };
  const inputs = root.querySelectorAll('[data-date-input]');
  for (const input of inputs) {
    const wrapper = input.closest('.shoot-date');
    const toggle = wrapper.querySelector('.shoot-date__toggle');
    const popup = wrapper.querySelector('.shoot-calendar');
    let month;
    let focusedDate;
    const minimum = () => input.dataset.dateMin > getToday() ? input.dataset.dateMin : getToday();
    const firstOfMonth = iso => `${iso.slice(0, 7)}-01`;
    const choose = iso => {
      input.value = formatDate(iso);
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close(true);
    };
    const render = (focus = false, control = '') => {
      const min = minimum();
      const chosen = parseDate(input.value);
      const year = month.getUTCFullYear();
      const monthIndex = month.getUTCMonth();
      const monthIso = isoFromDate(month);
      const days = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
      const offset = (month.getUTCDay() + 6) % 7;
      const minYear = Number(min.slice(0, 4));
      const titleId = `${input.id}-month-title`;
      const selectedMonth = monthIso.slice(0, 7);
      let tabDate = focusedDate;
      if (!tabDate || tabDate.slice(0, 7) !== selectedMonth || tabDate < min) {
        tabDate = chosen?.slice(0, 7) === selectedMonth && chosen >= min ? chosen : (min.slice(0, 7) === selectedMonth ? min : monthIso);
      }
      focusedDate = tabDate;
      popup.innerHTML = `<div class="shoot-calendar__top"><button type="button" class="shoot-calendar__arrow" data-direction="-1" aria-label="Vorige maand" ${selectedMonth <= min.slice(0, 7) ? 'disabled' : ''}>←</button><p id="${titleId}" aria-live="polite" aria-atomic="true">${months[monthIndex]} ${year}</p><button type="button" class="shoot-calendar__arrow" data-direction="1" aria-label="Volgende maand" ${year === 9999 && monthIndex === 11 ? 'disabled' : ''}>→</button></div><div class="shoot-calendar__selects"><label><span class="sun-nav__sr">Maand</span><select data-month aria-label="Maand">${months.map((name, index) => `<option value="${index}" ${index === monthIndex ? 'selected' : ''} ${year === minYear && index < Number(min.slice(5, 7)) - 1 ? 'disabled' : ''}>${name}</option>`).join('')}</select></label><label><span class="sun-nav__sr">Jaar</span><select data-year aria-label="Jaar">${Array.from({ length: Math.min(9999, Math.max(minYear + 100, year)) - minYear + 1 }, (_, index) => minYear + index).map(number => `<option value="${number}" ${number === year ? 'selected' : ''}>${number}</option>`).join('')}</select></label></div><div class="shoot-calendar__grid" role="grid" aria-labelledby="${titleId}"><div role="row">${weekdays.map(name => `<span role="columnheader" aria-label="${name}">${name.slice(0, 2).toLowerCase()}</span>`).join('')}</div>${Array.from({ length: Math.ceil((days + offset) / 7) }, (_, row) => `<div role="row">${Array.from({ length: 7 }, (_, column) => {
        const day = row * 7 + column - offset + 1;
        if (day < 1 || day > days) return '<span role="gridcell" aria-disabled="true"></span>';
        const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
        return `<button type="button" role="gridcell" data-date="${iso}" aria-label="${dateLabel.format(utcDate(iso))}" aria-selected="${iso === chosen}" ${iso === getToday() ? 'aria-current="date"' : ''} tabindex="${iso === tabDate ? '0' : '-1'}" ${iso < min ? 'disabled' : ''}>${day}</button>`;
      }).join('')}</div>`).join('')}</div><div class="shoot-calendar__footer"><button type="button" data-today ${getToday() < min ? 'disabled' : ''}>Vandaag</button><button type="button" data-close>Sluiten</button></div><p class="shoot-calendar__note">Een datum is een voorkeur, nog geen reservering.</p>`;
      popup.querySelectorAll('[data-date]').forEach(button => {
        button.addEventListener('click', () => choose(button.dataset.date));
        button.addEventListener('focus', () => { focusedDate = button.dataset.date; });
      });
      popup.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
        month = new Date(Date.UTC(year, monthIndex + Number(button.dataset.direction), 1, 12));
        focusedDate = null;
        render(false, `[data-direction="${button.dataset.direction}"]`);
      }));
      const changePeriod = () => {
        const newYear = Number(popup.querySelector('[data-year]').value);
        let newMonth = Number(popup.querySelector('[data-month]').value);
        if (newYear === minYear) newMonth = Math.max(newMonth, Number(min.slice(5, 7)) - 1);
        month = new Date(Date.UTC(newYear, newMonth, 1, 12));
        focusedDate = null;
      };
      popup.querySelector('[data-month]').addEventListener('change', () => { changePeriod(); render(false, '[data-month]'); });
      popup.querySelector('[data-year]').addEventListener('change', () => { changePeriod(); render(false, '[data-year]'); });
      popup.querySelector('[data-today]').addEventListener('click', () => choose(getToday()));
      popup.querySelector('[data-close]').addEventListener('click', () => close(true));
      if (focus) popup.querySelector(`[data-date="${tabDate}"]`)?.focus();
      else if (control) popup.querySelector(control)?.focus();
    };
    const open = () => {
      if (input.matches(':disabled')) return;
      if (active?.input === input) { close(); return; }
      close();
      const min = minimum();
      const chosen = parseDate(input.value);
      focusedDate = chosen && chosen >= min ? chosen : min;
      month = utcDate(firstOfMonth(focusedDate));
      active = { input, wrapper, popup, toggle };
      popup.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      render(true);
    };
    toggle.addEventListener('click', open);
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); open(); }
    });
    input.addEventListener('blur', () => {
      const iso = parseDate(input.value);
      if (iso) input.value = formatDate(iso);
    });
    popup.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      const target = event.target.closest('[data-date]');
      if (!target) return;
      const key = event.key;
      const date = utcDate(target.dataset.date);
      const weekday = (date.getUTCDay() + 6) % 7;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
      if (Object.hasOwn(offsets, key)) date.setUTCDate(date.getUTCDate() + offsets[key]);
      else if (key === 'PageUp' || key === 'PageDown') {
        const day = date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + (key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
        date.setUTCDate(Math.min(day, last));
      } else return;
      event.preventDefault();
      let iso = isoFromDate(date);
      if (date.getUTCFullYear() > 9999) return;
      if (iso < minimum()) iso = minimum();
      focusedDate = iso;
      month = utcDate(firstOfMonth(iso));
      render(true);
    });
  }
  document.addEventListener('pointerdown', event => {
    if (active && !active.wrapper.contains(event.target)) close();
  });
  document.addEventListener('focusin', event => {
    if (active && !active.wrapper.contains(event.target)) close();
  });
  root.addEventListener('reset', () => close());
  return { close };
}
