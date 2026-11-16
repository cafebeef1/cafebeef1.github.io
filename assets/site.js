(() => {
  const filters = Array.from(document.querySelectorAll('[data-poetry-filter]'));
  if (!filters.length) return;
  const cards = Array.from(document.querySelectorAll('[data-poem-card]'));
  const count = document.querySelector('[data-poetry-count]');
  const empty = document.querySelector('[data-poetry-empty]');
  const params = new URLSearchParams(window.location.search);
  filters.forEach((field) => {
    const initial = params.get(field.dataset.poetryFilter);
    if (initial && Array.from(field.options).some((o) => o.value === initial)) field.value = initial;
  });
  const update = (syncUrl) => {
    const selected = Object.fromEntries(filters.map((f) => [f.dataset.poetryFilter, f.value]));
    let visible = 0;
    cards.forEach((card) => {
      const match = Object.entries(selected).every(([key, value]) => {
        if (!value) return true;
        if (key === 'theme') return (card.dataset.themes || '').split('|').includes(value);
        return card.dataset[key] === value;
      });
      card.hidden = !match;
      if (match) visible += 1;
    });
    if (count) count.textContent = `共 ${visible} 首作品`;
    if (empty) empty.hidden = visible !== 0;
    if (syncUrl) {
      const next = new URLSearchParams();
      Object.entries(selected).forEach(([key, value]) => { if (value) next.set(key, value); });
      const query = next.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    }
  };
  filters.forEach((field) => field.addEventListener('change', () => update(true)));
  update(false);
})();
