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

const state = { data: null, q: '', cat: 'all' };

async function load() {
  const res = await fetch('/data/products.json', { cache: 'no-store' });
  state.data = await res.json();
  renderProof();
  renderFilters();
  renderGrid();
  document.getElementById('updatedMeta').textContent =
    `共 ${state.data.product_count} 个产品 · 抓取回复 ${state.data.posts_fetched} 条 · 更新 ${state.data.updated_at_label}`;
}

function renderProof() {
  const d = state.data;
  const cats = Object.keys(d.categories || {}).length;
  document.getElementById('proofStrip').innerHTML = [
    `<span>${d.product_count} 个产品</span>`,
    `<span>${d.posts_fetched} 条回复已抓取</span>`,
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
      renderGrid();
    });
  });
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  return (state.data.products || []).filter(p => {
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    if (!q) return true;
    const blob = [p.name, p.description, p.url, ...(p.recommenders||[])].join(' ').toLowerCase();
    return blob.includes(q);
  });
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const list = filtered();
  if (!list.length) {
    grid.innerHTML = `<div class="empty">没有匹配的工具。换个关键词或分类试试。</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const recs = (p.recommenders || []).map(h => `@${h}`).join(' ');
    const stats = [];
    if (p.likes) stats.push(`♥ ${p.likes}`);
    if (p.bookmarks) stats.push(`🔖 ${p.bookmarks}`);
    const href = p.url || ((p.replies && p.replies[0] && p.replies[0].url) || state.data.source_post);
    const cta = p.url ? '打开' : '看原帖';
    return `<article class="card">
      <div class="card-top">
        <span class="cat">${CAT_LABELS[p.category] || p.category}</span>
        <span class="stats">${stats.join(' · ')}</span>
      </div>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description || '')}</p>
      <div class="card-foot">
        <span class="recs" title="${escapeHtml(recs)}">${escapeHtml(recs || '社区推荐')}</span>
        <a class="cta" href="${escapeAttr(href)}" target="_blank" rel="noopener">${cta}</a>
      </div>
    </article>`;
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
  renderGrid();
});
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const nowDark = cur ? cur === 'dark' : prefersDark;
  const next = nowDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});

load().catch(err => {
  document.getElementById('grid').innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`;
});
