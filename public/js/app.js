const CAT_LABELS = {
  'coding agent': 'Coding Agent',
  'cli': 'CLI',
  'desktop': '桌面应用',
  'plugin': '插件 / Skill',
  'memory': '记忆',
  'education': '教育',
  'other': '其他',
};
const CAT_ORDER = ['coding agent','cli','desktop','plugin','memory','education','other'];

const state = { data: null, q: '', cat: 'all', view: 'cards' };

async function load() {
  const res = await fetch('/data/products.json', { cache: 'no-store' });
  state.data = await res.json();
  renderProof();
  renderFilters();
  render();
  document.getElementById('updatedMeta').textContent =
    `共 ${state.data.product_count} 个产品 · 抓取回复 ${state.data.posts_fetched} 条 · 更新 ${state.data.updated_at_label}`;
}

function renderProof() {
  const d = state.data;
  const cats = Object.keys(d.categories || {}).length;
  const withImg = (d.products || []).filter(p => p.image && !p.image_note).length;
  document.getElementById('proofStrip').innerHTML = [
    `<span>${d.product_count} 个产品</span>`,
    `<span>${withImg} 张实图封面</span>`,
    `<span>${cats} 个分类</span>`,
    `<span>源帖 @vista8</span>`,
  ].join('');
}

function renderFilters() {
  const wrap = document.getElementById('filters');
  const cats = CAT_ORDER.filter(c => (state.data.categories || {})[c]);
  const items = ['all', ...cats];
  wrap.innerHTML = items.map(c => {
    const label = c === 'all' ? `全部 ${state.data.product_count}` : `${CAT_LABELS[c] || c} ${state.data.categories[c]}`;
    return `<button type="button" class="chip ${state.cat===c?'active':''}" data-cat="${c}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.cat = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  return (state.data.products || []).filter(p => {
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    if (!q) return true;
    const blob = [p.name, p.summary, p.description, p.detail, p.url, ...(p.recommenders||[]), ...(p.tags||[])].join(' ').toLowerCase();
    return blob.includes(q);
  });
}

function metric(p, key) {
  if (key === 'like_count') {
    const n = p.like_count ?? p.likes;
    return (n == null || n === '') ? null : Number(n);
  }
  if (key === 'impression_count') {
    const n = p.impression_count ?? p.impressions;
    return (n == null || n === '') ? null : Number(n);
  }
  return null;
}

function sortedForView(list) {
  if (state.view === 'likes') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'like_count');
      const bv = metric(b, 'like_count');
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || (metric(b,'impression_count')||0) - (metric(a,'impression_count')||0);
    });
  }
  if (state.view === 'impressions') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'impression_count');
      const bv = metric(b, 'impression_count');
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || (metric(b,'like_count')||0) - (metric(a,'like_count')||0);
    });
  }
  // cards: keep likes desc as default browse order
  return [...list].sort((a, b) => (metric(b,'like_count')||0) - (metric(a,'like_count')||0));
}

function render() {
  const grid = document.getElementById('grid');
  const rank = document.getElementById('rankList');
  const list = sortedForView(filtered());
  if (state.view === 'cards') {
    grid.classList.remove('hidden');
    rank.classList.add('hidden');
    renderGrid(list);
  } else {
    grid.classList.add('hidden');
    rank.classList.remove('hidden');
    renderRank(list);
  }
}

function renderGrid(list) {
  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty">没有匹配的工具。换个关键词或分类试试。</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const recs = (p.recommenders || []).map(h => `@${h}`).join(' ');
    const stats = [];
    const likes = metric(p, 'like_count');
    const imps = metric(p, 'impression_count');
    if (likes != null) stats.push(`♥ ${likes}`);
    if (imps != null) stats.push(`👁 ${Number(imps).toLocaleString()}`);
    const href = `/p/${encodeURIComponent(p.slug)}/`;
    const img = p.image || '/images/products/placeholder.svg';
    return `<article class="card">
      <a class="card-media" href="${href}"><img src="${escapeAttr(img)}" alt="" loading="lazy" /></a>
      <div class="card-body">
        <div class="card-top">
          <span class="cat">${CAT_LABELS[p.category] || p.category}</span>
          <span class="stats">${stats.join(' · ')}</span>
        </div>
        <h3><a href="${href}">${escapeHtml(p.name)}</a></h3>
        <p>${escapeHtml(p.summary || p.description || '')}</p>
        <div class="card-foot">
          <span class="recs" title="${escapeHtml(recs)}">${escapeHtml(recs || '社区推荐')}</span>
          <a class="cta" href="${href}">详情</a>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderRank(list) {
  const rank = document.getElementById('rankList');
  const key = state.view === 'likes' ? 'like_count' : 'impression_count';
  const title = state.view === 'likes' ? '点赞榜' : '浏览榜';
  if (!list.length) {
    rank.innerHTML = `<div class="empty">没有匹配的工具。</div>`;
    return;
  }
  rank.innerHTML = `<h2 class="rank-title">${title}</h2>` + list.map((p, i) => {
    const likes = metric(p, 'like_count');
    const imps = metric(p, 'impression_count');
    const primary = key === 'like_count' ? likes : imps;
    const primaryLabel = primary == null ? '—' : (key === 'impression_count' ? Number(primary).toLocaleString() : String(primary));
    const secondary = key === 'like_count'
      ? (imps == null ? '浏览 —' : `浏览 ${Number(imps).toLocaleString()}`)
      : (likes == null ? '赞 —' : `赞 ${likes}`);
    const href = `/p/${encodeURIComponent(p.slug)}/`;
    const img = p.image || '';
    return `<a class="rank-item" href="${href}">
      <span class="rank-no">${i + 1}</span>
      <img class="rank-thumb" src="${escapeAttr(img)}" alt="" loading="lazy" />
      <span class="rank-main">
        <strong>${escapeHtml(p.name)}</strong>
        <em>${escapeHtml(CAT_LABELS[p.category] || p.category)} · ${escapeHtml((p.recommenders||[]).map(h=>'@'+h).join(' ') || '社区')}</em>
      </span>
      <span class="rank-metric">
        <strong>${primaryLabel}</strong>
        <em>${secondary}</em>
      </span>
    </a>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, '');
}

document.getElementById('search').addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const nowDark = cur ? cur === 'dark' : prefersDark;
  const next = nowDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});
document.getElementById('viewTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  state.view = btn.dataset.view;
  document.querySelectorAll('#viewTabs .tab').forEach(t => {
    const on = t === btn;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  render();
});

load().catch(err => {
  document.getElementById('grid').innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`;
});
