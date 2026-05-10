(function() {
  'use strict';

  const state = {
    data: null,
    filteredGaps: [],
    filters: { severity: 'all', case: 'all', principle: 'all', search: '' },
  };

  const el = (id) => document.getElementById(id);

  fetch('gaps.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(init)
    .catch(err => {
      el('gap-list').innerHTML = `<div class="empty"><h3>Failed to load gaps.json</h3><p>${err.message}</p></div>`;
    });

  function init(data) {
    state.data = data;

    // Flatten gaps with case context
    const flatGaps = [];
    for (const c of data.cases) {
      for (const g of c.gaps) {
        flatGaps.push({
          ...g,
          caseNumber: c.number,
          caseTitle: c.title,
          caseSlug: c.slug,
          caseGif: c.gif,
        });
      }
    }
    state.allGaps = flatGaps;

    // KPIs
    el('kpi-total').textContent = flatGaps.length;
    el('kpi-high').textContent = data.totals.high;
    el('kpi-medium').textContent = data.totals.medium;
    el('kpi-low').textContent = data.totals.low;
    el('kpi-cases').textContent = data.cases.length;

    const principleSet = new Set();
    for (const g of flatGaps) for (const p of g.principles) principleSet.add(p);
    const principles = [...principleSet].sort();
    el('kpi-principles').textContent = principles.length;

    el('footer-cases').textContent = data.cases.length;
    el('footer-gaps').textContent = flatGaps.length;
    el('generated-date').textContent = data.generated.slice(0, 10);

    // Populate dropdowns
    const caseSel = el('filter-case');
    caseSel.innerHTML = '<option value="all">All cases</option>' +
      data.cases.map(c => `<option value="${c.number}">Case ${String(c.number).padStart(2,'0')} — ${escapeHtml(c.title || '')}</option>`).join('');

    const principleSel = el('filter-principle');
    principleSel.innerHTML = '<option value="all">All principles</option>' +
      principles.map(p => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`).join('');

    // Wire up filters
    document.querySelectorAll('#filter-severity .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#filter-severity .pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filters.severity = btn.dataset.value;
        syncSeverityKpis();
        render();
      });
    });

    document.querySelectorAll('.kpi[data-sev]').forEach(kpi => {
      kpi.addEventListener('click', () => {
        const sev = kpi.dataset.sev;
        const isActive = kpi.classList.contains('active-sev');
        const target = isActive ? 'all' : sev;
        document.querySelectorAll('#filter-severity .pill').forEach(b => {
          b.classList.toggle('active', b.dataset.value === target);
        });
        state.filters.severity = target;
        syncSeverityKpis();
        render();
      });
    });

    caseSel.addEventListener('change', () => {
      state.filters.case = caseSel.value;
      render();
    });
    principleSel.addEventListener('change', () => {
      state.filters.principle = principleSel.value;
      render();
    });

    el('search-input').addEventListener('input', debounce(e => {
      state.filters.search = e.target.value.trim().toLowerCase();
      render();
    }, 120));

    el('reset-filters').addEventListener('click', () => {
      state.filters = { severity: 'all', case: 'all', principle: 'all', search: '' };
      el('search-input').value = '';
      caseSel.value = 'all';
      principleSel.value = 'all';
      document.querySelectorAll('#filter-severity .pill').forEach(b => {
        b.classList.toggle('active', b.dataset.value === 'all');
      });
      syncSeverityKpis();
      render();
    });

    // Modal close
    const modal = el('gap-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.close();
    });

    render();
  }

  function syncSeverityKpis() {
    document.querySelectorAll('.kpi[data-sev]').forEach(kpi => {
      kpi.classList.toggle('active-sev', kpi.dataset.sev === state.filters.severity);
    });
  }

  function render() {
    const f = state.filters;
    const filtered = state.allGaps.filter(g => {
      if (f.severity !== 'all' && g.severity !== f.severity) return false;
      if (f.case !== 'all' && String(g.caseNumber) !== f.case) return false;
      if (f.principle !== 'all' && !g.principles.includes(f.principle)) return false;
      if (f.search) {
        const hay = (g.title + ' ' + g.paragraphs.join(' ') + ' ' + (g.fix || '') + ' ' + (g.evidence || '') + ' ' + g.principles.join(' ')).toLowerCase();
        if (!hay.includes(f.search)) return false;
      }
      return true;
    });

    state.filteredGaps = filtered;

    // Sort: high first, then medium, low; within severity, by case number
    const sevOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.caseNumber - b.caseNumber);

    el('result-count').textContent = `${filtered.length} of ${state.allGaps.length} gaps`;

    const list = el('gap-list');
    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty"><h3>No gaps match these filters</h3><p>Try removing a filter or clearing the search.</p></div>`;
      return;
    }

    list.innerHTML = filtered.map((g, i) => renderCard(g, i)).join('');
    list.querySelectorAll('.gap').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx, 10);
        openModal(filtered[idx]);
      });
    });
  }

  function renderCard(g, idx) {
    const snippet = (g.paragraphs && g.paragraphs[0]) ? g.paragraphs[0] : '';
    const principles = (g.principles || []).slice(0, 3).map(p => `<span class="principle-chip">${escapeHtml(p)}</span>`).join('');
    const thumb = g.id ? `<img class="gap-thumb" src="screenshots/${encodeURIComponent(g.id)}.png" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
    return `
      <article class="gap gap-${g.severity}" data-idx="${idx}">
        ${thumb}
        <div class="gap-top">
          <span class="gap-id">${escapeHtml(g.id || '—')}</span>
          <span class="sev-badge sev-${g.severity}">${g.severity}</span>
          <span class="case-tag">Case ${String(g.caseNumber).padStart(2,'0')}</span>
        </div>
        <h3 class="gap-title">${escapeHtml(g.title || 'Untitled')}</h3>
        <p class="gap-snippet">${escapeHtml(snippet)}</p>
        <div class="gap-principles">${principles}</div>
      </article>
    `;
  }

  function openModal(g) {
    const paragraphs = (g.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const evidence = g.evidence ? `<div class="evidence">${escapeHtml(g.evidence)}</div>` : '';
    const fix = g.fix ? `<div class="fix-block"><strong>Suggested fix</strong>${escapeHtml(g.fix)}</div>` : '';
    const principles = (g.principles || []).map(p => `<span class="principle-chip">${escapeHtml(p)}</span>`).join('');
    const sourceLink = `<a class="source-link" href="../ux-gap-reports/${g.caseSlug}.html" target="_blank" rel="noopener">View Case ${String(g.caseNumber).padStart(2,'0')} (with screen recording) →</a>`;

    const screenshot = g.id ? `<img class="modal-screenshot" src="screenshots/${encodeURIComponent(g.id)}.png" alt="Annotated screenshot for ${escapeAttr(g.id)}" onerror="this.style.display='none'">` : '';
    const html = `
      <button class="modal-close" id="modal-close-btn" aria-label="Close">×</button>
      <h2>${escapeHtml(g.title || '')}</h2>
      <div class="meta-row">
        <span class="gap-id">${escapeHtml(g.id || '—')}</span>
        <span class="sev-badge sev-${g.severity}">${g.severity}</span>
        <span class="case-tag">Case ${String(g.caseNumber).padStart(2,'0')} — ${escapeHtml(g.caseTitle || '')}</span>
      </div>
      ${screenshot}
      ${paragraphs}
      ${evidence}
      ${fix}
      <div class="principles">${principles}</div>
      ${sourceLink}
    `;

    const modal = el('gap-modal');
    el('modal-content').innerHTML = html;
    document.getElementById('modal-close-btn').addEventListener('click', () => modal.close());
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
})();
