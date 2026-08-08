/* ============================================================
   AI Agent 全景地图 — app.js
   数据驱动：data/agents.json · data/news.json · data/sources.json
   三视图：Landscape（SVG 全景图）/ Timeline（资讯时间轴）/ Knowledge（知识库）
   ============================================================ */

'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  view: 'landscape',
  agents: [],
  camps: [],
  news: [],
  sources: {},
  selectedAgent: null,
  tlAgentFilter: new Set(),   // 空 = 全部
  tlSourceFilter: new Set(),  // 空 = 全部
  kbOpenId: null,
};

/* ---------------- 数据加载 ---------------- */
async function loadData() {
  const [agentsRes, newsRes, sourcesRes] = await Promise.all([
    fetch('data/agents.json'),
    fetch('data/news.json'),
    fetch('data/sources.json'),
  ]);
  const agentsData = await agentsRes.json();
  const newsData = await newsRes.json();
  const sourcesData = await sourcesRes.json();
  state.agents = agentsData.agents;
  state.camps = agentsData.camps;
  state.news = newsData.items || [];
  state.sources = sourcesData.agents || {};
  $('#updatedStamp').textContent = '数据更新于 ' + (agentsData.updated || '');
}

function campById(id) {
  return state.camps.find((c) => c.id === id) || { name: id, color: '#8B5CF6' };
}

function agentById(id) {
  return state.agents.find((a) => a.id === id);
}

/* ---------------- 视图切换 ---------------- */
function switchView(view) {
  state.view = view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'landscape' && state.selectedAgent) highlightNode(state.selectedAgent);
}

/* ---------------- Landscape：SVG 全景图 ---------------- */
const REGIONS = [
  { camp: 'frontier-us',  x: 60,  y: 60,  w: 420, h: 300 },
  { camp: 'cn-major',     x: 560, y: 60,  w: 480, h: 190 },
  { camp: 'cn-emerging',  x: 560, y: 280, w: 480, h: 180 },
  { camp: 'open-source',  x: 60,  y: 430, w: 980, h: 210 },
];

function renderLandscape() {
  const svg = $('#landscapeSvg');
  svg.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  // 1) 区域框 + 标题
  REGIONS.forEach((reg) => {
    const camp = campById(reg.camp);
    const g = make('g', {});
    const rect = make('rect', {
      x: reg.x, y: reg.y, width: reg.w, height: reg.h,
      rx: 18, class: 'ls-region',
      fill: camp.color + '14',
      stroke: camp.color + '55',
    });
    g.appendChild(rect);
    const title = make('text', {
      x: reg.x + 22, y: reg.y + 30, class: 'ls-region-title', fill: camp.color,
    });
    title.textContent = camp.name;
    g.appendChild(title);
    const desc = make('text', { x: reg.x + 22, y: reg.y + 48, class: 'ls-region-desc', fill: '#6b6b74' });
    desc.textContent = camp.desc;
    g.appendChild(desc);
    svg.appendChild(g);
  });

  // 2) Agent 节点
  state.agents.forEach((agent) => {
    const camp = campById(agent.camp);
    const r = agent.size === 3 ? 50 : 42;
    const g = make('g', { class: 'ls-node', 'data-agent': agent.id });
    const bg = make('circle', {
      cx: agent.position.x, cy: agent.position.y, r, class: 'node-bg',
      fill: camp.color + '1f', stroke: camp.color + 'aa',
    });
    g.appendChild(bg);
    // 节点主标签：优先中文名（豆包/通义千问/腾讯元宝），否则英文名
    let label = agent.name;
    if (label.length > 4) label = agent.name.length > 6 ? agent.name.slice(0, 6) : agent.name;
    const labelEl = make('text', { x: agent.position.x, y: agent.position.y + 5, class: 'node-label', 'font-size': label.length > 3 ? 14 : 16 });
    labelEl.textContent = label;
    g.appendChild(labelEl);
    const sub = make('text', { x: agent.position.x, y: agent.position.y + r + 16, class: 'node-sub' });
    sub.textContent = agent.company;
    g.appendChild(sub);
    // 原生 tooltip
    const tip = make('title', {});
    tip.textContent = `${agent.name} · ${agent.company}\n${agent.tagline}`;
    g.appendChild(tip);
    g.addEventListener('click', () => selectAgent(agent.id));
    svg.appendChild(g);
  });

  // 3) 扩展占位节点（未来更多 Agent）
  const ph = make('g', { class: 'ls-placeholder' });
  const phCircle = make('circle', { cx: 620, cy: 540, r: 30, fill: 'none', stroke: '#3a3a42' });
  ph.appendChild(phCircle);
  const phText = make('text', { x: 620, y: 545, 'font-size': 20, fill: '#3a3a42' });
  phText.textContent = '+';
  ph.appendChild(phText);
  const phLabel = make('text', { x: 620, y: 592, 'font-size': 11 });
  phLabel.textContent = '更多开源 Agent 持续收录';
  ph.appendChild(phLabel);
  svg.appendChild(ph);

  // 4) 图例
  const legend = $('#legend');
  legend.innerHTML = '';
  state.camps.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = c.color;
    item.appendChild(sw);
    item.appendChild(document.createTextNode(c.name));
    legend.appendChild(item);
  });
}

function highlightNode(agentId) {
  $$('.ls-node').forEach((n) => n.classList.toggle('selected', n.dataset.agent === agentId));
}

function renderDetailEmpty() {
  state.selectedAgent = null;
  $$('.ls-node').forEach((n) => n.classList.remove('selected'));
  $('#detailPanel').innerHTML = `
    <div class="detail-empty">
      <div class="detail-empty-icon">◉</div>
      <p>点击全景图中的节点，<br>查看该智能体的详情与入口</p>
    </div>`;
}

function selectAgent(agentId) {
  state.selectedAgent = agentId;
  highlightNode(agentId);
  const a = agentById(agentId);
  const camp = campById(a.camp);
  const panel = $('#detailPanel');

  const links = [
    { kind: '官网', url: a.homepage },
    { kind: '文档', url: a.docs },
    { kind: '博客', url: a.blog },
    { kind: 'X', url: 'https://x.com/' + a.x.replace('@', '') },
    { kind: 'GitHub', url: a.github },
  ].filter((l) => l.url);
  if (a.challenge) links.push({ kind: 'Challenge', url: a.challenge });

  panel.innerHTML = `
    <div class="detail-agent-name" style="color:${camp.color}">${a.name}</div>
    <div class="detail-agent-company">${a.company} · ${a.country === 'US' ? '美国' : '中国'} · ${camp.name}</div>
    <p class="detail-tagline">${a.tagline}</p>
    <div class="detail-section-title">核心能力</div>
    <div class="chip-row">${a.key_features.map((f) => `<span class="chip">${f}</span>`).join('')}</div>
    <div class="detail-section-title">入口</div>
    <div class="detail-links">${links.map((l) => `
      <a class="detail-link" href="${l.url}" target="_blank" rel="noopener">
        <span>${l.kind}</span><span class="link-kind">↗</span>
      </a>`).join('')}
    </div>
    <button class="detail-kb-btn" data-kb="${a.id}">进入知识库 →</button>
  `;
  panel.querySelector('[data-kb]').addEventListener('click', () => openKnowledge(a.id));
}

/* ---------------- Timeline：资讯时间轴 ---------------- */
const SOURCE_TYPES = ['官方博客', '文档', 'X', '公众号', '媒体', '社区', 'Challenge'];

function renderTimelineFilters() {
  const agentsBox = $('#filterAgents');
  agentsBox.innerHTML = '';
  const allTag = makeFilterTag('全部', 'all', null, state.tlAgentFilter.size === 0);
  allTag.addEventListener('click', () => {
    state.tlAgentFilter.clear();
    renderTimelineFilters();
    renderTimeline();
  });
  agentsBox.appendChild(allTag);
  state.agents.forEach((a) => {
    const camp = campById(a.camp);
    const tag = makeFilterTag(a.name, a.id, camp.color, state.tlAgentFilter.has(a.id));
    tag.addEventListener('click', () => {
      if (state.tlAgentFilter.has(a.id)) state.tlAgentFilter.delete(a.id);
      else state.tlAgentFilter.add(a.id);
      renderTimelineFilters();
      renderTimeline();
    });
    agentsBox.appendChild(tag);
  });

  const sourcesBox = $('#filterSources');
  sourcesBox.innerHTML = '';
  const allSrc = makeFilterTag('全部', 'all', null, state.tlSourceFilter.size === 0);
  allSrc.addEventListener('click', () => {
    state.tlSourceFilter.clear();
    renderTimelineFilters();
    renderTimeline();
  });
  sourcesBox.appendChild(allSrc);
  SOURCE_TYPES.forEach((t) => {
    const tag = makeFilterTag(t, t, null, state.tlSourceFilter.has(t));
    tag.addEventListener('click', () => {
      if (state.tlSourceFilter.has(t)) state.tlSourceFilter.delete(t);
      else state.tlSourceFilter.add(t);
      renderTimelineFilters();
      renderTimeline();
    });
    sourcesBox.appendChild(tag);
  });
}

function makeFilterTag(text, value, color, active) {
  const tag = document.createElement('button');
  tag.className = 'filter-tag' + (active ? ' active' : '');
  tag.dataset.value = value;
  if (color) {
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = color;
    tag.appendChild(dot);
  }
  tag.appendChild(document.createTextNode(text));
  return tag;
}

function renderTimeline() {
  const list = $('#timelineList');
  let items = [...state.news].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (state.tlAgentFilter.size > 0) items = items.filter((n) => state.tlAgentFilter.has(n.agent));
  if (state.tlSourceFilter.size > 0) items = items.filter((n) => state.tlSourceFilter.has(n.source_type));

  if (items.length === 0) {
    list.innerHTML = `
      <div class="tl-empty">
        📡 时间轴暂无资讯条目<br>
        数据文件 <code>data/news.json</code> 为空 —— 已接入 RSS 抓取后会自动填充。<br>
        <br>下一步：配置信息源抓取（官方博客 / X / 公众号），见知识库「更新机制」章节。
      </div>`;
    return;
  }

  list.innerHTML = items.map((n) => {
    const agent = agentById(n.agent);
    const camp = campById(agent ? agent.camp : 'frontier-us');
    return `
    <div class="tl-item">
      <div class="tl-card">
        <div class="tl-meta">
          <span class="tl-date">${n.date}</span>
          ${agent ? `<span class="tl-agent-tag" style="color:${camp.color};border-color:${camp.color}66;background:${camp.color}14">${agent.name}</span>` : ''}
          <span class="tl-source">via ${n.source_name || n.source_type}</span>
        </div>
        <div class="tl-title"><a href="${n.url}" target="_blank" rel="noopener">${n.title}</a></div>
        ${n.summary ? `<p class="tl-summary">${n.summary}</p>` : ''}
        ${n.tags && n.tags.length ? `<div class="tl-tags">${n.tags.map((t) => `<span class="tl-tag">${t}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderSourcesPanel() {
  const box = $('#sourcesList');
  const html = state.agents.map((a) => {
    const camp = campById(a.camp);
    const srcs = (state.sources[a.id] || []).slice().sort((x, y) => x.priority - y.priority);
    const items = srcs.map((s) => `
      <a class="src-item" href="${s.url}" target="_blank" rel="noopener" title="${s.name}">
        <span>${s.name}${s.rss ? ' <span class="rss-mark">🅁</span>' : ''}</span>
        <span class="src-type">${s.type}${s.priority === 1 ? ' · 必追' : ''}</span>
      </a>`).join('');
    return `
      <div class="src-group">
        <div class="src-group-head">
          <span class="src-group-name" style="color:${camp.color}">${a.name}</span>
          <span class="src-priority">${srcs.filter((s) => s.priority === 1).length} 个必追信源</span>
        </div>
        ${items || '<div class="src-item" style="cursor:default">待补充</div>'}
      </div>`;
  }).join('');
  box.innerHTML = html;
}

/* ---------------- Knowledge：知识库 ---------------- */
function renderKnowledgeGrid() {
  const grid = $('#kbGrid');
  grid.innerHTML = state.agents.map((a) => {
    const camp = campById(a.camp);
    return `
    <div class="kb-card" data-kb="${a.id}">
      <div class="kb-card-top">
        <span class="kb-card-name">${a.name}</span>
        <span class="kb-card-camp" style="color:${camp.color};border-color:${camp.color}66;background:${camp.color}14">${camp.name}</span>
      </div>
      <div class="kb-card-company">${a.company}</div>
      <div class="kb-card-tagline">${a.tagline}</div>
      <div class="kb-card-feats">${a.key_features.slice(0, 4).map((f) => `<span class="kb-card-feat">${f}</span>`).join('')}</div>
      <span class="kb-card-enter">打开知识库 →</span>
    </div>`;
  }).join('');
  $$('#kbGrid .kb-card').forEach((card) => {
    card.addEventListener('click', () => openKnowledge(card.dataset.kb));
  });
}

async function openKnowledge(agentId) {
  const a = agentById(agentId);
  if (!a) return;
  state.kbOpenId = agentId;
  $('#knowledgeHome').classList.add('hidden');
  $('#knowledgeDetail').classList.remove('hidden');
  const camp = campById(a.camp);
  $('#kbDetailMeta').innerHTML = `
    <div class="detail-agent-name" style="color:${camp.color}">${a.name} 知识库</div>
    <div class="detail-agent-company">${a.company} · ${a.tagline}</div>`;
  $('#kbContent').innerHTML = '<p style="color:var(--text-faint)">加载中…</p>';
  try {
    const res = await fetch(`knowledge/${agentId}.md`);
    if (!res.ok) throw new Error('not found');
    const md = await res.text();
    $('#kbContent').innerHTML = marked.parse(md);
  } catch (e) {
    $('#kbContent').innerHTML = `
      <h1>${a.name} 知识库</h1>
      <p>知识库文件 <code>knowledge/${agentId}.md</code> 尚未创建。</p>
      <p>知识库将包含：官方教程、Challenge 题目与解法、实战项目、信息源清单。</p>`;
  }
  switchView('knowledge');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeKnowledge() {
  state.kbOpenId = null;
  $('#knowledgeDetail').classList.add('hidden');
  $('#knowledgeHome').classList.remove('hidden');
}

/* ---------------- 初始化 ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderLandscape();
  renderTimelineFilters();
  renderTimeline();
  renderSourcesPanel();
  renderKnowledgeGrid();

  // 导航
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#kbBack').addEventListener('click', closeKnowledge);
  $('#view-landscape .landscape-canvas').addEventListener('dblclick', (e) => {
    if (!e.target.closest('.ls-node')) renderDetailEmpty();
  });
});
