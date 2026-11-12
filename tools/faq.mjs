// Blok "Veelgestelde vragen": links de kop met een korte tekst, rechts de vragen als klapvakken.
// De eerste vraag staat open. Gebruikt door build-galerij.mjs en de blogpagina's.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rich = (v) =>
  esc(v)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:\/|mailto:)[^)\s]*)\)/g, '<a href="$2">$1</a>');

export function faqBlok(vragen, { titel = 'Veelgestelde vragen', id = 'faq', indent = '    ' } = {}) {
  if (!vragen?.length) return '';
  const items = vragen
    .map(
      ([vraag, antwoord], i) => `      <details class="faq__item"${i === 0 ? ' open' : ''}>
        <summary class="faq__vraag"><span>${esc(vraag)}</span><span class="faq__icoon" aria-hidden="true"></span></summary>
        <div class="faq__antwoord"><p>${rich(antwoord)}</p></div>
      </details>`
    )
    .join('\n');
  const html = `<section class="faq" aria-labelledby="${id}-titel">
  <div class="faq__intro">
    <h2 class="faq__titel" id="${id}-titel">${esc(titel)}</h2>
    <p>Staat je vraag er niet tussen? Mail me gerust, dan denk ik met je mee.</p>
    <a class="faq__knop" href="mailto:info@vansonfotografie.nl">Mail je vraag &rarr;</a>
  </div>
  <div class="faq__lijst">
${items}
  </div>
</section>`;
  return html.replace(/^/gm, indent);
}

// Vragen voor Google (FAQPage), zonder opmaak.
export function faqSchema(vragen) {
  const plain = (v) => String(v).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: vragen.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
  };
}
