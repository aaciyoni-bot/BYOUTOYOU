/* byoutoyou — bedside beauty care for hospital patients.
 * A static single-page app over the committed CMS hospital directory:
 *   data/index.json         states + counts
 *   data/states/<code>.json hospitals of one state
 *   data/search.json        compact rows for ⌘K search and "near me"
 *   data/us-states.json     projected SVG paths for the map
 */
(() => {
'use strict';

/* ------------------------------------------------------------------ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US');
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }
};

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function phoneFmt(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (p || '');
}

const toRad = d => d * Math.PI / 180;
function milesBetween(a, b, c, d) {
  const dLat = toRad(c - a), dLon = toRad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
  return 7917.5 * Math.asin(Math.min(1, Math.sqrt(h))) / 2;
}

/* ------------------------------------------------------------------ content */
const SERVICES = [
  { id: 'cut', emoji: '✂️', name: 'Bedside haircut', desc: 'Dry cut done seated or lying down, with a clip-on cape and full clean-up.', price: 75, dur: '40 min' },
  { id: 'wash', emoji: '💧', name: 'No-rinse hair wash', desc: 'Basin-free wash and blow-dry that works with limited mobility.', price: 60, dur: '30 min' },
  { id: 'cutwash', emoji: '💇', name: 'Haircut + wash', desc: 'The most requested visit: wash, cut and gentle style in one session.', price: 95, dur: '45 min' },
  { id: 'shave', emoji: '🪒', name: 'Shave & beard trim', desc: 'Hot-towel shave or beard shaping, adapted around lines and tubing.', price: 55, dur: '30 min' },
  { id: 'mani', emoji: '💅', name: 'Manicure', desc: 'Nail care with hospital-grade sterilised tools; polish optional.', price: 55, dur: '35 min' },
  { id: 'pedi', emoji: '🦶', name: 'Comfort pedicure', desc: 'Non-invasive nail and skin care for bed-bound patients.', price: 70, dur: '45 min' },
  { id: 'facial', emoji: '🌿', name: 'Gentle facial', desc: 'Fragrance-free cleanse and hydration for skin dried out by a long stay.', price: 80, dur: '40 min' },
  { id: 'makeup', emoji: '✨', name: 'Discharge-day makeup', desc: 'Light, natural makeup for going-home photos or a family visit.', price: 85, dur: '40 min' },
  { id: 'wig', emoji: '👒', name: 'Wig & headscarf fitting', desc: 'Fitting, trimming and styling, including oncology headwear.', price: 120, dur: '60 min' },
  { id: 'scalp', emoji: '🫧', name: 'Scalp & hand massage', desc: 'Ten quiet minutes of pressure-free touch. Cleared with nursing first.', price: 45, dur: '25 min' },
  { id: 'braid', emoji: '🧶', name: 'Braids & protective styles', desc: 'Long-wear styles that stay neat through a multi-week admission.', price: 130, dur: '90 min' },
  { id: 'partner', emoji: '👨‍👩‍👧', name: 'Caregiver add-on', desc: 'Any service for the family member who has not left the room in days.', price: 45, dur: '30 min' }
];

const FAQS = [
  ['Is this allowed inside the hospital?', 'In most hospitals, yes — personal grooming by an outside provider is generally permitted with the care team\'s approval. Our coordinator calls the nurses\' station before every visit, and if the unit says today is not the day, we reschedule at no cost. Some units (ICU, transplant, isolation) restrict visits, and we respect their call.'],
  ['Do you provide any medical care?', 'No. byoutoyou professionals do personal-care work only — hair, nails, shaving, skin comfort. They do not move patients, handle lines or equipment, give advice, or perform anything clinical. Anything that touches care goes to the nursing staff.'],
  ['How are the professionals vetted?', 'State licence verification, criminal background check, references, proof of liability insurance, and our own training on hospital etiquette, hand hygiene, isolation precautions and patient privacy. Each pro carries photo ID and shows it at the nurses\' station.'],
  ['What does it cost, and when am I charged?', 'Prices are flat per service, listed on this site, with no travel fee — the professional is local to the hospital, so there is no trip to pay for. You are charged after the visit is completed. If the unit cancels, you pay nothing.'],
  ['Who actually comes to the room?', 'A professional who lives and works near that hospital. We never assign someone from another state or another region and drive them in: the person who walks into the room is local, knows the hospital, and can come back next week if the stay runs long. That is why a hospital outside a live market takes a waitlist request instead of a booking — we would rather say "not yet" than send a stranger across the country.'],
  ['Can I book for someone in another state?', 'Yes — you request from wherever you are, and the visit is done by a professional based near that hospital, not near you. Most of our requests come from a family member several states away.'],
  ['How fast can someone come?', 'Where we already have local professionals, most requests are matched within 24 hours in metro areas and 2–3 days in rural counties. If the situation is time-sensitive — a discharge, a wedding, a family visit — say so in the request and we prioritise it.'],
  ['Is my information private?', 'Requests stay on your device until you send them, and we ask for the minimum: patient first name, unit and room. Never send medical records or diagnoses. We do not sell or share contact details.'],
  ['Where does the hospital list come from?', 'From the public CMS "Hospital General Information" dataset, which covers every Medicare-certified hospital in the United States. Being listed here does not mean a hospital endorses or is affiliated with byoutoyou.']
];

/* ------------------------------------------------------------------ state */
const app = {
  index: null,        // data/index.json
  states: new Map(),  // code -> state file
  search: null,       // data/search.json rows
  map: null,          // data/us-states.json
  coords: store.get('byt_coords', null),
  page: 0,
  filtered: [],
  current: null,      // current state file
  compare: [],
  coverage: null,     // data/coverage.json — the live markets
  bookingHospital: null,
  bookingStep: 1
};

const PAGE_SIZE = 24;

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function loadIndex() {
  if (app.index) return app.index;
  app.index = await getJSON('data/index.json');
  return app.index;
}

async function loadState(code) {
  const key = code.toUpperCase();
  if (app.states.has(key)) return app.states.get(key);
  const data = await getJSON(`data/states/${key.toLowerCase()}.json`);
  app.states.set(key, data);
  return data;
}

async function loadSearch() {
  if (app.search) return app.search;
  const data = await getJSON('data/search.json');
  app.search = data.rows.map(r => ({
    id: r[0], name: r[1], city: r[2], state: r[3],
    rating: r[4] || null, emergency: !!r[5],
    lat: r[6] ?? null, lon: r[7] ?? null
  }));
  return app.search;
}

async function loadCoverage() {
  if (app.coverage) return app.coverage;
  try {
    app.coverage = await getJSON('data/coverage.json');
  } catch {
    app.coverage = { markets: [], defaultRadiusMiles: 35 };
  }
  return app.coverage;
}

/* ------------------------------------------------------------------ coverage
   The rule the whole service rests on: whoever walks into that room is based
   near that hospital. A professional is never matched across a state or a
   region, so a hospital outside a live market cannot be booked at all — it
   takes a waitlist request instead. Markets live in data/coverage.json and are
   added only once real, credentialed pros are on the ground there. */
function marketFor(hospital) {
  const cov = app.coverage;
  if (!cov || !hospital || hospital.lat == null) return null;
  const fallback = cov.defaultRadiusMiles || 35;
  let best = null;
  for (const m of cov.markets || []) {
    if (m.lat == null || m.lon == null) continue;
    const miles = milesBetween(hospital.lat, hospital.lon, m.lat, m.lon);
    const radius = m.radiusMiles || fallback;
    if (miles <= radius && (!best || miles < best.miles)) best = { ...m, miles };
  }
  return best;
}

function isCovered(hospital) {
  return !!marketFor(hospital);
}

function coverageLine(hospital) {
  const m = marketFor(hospital);
  if (m) {
    return `Served by ${m.pros ? `${m.pros} ` : ''}vetted professional${m.pros === 1 ? '' : 's'} based in ${esc(m.name)} —
      within ${Math.round(m.radiusMiles || app.coverage.defaultRadiusMiles || 35)} miles of this hospital.`;
  }
  return `No local professional here yet. We only send someone who lives near the hospital, never from another
    state or region, so this one takes a waitlist request until we have pros on the ground in the area.`;
}

/* ------------------------------------------------------------------ router */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, anchor] = raw.split('#');
  const parts = path.split('/').filter(Boolean);
  return { view: parts[0] || 'home', param: parts[1] || '', anchor };
}

function showView(name) {
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== name; });
  $('.mobile-nav').hidden = true;
  $('[data-toggle-nav]').setAttribute('aria-expanded', 'false');
}

/* Any overlay left open across a route change would trap scrolling and cover
   the new view, so every navigation starts from a clean slate. */
function closeOverlays() {
  ['#palette', '#drawer', '#booking', '#compare-modal'].forEach(sel => { $(sel).hidden = true; });
  document.body.style.overflow = '';
}

async function route() {
  closeOverlays();
  const { view, param, anchor } = parseHash();

  if (view === 'states') {
    showView('states');
    await renderStates();
  } else if (view === 'state' && param) {
    showView('state');
    await renderState(param);
  } else if (view === 'hospital' && param) {
    const [stateCode, id] = location.hash.replace(/^#\/hospital\//, '').split('/');
    showView('state');
    await renderState(stateCode);
    if (id) setTimeout(() => openHospital(id, stateCode.toUpperCase()), 120);
    return;
  } else if (view === 'saved') {
    showView('saved');
    renderSaved();
  } else {
    showView('home');
    renderHomeRecent();
  }

  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) { setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); return; }
  }
  if (!parseHash().anchor) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ------------------------------------------------------------------ home */
function renderServices() {
  $('#services-grid').innerHTML = SERVICES.map(s => `
    <article class="service">
      <div class="emoji" aria-hidden="true">${s.emoji}</div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.desc)}</p>
      <div class="meta"><span class="price">$${s.price}</span><span class="dur">${esc(s.dur)}</span></div>
    </article>`).join('');
}

function renderFaq() {
  $('#faq-list').innerHTML = FAQS.map(([q, a]) => `
    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
  });
  document.head.appendChild(ld);
}

function countUp(el, to) {
  const dur = 900, t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderStats() {
  const idx = app.index;
  const total = idx ? idx.total : 5400;
  const jurisdictions = idx ? idx.states.length : 52;
  $$('[data-stat="hospitals"]').forEach(el => { el.textContent = fmt(total) + '+'; });
  $$('[data-generated]').forEach(el => { el.textContent = idx ? `updated ${idx.generated}` : 'updating'; });

  const seen = new WeakSet();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting || seen.has(e.target)) return;
      seen.add(e.target);
      const el = e.target;
      const to = el.hasAttribute('data-stat-total') ? total
        : el.dataset.countTo === '50' ? jurisdictions
          : Number(el.dataset.countTo);
      countUp(el, to);
    });
  }, { threshold: .4 });
  $$('[data-count-to]').forEach(el => io.observe(el));
}

function renderHomeRecent() {
  const recent = store.get('byt_recent_states', []);
  const box = $('#home-recent');
  if (!recent.length || !app.index) { box.hidden = true; return; }
  box.hidden = false;
  $('#home-recent-list').innerHTML = recent.slice(0, 6).map(code => {
    const st = app.index.states.find(s => s.code === code);
    return st ? `<a class="chip" href="#/state/${st.code}">${esc(st.name)} <b>${fmt(st.count)}</b></a>` : '';
  }).join('');
}

/* ------------------------------------------------------------------ map */
const MAP_STOPS = ['#f7dbe6', '#eeb0c8', '#e084a8', '#cf5c88', '#a83a64'];

function fillFor(count, max) {
  if (!count) return 'var(--surface-2)';
  const r = Math.sqrt(count / max); // sqrt keeps small states visible
  return MAP_STOPS[Math.min(4, Math.floor(r * MAP_STOPS.length))];
}

async function renderMap() {
  const host = $('#us-map');
  try {
    const [idx, map] = await Promise.all([loadIndex(), app.map ? Promise.resolve(app.map) : getJSON('data/us-states.json')]);
    app.map = map;
    const counts = new Map(idx.states.map(s => [s.code, s.count]));
    const max = Math.max(...counts.values());

    const paths = Object.entries(map.states).map(([code, s]) => {
      const count = counts.get(code) || 0;
      return `<path d="${s.d}" data-code="${code}" tabindex="0" role="link"
        aria-label="${esc(s.name)}, ${fmt(count)} hospitals" style="fill:${fillFor(count, max)}"><title>${esc(s.name)} — ${fmt(count)} hospitals</title></path>`;
    }).join('');

    host.innerHTML = `<svg viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="Hospital coverage by state">${paths}</svg>`;

    const territories = idx.states.filter(s => !map.states[s.code]);
    $('#territories').innerHTML = territories.map(s =>
      `<a class="chip" href="#/state/${s.code}">${esc(s.name)} <b>${fmt(s.count)}</b></a>`).join('');

    host.addEventListener('mouseover', e => {
      const p = e.target.closest('path');
      if (p) previewState(p.dataset.code);
    });
    host.addEventListener('focusin', e => {
      const p = e.target.closest('path');
      if (p) previewState(p.dataset.code);
    });
    host.addEventListener('click', e => {
      const p = e.target.closest('path');
      if (p) location.hash = `#/state/${p.dataset.code}`;
    });
    host.addEventListener('keydown', e => {
      const p = e.target.closest('path');
      if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = `#/state/${p.dataset.code}`; }
    });
  } catch (err) {
    host.innerHTML = `<div class="empty"><p>The hospital directory is being rebuilt right now. Please check back in a few minutes.</p></div>`;
  }
}

function previewState(code) {
  const st = app.index?.states.find(s => s.code === code);
  if (!st) return;
  $('#map-tip').innerHTML = `
    <h3>${esc(st.name)}</h3>
    <p>${esc(st.topCities?.slice(0, 3).map(c => c.city).join(' · ') || '')}</p>
    <div class="mini-kpis">
      <div><b>${fmt(st.count)}</b>hospitals</div>
      <div><b>${fmt(st.emergency)}</b>with ER</div>
      <div><b>${fmt(st.cities)}</b>cities</div>
    </div>`;
}

/* ------------------------------------------------------------------ states view */
let statesSort = 'name';

async function renderStates() {
  const grid = $('#state-grid');
  grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join('');
  let idx;
  try {
    idx = await loadIndex();
  } catch {
    grid.innerHTML = '';
    $('#states-summary').textContent = 'The directory is being rebuilt — please check back shortly.';
    return;
  }
  $('#states-summary').textContent =
    `${fmt(idx.total)} Medicare-certified hospitals across ${idx.states.length} states and territories. Source: CMS, updated ${idx.generated}.`;
  drawStateGrid();
}

function drawStateGrid() {
  const idx = app.index;
  if (!idx) return;
  const q = $('#state-filter').value.trim().toLowerCase();
  const max = Math.max(...idx.states.map(s => s.count));
  const list = idx.states
    .filter(s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q)
    .sort((a, b) => statesSort === 'count' ? b.count - a.count : a.name.localeCompare(b.name));

  $('#state-grid').innerHTML = list.map(s => `
    <a class="state-card" href="#/state/${s.code}">
      <div class="sc-top"><h3>${esc(s.name)}</h3><span class="code">${s.code}</span></div>
      <div class="count">${fmt(s.count)}<small>hospitals</small></div>
      <div class="bar"><i style="width:${Math.max(4, Math.round(s.count / max * 100))}%"></i></div>
      <p class="cities">${esc((s.topCities || []).slice(0, 4).map(c => c.city).join(' · '))}</p>
    </a>`).join('') || '<div class="empty"><p>No state matches that search.</p></div>';
}

/* ------------------------------------------------------------------ state view */
async function renderState(codeOrSlug) {
  const list = $('#hosp-list');
  list.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join('');

  let idx;
  try { idx = await loadIndex(); } catch { list.innerHTML = '<div class="empty"><p>The directory is being rebuilt — please check back shortly.</p></div>'; return; }

  const meta = idx.states.find(s => s.code === codeOrSlug.toUpperCase() || s.slug === codeOrSlug.toLowerCase());
  if (!meta) { location.hash = '#/states'; return; }

  document.title = `Hospitals in ${meta.name} — byoutoyou`;
  $('#state-crumb').textContent = meta.name;
  $('#state-title').textContent = `Hospitals in ${meta.name}`;
  $('#state-sub').textContent = `${fmt(meta.count)} hospitals in ${fmt(meta.cities)} cities · CMS data, updated ${idx.generated}`;
  $('#state-kpis').innerHTML = `
    <div><b>${fmt(meta.count)}</b><span>hospitals</span></div>
    <div><b>${fmt(meta.emergency)}</b><span>with ER</span></div>
    <div><b>${fmt(meta.topRated || 0)}</b><span>rated 4★+</span></div>`;

  const recent = store.get('byt_recent_states', []).filter(c => c !== meta.code);
  recent.unshift(meta.code);
  store.set('byt_recent_states', recent.slice(0, 8));

  let data;
  try { data = await loadState(meta.code); }
  catch { list.innerHTML = '<div class="empty"><p>Could not load this state right now.</p></div>'; return; }
  app.current = data;
  renderInsights();

  const cities = [...new Set(data.hospitals.map(h => h.city))].sort();
  const types = [...new Set(data.hospitals.map(h => h.type).filter(Boolean))].sort();
  const owners = [...new Set(data.hospitals.map(h => h.ownership).filter(Boolean))].sort();
  fillSelect($('#filter-city'), cities, 'All cities');
  fillSelect($('#filter-type'), types, 'All types');
  fillSelect($('#filter-owner'), owners, 'All ownership');

  applyFilters();
}

function fillSelect(sel, values, allLabel) {
  sel.innerHTML = `<option value="">${allLabel}</option>` + values.map(v => `<option>${esc(v)}</option>`).join('');
}

function applyFilters() {
  if (!app.current) return;
  const q = $('#hosp-search').value.trim().toLowerCase();
  const city = $('#filter-city').value;
  const type = $('#filter-type').value;
  const owner = $('#filter-owner').value;
  const erOnly = $('#filter-er').checked;
  const ratedOnly = $('#filter-rated').checked;
  const liveOnly = $('#filter-live').checked;
  const sort = $('#sort-hosp').value;

  let rows = app.current.hospitals.filter(h => {
    if (city && h.city !== city) return false;
    if (type && h.type !== type) return false;
    if (owner && h.ownership !== owner) return false;
    if (erOnly && !h.emergency) return false;
    if (ratedOnly && !(h.rating >= 4)) return false;
    if (liveOnly && !isCovered(h)) return false;
    if (q) {
      const hay = `${h.name} ${h.city} ${h.zip} ${h.county}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sort === 'distance' && app.coords) {
    rows = rows.map(h => ({ ...h, _d: h.lat ? milesBetween(app.coords.lat, app.coords.lon, h.lat, h.lon) : Infinity }))
      .sort((a, b) => a._d - b._d);
  } else if (sort === 'rating') {
    rows.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
  } else if (sort === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    rows.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  }

  app.filtered = rows;
  app.page = 0;
  $('#result-count').textContent = rows.length === app.current.hospitals.length
    ? `Showing all ${fmt(rows.length)} hospitals`
    : `${fmt(rows.length)} of ${fmt(app.current.hospitals.length)} hospitals match`;
  $('#hosp-list').innerHTML = '';
  renderPage();
}

function renderPage() {
  const start = app.page * PAGE_SIZE;
  const slice = app.filtered.slice(start, start + PAGE_SIZE);
  if (!slice.length && app.page === 0) {
    $('#hosp-list').innerHTML = '<div class="empty"><p>No hospital matches these filters. Try clearing a filter or widening the search.</p></div>';
    $('#load-more').hidden = true;
    return;
  }
  $('#hosp-list').insertAdjacentHTML('beforeend', slice.map(hospCard).join(''));
  app.page++;
  $('#load-more').hidden = app.page * PAGE_SIZE >= app.filtered.length;
}

function stars(rating) {
  return rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
}

function isSaved(id) {
  return store.get('byt_saved', []).some(h => h.id === id);
}

function hospCard(h) {
  const state = h.state || app.current?.code || '';
  const covered = isCovered(h);
  return `
  <article class="hosp" data-id="${esc(h.id)}" data-state="${esc(state)}">
    <div class="hosp-top">
      <div>
        <h3 data-open-hospital>${esc(h.name)}</h3>
        <p class="where">${esc(h.city)}${h.zip ? ', ' + esc(h.zip) : ''}${h.county ? ' · ' + esc(h.county) + ' County' : ''}</p>
      </div>
    </div>
    <div class="hosp-tags">
      ${covered
      ? `<span class="tag live" title="Professionals based near this hospital">Local pros</span>`
      : `<span class="tag soon" title="No professional lives near this hospital yet">Waitlist</span>`}
      ${h.emergency ? '<span class="tag er">ER 24/7</span>' : ''}
      ${h.rating ? `<span class="tag star">${stars(h.rating)} CMS</span>` : ''}
      ${h.type ? `<span class="tag">${esc(h.type.replace(/ Hospitals?$/i, ''))}</span>` : ''}
      ${h._d !== undefined && h._d !== Infinity ? `<span class="tag dist">${h._d.toFixed(0)} mi</span>` : ''}
    </div>
    <div class="hosp-actions">
      <button class="btn btn-primary btn-sm" data-book>${covered ? 'Request a visit' : 'Join the waitlist'}</button>
      <button class="mini ${isSaved(h.id) ? 'on' : ''}" data-save aria-label="Save hospital" title="Save">
        <svg viewBox="0 0 24 24"><path d="M6 4h12v16l-6-4-6 4z"/></svg>
      </button>
      <button class="mini" data-compare aria-label="Add to comparison" title="Compare">
        <svg viewBox="0 0 24 24"><path d="M4 6h7M4 12h7M4 18h7M15 6h5M15 12h5M15 18h5"/></svg>
      </button>
    </div>
  </article>`;
}

function findHospital(id, stateCode) {
  const st = app.states.get((stateCode || '').toUpperCase()) || app.current;
  return st?.hospitals.find(h => h.id === id) || null;
}

/* ------------------------------------------------------------------ drawer */
function openHospital(id, stateCode) {
  const h = findHospital(id, stateCode);
  if (!h) return;
  const state = stateCode || app.current?.code || '';
  const mapsQ = encodeURIComponent(`${h.name}, ${h.address}, ${h.city}, ${state} ${h.zip}`);
  $('#drawer-body').innerHTML = `
    <h2 class="d-name" id="drawer-title">${esc(h.name)}</h2>
    <p class="d-sub">${esc(h.address || '')}${h.address ? ', ' : ''}${esc(h.city)}, ${esc(state)} ${esc(h.zip || '')}</p>
    <div class="d-tags">
      ${isCovered(h) ? '<span class="tag live">Local pros</span>' : '<span class="tag soon">Waitlist only</span>'}
      ${h.emergency ? '<span class="tag er">Emergency services</span>' : '<span class="tag">No ER</span>'}
      ${h.rating ? `<span class="tag star">${stars(h.rating)} CMS ${h.rating}/5</span>` : '<span class="tag">Not rated</span>'}
    </div>
    <p class="d-coverage ${isCovered(h) ? 'on' : ''}">${coverageLine(h)}</p>
    <div class="d-links">
      ${h.phone ? `<a class="btn btn-ghost btn-sm" href="tel:${esc(h.phone)}">${esc(phoneFmt(h.phone))}</a>` : ''}
      <a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}" target="_blank" rel="noopener">Directions</a>
    </div>
    <div class="d-facts">
      <div><span>Hospital type</span><b>${esc(h.type || '—')}</b></div>
      <div><span>Ownership</span><b>${esc(h.ownership || '—')}</b></div>
      <div><span>County</span><b>${esc(h.county || '—')}</b></div>
      <div><span>CMS facility ID</span><b>${esc(h.id || '—')}</b></div>
    </div>
    ${h.rating ? `<p class="d-note" style="margin-top:0;border:0;padding-top:0">CMS rates this hospital ${ratingVerdict(h)}</p>` : ''}
    <button class="btn btn-primary btn-block" data-book-drawer>${isCovered(h) ? 'Request a bedside visit here' : 'Join the waitlist for this hospital'}</button>
    <div class="d-actions-row">
      <button class="btn btn-ghost btn-sm" data-save-drawer>${isSaved(h.id) ? 'Saved ✓' : 'Save'}</button>
      <button class="btn btn-ghost btn-sm" data-share-drawer>Share</button>
      <button class="btn btn-ghost btn-sm" data-sheet-drawer>Sheet for the nurse</button>
    </div>
    ${(() => {
      const near = nearbyHospitals(h);
      return near.length ? `<div class="nearby"><h4>Other hospitals within 25 miles</h4>
        ${near.map(n => `<a href="#" data-near-id="${esc(n.id)}">${esc(n.name)}<span>${n.d.toFixed(0)} mi</span></a>`).join('')}</div>` : '';
    })()}
    <p class="d-note">Hospital details come from the public CMS Hospital General Information dataset. byoutoyou is an independent
      personal-care service and is not affiliated with, or endorsed by, this hospital. Visits always depend on the unit's approval.</p>`;

  $('#drawer').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#drawer [data-book-drawer]').onclick = () => { closeDrawer(); openBooking(h, state); };
  $('#drawer [data-save-drawer]').onclick = e => { toggleSave(h, state); e.target.textContent = isSaved(h.id) ? 'Saved ✓' : 'Save'; };
  $('#drawer [data-share-drawer]').onclick = () => shareHospital(h, state);
  $('#drawer [data-sheet-drawer]').onclick = () => { closeDrawer(); openHandoff({ ...h, state }, store.get('byt_requests', [])[0]); };
  $$('#drawer [data-near-id]').forEach(a => a.onclick = e => {
    e.preventDefault();
    openHospital(a.dataset.nearId, state);
  });
}

function closeDrawer() {
  $('#drawer').hidden = true;
  document.body.style.overflow = '';
}

/* ------------------------------------------------------------------ save / compare */
function toggleSave(h, stateCode) {
  const saved = store.get('byt_saved', []);
  const i = saved.findIndex(s => s.id === h.id);
  if (i >= 0) { saved.splice(i, 1); toast('Removed from saved'); }
  else {
    saved.unshift({ id: h.id, name: h.name, city: h.city, state: stateCode || app.current?.code || '', rating: h.rating, emergency: h.emergency, zip: h.zip, county: h.county, type: h.type, ownership: h.ownership, phone: h.phone, address: h.address });
    toast('Saved to your list');
  }
  store.set('byt_saved', saved);
  $$(`.hosp[data-id="${CSS.escape(h.id)}"] [data-save]`).forEach(b => b.classList.toggle('on', isSaved(h.id)));
}

function toggleCompare(h, stateCode) {
  const i = app.compare.findIndex(c => c.id === h.id);
  if (i >= 0) app.compare.splice(i, 1);
  else {
    if (app.compare.length >= 3) { toast('Compare up to three hospitals'); return; }
    app.compare.push({ ...h, state: stateCode || app.current?.code || '' });
  }
  renderTray();
}

function renderTray() {
  const tray = $('#compare-tray');
  tray.hidden = app.compare.length === 0;
  $('#tray-items').innerHTML = app.compare.map(h =>
    `<span class="tray-chip">${esc(h.name)}<button data-untray="${esc(h.id)}" aria-label="Remove">×</button></span>`).join('');
}

function openCompare() {
  if (app.compare.length < 2) { toast('Add at least two hospitals'); return; }
  const rows = [
    ['City', h => `${h.city}, ${h.state}`],
    ['Emergency services', h => h.emergency ? 'Yes — 24/7' : 'No'],
    ['CMS star rating', h => h.rating ? `${stars(h.rating)} (${h.rating}/5)` : 'Not rated'],
    ['Hospital type', h => h.type || '—'],
    ['Ownership', h => h.ownership || '—'],
    ['County', h => h.county || '—'],
    ['Phone', h => phoneFmt(h.phone) || '—']
  ];
  $('#compare-table').innerHTML = `
    <thead><tr><th></th>${app.compare.map(h => `<th>${esc(h.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, fn]) =>
      `<tr><td><b>${label}</b></td>${app.compare.map(h => `<td>${esc(fn(h))}</td>`).join('')}</tr>`).join('')}
      <tr><td></td>${app.compare.map(h => `<td><button class="btn btn-primary btn-sm" data-book-compare="${esc(h.id)}">Request a visit</button></td>`).join('')}</tr>
    </tbody>`;
  $('#compare-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

/* ------------------------------------------------------------------ saved view */
function renderSaved() {
  const saved = store.get('byt_saved', []);
  $('#saved-empty').hidden = saved.length > 0;
  $('#saved-list').innerHTML = saved.map(h => hospCard(h)).join('');

  const reqs = store.get('byt_requests', []);
  $('#request-list').innerHTML = reqs.length ? reqs.map(r => `
    <article class="request">
      <div class="r-top"><h4>${esc(r.hospital)}${r.waitlist ? ' <span class="tag soon">waitlist</span>' : ''}</h4><span class="r-when">${esc(r.created)}</span></div>
      <p class="r-services">${esc(r.services)} · ${esc(r.date)} · ${esc(r.window)}</p>
      <p class="r-services">Patient: ${esc(r.patient)}${r.room ? ' · ' + esc(r.room) : ''} · Total $${r.total}</p>
    </article>`).join('')
    : '<p class="result-count">No visit requests yet.</p>';
}

/* ------------------------------------------------------------------ palette */
let paletteRows = [], paletteSel = 0, paletteMode = 'search';

async function openPalette(mode = 'search') {
  paletteMode = mode;
  $('#palette').hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $('#palette-q');
  input.value = '';
  input.placeholder = mode === 'near' ? 'Filter the hospitals near you…' : 'Hospital name, city or ZIP…';
  $('#palette-results').innerHTML = '<div class="p-empty">Loading the hospital index…</div>';
  input.focus();
  try {
    await loadSearch();
    paletteQuery('');
  } catch {
    $('#palette-results').innerHTML = '<div class="p-empty">The directory is being rebuilt — please try again shortly.</div>';
  }
}

function closePalette() {
  $('#palette').hidden = true;
  document.body.style.overflow = '';
}

function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return esc(text);
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
}

function paletteQuery(raw) {
  const q = raw.trim().toLowerCase();
  const all = app.search || [];
  let rows;

  if (paletteMode === 'near' && app.coords) {
    rows = all.filter(h => h.lat != null)
      .map(h => ({ ...h, d: milesBetween(app.coords.lat, app.coords.lon, h.lat, h.lon) }))
      .filter(h => !q || h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q))
      .sort((a, b) => a.d - b.d)
      .slice(0, 25);
  } else if (!q) {
    rows = all.filter(h => h.rating >= 5).slice(0, 12);
  } else {
    const starts = [], contains = [];
    for (const h of all) {
      const name = h.name.toLowerCase(), city = h.city.toLowerCase();
      if (name.startsWith(q) || city.startsWith(q)) starts.push(h);
      else if (name.includes(q) || city.includes(q) || String(h.id).startsWith(q)) contains.push(h);
      if (starts.length + contains.length > 400) break;
    }
    rows = [...starts, ...contains].slice(0, 30);
  }

  paletteRows = rows;
  paletteSel = 0;
  const label = paletteMode === 'near' ? 'nearest to you' : (q ? 'matches' : 'top-rated hospitals');
  $('#palette-count').textContent = rows.length ? `${rows.length} ${label}` : '';
  $('#palette-results').innerHTML = rows.length ? rows.map((h, i) => `
    <button class="p-item ${i === 0 ? 'sel' : ''}" data-i="${i}">
      <span class="pi-main">
        <strong>${highlight(h.name, q)}</strong>
        <small>${highlight(h.city, q)}, ${esc(h.state)}${h.d != null ? ` · ${h.d.toFixed(0)} mi` : ''}${h.rating ? ` · ${stars(h.rating)}` : ''}</small>
      </span>
      ${h.emergency ? '<span class="tag er">ER</span>' : ''}
    </button>`).join('')
    : '<div class="p-empty">No hospital matches that. Try a city, a ZIP, or part of the name.</div>';
}

async function paletteOpen(i) {
  const h = paletteRows[i];
  if (!h) return;
  closePalette();
  location.hash = `#/state/${h.state}`;
  await loadState(h.state);
  setTimeout(() => openHospital(h.id, h.state), 260);
}

/* ------------------------------------------------------------------ near me */
function askLocation() {
  if (!navigator.geolocation) { toast('Location is not available in this browser'); return; }
  toast('Finding hospitals near you…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      app.coords = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) };
      store.set('byt_coords', app.coords);
      openPalette('near');
    },
    () => toast('Could not get your location — search by name instead'),
    { timeout: 8000, maximumAge: 600000 }
  );
}

/* ------------------------------------------------------------------ booking */
function openBooking(h, stateCode) {
  app.bookingHospital = h ? { ...h, state: stateCode || h.state || app.current?.code || '' } : null;
  app.bookingStep = 1;
  $('#booking').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#booking-form').hidden = false;
  $('#booking-done').hidden = true;
  const covered = app.bookingHospital ? isCovered(app.bookingHospital) : false;
  app.bookingWaitlist = !!app.bookingHospital && !covered;
  $('#booking-title').textContent = app.bookingWaitlist ? 'Join the waitlist' : 'Request a bedside visit';
  $('#booking-hospital').innerHTML = app.bookingHospital
    ? `${esc(app.bookingHospital.name)} · ${esc(app.bookingHospital.city)}, ${esc(app.bookingHospital.state)}
       <br><span class="${covered ? 'cov-on' : 'cov-off'}">${coverageLine(app.bookingHospital)}</span>`
    : 'General enquiry — we will help you find the hospital';
  $('#bk-submit').textContent = app.bookingWaitlist ? 'Join the waitlist' : 'Send request';
  $('#service-picker').innerHTML = SERVICES.map(s => `
    <label class="sp"><input type="checkbox" value="${s.id}"><span>${esc(s.name)}</span><span class="sp-price">$${s.price}</span></label>`).join('');
  const d = new Date(Date.now() + 864e5);
  $('#bk-date').value = d.toISOString().slice(0, 10);
  $('#bk-date').min = new Date().toISOString().slice(0, 10);
  showBookingStep(1);
}

function closeBooking() {
  $('#booking').hidden = true;
  document.body.style.overflow = '';
}

function showBookingStep(n) {
  app.bookingStep = n;
  $$('.bk-step').forEach(f => { f.hidden = Number(f.dataset.step) !== n; });
  $$('.steps-dots i').forEach((d, i) => d.classList.toggle('on', i < n));
  $('#bk-back').hidden = n === 1;
  $('#bk-next').hidden = n === 3;
  $('#bk-submit').hidden = n !== 3;
  if (n === 3) renderBookingSummary();
}

function chosenServices() {
  return $$('#service-picker input:checked').map(i => SERVICES.find(s => s.id === i.value)).filter(Boolean);
}

function renderBookingSummary() {
  const picked = chosenServices();
  const total = picked.reduce((sum, s) => sum + s.price, 0);
  $('#bk-summary').innerHTML = `
    <div><span>Hospital</span><b>${esc(app.bookingHospital?.name || 'To be confirmed')}</b></div>
    <div><span>Services</span><b>${picked.length ? esc(picked.map(s => s.name).join(', ')) : '—'}</b></div>
    <div><span>When</span><b>${esc($('#bk-date').value)} · ${esc($('#bk-window').value)}</b></div>
    <div><span>Frequency</span><b>${esc($('#bk-repeat').value)}</b></div>
    <div><span>Language</span><b>${esc($('#bk-lang').value.trim() || 'English')}</b></div>
    <div class="total"><span>Estimated total${/week/i.test($('#bk-repeat').value) ? ' per visit' : ''}</span><b>$${total}</b></div>`;
}

function validateStep(n) {
  let ok = true;
  const need = n === 1 ? [] : n === 2 ? ['#bk-patient'] : ['#bk-name', '#bk-email', '#bk-phone'];
  need.forEach(sel => {
    const el = $(sel);
    const bad = !el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
    el.classList.toggle('err', bad);
    if (bad) ok = false;
  });
  if (n === 1 && !chosenServices().length) { toast('Pick at least one service'); ok = false; }
  if (!ok && need.length) toast('Please complete the highlighted fields');
  return ok;
}

function submitBooking(e) {
  e.preventDefault();
  if (!validateStep(3)) return;
  const picked = chosenServices();
  const total = picked.reduce((sum, s) => sum + s.price, 0);
  const h = app.bookingHospital;
  const req = {
    hospital: h ? `${h.name} — ${h.city}, ${h.state}` : 'Hospital to be confirmed',
    services: picked.map(s => s.name).join(', '),
    date: $('#bk-date').value,
    window: $('#bk-window').value,
    repeat: $('#bk-repeat').value,
    language: $('#bk-lang').value.trim() || 'English',
    patient: $('#bk-patient').value.trim(),
    room: $('#bk-room').value.trim(),
    notes: $('#bk-notes').value.trim(),
    name: $('#bk-name').value.trim(),
    relationship: $('#bk-rel').value,
    email: $('#bk-email').value.trim(),
    phone: $('#bk-phone').value.trim(),
    total,
    waitlist: !!app.bookingWaitlist,
    created: new Date().toISOString().slice(0, 10)
  };

  const reqs = store.get('byt_requests', []);
  reqs.unshift(req);
  store.set('byt_requests', reqs.slice(0, 30));

  const market = h ? marketFor(h) : null;
  const radius = market?.radiusMiles || app.coverage?.defaultRadiusMiles || 35;
  const body = [
    app.bookingWaitlist ? 'WAITLIST REQUEST — no local professional covers this hospital yet.' : '',
    `Hospital: ${req.hospital}`,
    h?.zip ? `Hospital ZIP: ${h.zip}` : '',
    h?.phone ? `Hospital phone: ${phoneFmt(h.phone)}` : '',
    market
      ? `Assign from: ${market.name} — a professional based within ${radius} miles of this hospital.`
      : `Assign from: the hospital's own area only. Do not assign a professional from another state or region.`,
    `Services: ${req.services}`,
    `Estimated total: $${req.total}`,
    `Preferred: ${req.date}, ${req.window}`,
    `Frequency: ${req.repeat}`,
    `Language needed: ${req.language}`,
    '',
    `Patient: ${req.patient}`,
    `Unit / room: ${req.room || '—'}`,
    `Notes: ${req.notes || '—'}`,
    '',
    `Requested by: ${req.name} (${req.relationship})`,
    `Email: ${req.email}`,
    `Phone: ${req.phone}`
  ].filter(Boolean).join('\n');

  const subject = (app.bookingWaitlist ? 'Waitlist — ' : 'Bedside visit request — ') + req.hospital;
  $('#done-mail').href = `mailto:care@byoutoyou.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $('#done-text').textContent = app.bookingWaitlist
    ? `You are on the list for ${req.hospital}. Send it over and we will tell you the moment a vetted professional near that hospital joins — we will not send anyone in from another area.`
    : `We have your request for ${req.hospital}. Send it to our coordination team and we will call the unit within one business day.`;
  $('#done-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(body); toast('Request copied'); }
    catch { toast('Copy failed — select the text manually'); }
  };
  if (app.bookingWaitlist && h) {
    const alt = nearestCovered(h);
    if (alt.length) {
      $('#done-text').textContent += ` The closest hospitals we already cover: `
        + alt.map(a => `${a.name} (${a.city}, ${a.state}, ${a.d.toFixed(0)} mi)`).join('; ') + '.';
    }
  }
  $('#booking-form').hidden = true;
  $('#booking-done').hidden = false;
}


/* ================================================================ features
   Ten things the directory earns once the data is in place: nearby hospitals,
   a rating read against the state, a sheet the family hands the nurse, gifts,
   recurring visits for long stays, language matching, sharing, the pro
   application that feeds local coverage, waitlist follow-ups, and keyboard
   access to all of it. */

/* --- 1. nearby hospitals (same coordinates the "near me" sort uses) ------ */
function nearbyHospitals(h, miles = 25, limit = 5) {
  if (!h || h.lat == null || !app.current) return [];
  return app.current.hospitals
    .filter(o => o.id !== h.id && o.lat != null)
    .map(o => ({ ...o, d: milesBetween(h.lat, h.lon, o.lat, o.lon) }))
    .filter(o => o.d <= miles)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

/* --- 2. how a rating reads against the rest of the state ----------------- */
function stateRatingStats(stateFile) {
  const rated = (stateFile?.hospitals || []).filter(x => x.rating);
  if (!rated.length) return null;
  const avg = rated.reduce((sum, x) => sum + x.rating, 0) / rated.length;
  const dist = [1, 2, 3, 4, 5].map(n => rated.filter(x => x.rating === n).length);
  return { avg, dist, rated: rated.length };
}

function ratingVerdict(h) {
  const stats = stateRatingStats(app.current);
  if (!stats || !h.rating) return '';
  const diff = h.rating - stats.avg;
  const where = Math.abs(diff) < 0.35 ? 'about the same as' : diff > 0 ? 'above' : 'below';
  return `${h.rating}/5 — ${where} the ${esc(app.current.name)} average of ${stats.avg.toFixed(1)}.`;
}

function renderInsights() {
  const box = $('#state-insights');
  if (!box || !app.current) return;
  const list = app.current.hospitals;
  const stats = stateRatingStats(app.current);
  const covered = list.filter(isCovered).length;
  const critical = list.filter(h => /critical access/i.test(h.type || '')).length;
  const children = list.filter(h => /children/i.test(h.type || '')).length;

  const dist = stats ? `<div class="dist">${stats.dist.map((n, i) => {
    const pct = Math.round(n / Math.max(...stats.dist) * 100);
    return `<span class="col ${i >= 3 ? 'on' : ''}"><i style="height:${Math.max(2, pct)}%"></i><span>${i + 1}★</span></span>`;
  }).join('')}</div>` : '<p class="sub">CMS has not rated enough hospitals here.</p>';

  box.innerHTML = `
    <div class="insight"><h4>Where we are live</h4>
      <div class="big">${fmt(covered)}<span class="sub"> of ${fmt(list.length)}</span></div>
      <p class="sub">${covered ? 'hospitals with a local professional' : 'no local professionals here yet — waitlist open'}</p></div>
    <div class="insight"><h4>CMS ratings</h4>${dist}
      <p class="sub">${stats ? `${stats.rated} rated · average ${stats.avg.toFixed(1)}` : ''}</p></div>
    <div class="insight"><h4>Rural reach</h4>
      <div class="big">${fmt(critical)}</div>
      <p class="sub">critical-access hospitals, where a visit means the most</p></div>
    <div class="insight"><h4>Children's hospitals</h4>
      <div class="big">${fmt(children)}</div>
      <p class="sub">where we also serve the parent who has not left</p></div>`;
}

/* --- 3. the sheet the family hands the nurses' station ------------------- */
function handoffText(h, req) {
  const state = h?.state || app.current?.code || '';
  return [
    'BYOUTOYOU — BEDSIDE PERSONAL CARE VISIT',
    '',
    `Hospital: ${h ? `${h.name}, ${h.city}, ${state}` : '—'}`,
    `Patient: ${req?.patient || '—'}${req?.room ? ` · Unit/room: ${req.room}` : ''}`,
    `Requested by: ${req?.name || '—'}${req?.relationship ? ` (${req.relationship})` : ''}${req?.phone ? ` · ${req.phone}` : ''}`,
    `Service: ${req?.services || '—'}`,
    `Proposed time: ${req?.date || '—'} ${req?.window || ''}`,
    '',
    'WHAT THIS VISIT IS',
    '- Personal grooming only: hair, nails, shaving, skin comfort.',
    '- No clinical care, no advice, no handling of lines, tubing or equipment.',
    '- The patient is not moved. The professional works around the care team.',
    '',
    'THE PROFESSIONAL',
    '- Licensed in this state, background-checked, insured, and based near this hospital.',
    '- Carries photo ID and reports to the nurses’ station on arrival.',
    '- Trained on hand hygiene, isolation precautions and patient privacy.',
    '- Single-use or hospital-grade disinfected tools; the room is left as found.',
    '',
    'THE UNIT DECIDES',
    'If today is not a good day, say so and the visit is rescheduled at no cost.',
    '',
    'Coordination: care@byoutoyou.com'
  ].join('\n');
}

function openHandoff(h, req) {
  const state = h?.state || app.current?.code || '';
  $('#sheet-body').innerHTML = `
    <div class="sheet">
      <h3>Bedside personal care visit</h3>
      <p class="sheet-meta">byoutoyou · ${h ? `${esc(h.name)}, ${esc(h.city)}, ${esc(state)}` : ''} · prepared ${new Date().toISOString().slice(0, 10)}</p>
      <div class="sheet-block"><h4>The visit</h4>
        <p><b>Patient:</b> ${esc(req?.patient || '—')}${req?.room ? ` · <b>Unit/room:</b> ${esc(req.room)}` : ''}</p>
        <p><b>Service:</b> ${esc(req?.services || '—')}</p>
        <p><b>Proposed time:</b> ${esc(req?.date || '—')} ${esc(req?.window || '')}</p>
        <p><b>Requested by:</b> ${esc(req?.name || '—')}${req?.phone ? ` · ${esc(req.phone)}` : ''}</p></div>
      <div class="sheet-block"><h4>What this visit is</h4><ul>
        <li>Personal grooming only — hair, nails, shaving, skin comfort.</li>
        <li>No clinical care, no advice, no handling of lines, tubing or equipment.</li>
        <li>The patient is not moved; the professional works around the care team.</li></ul></div>
      <div class="sheet-block"><h4>The professional</h4><ul>
        <li>Licensed in this state, background-checked, insured, based near this hospital.</li>
        <li>Photo ID shown at the nurses’ station on arrival.</li>
        <li>Trained on hand hygiene, isolation precautions and patient privacy.</li>
        <li>Single-use or hospital-grade disinfected tools; room left as found.</li></ul></div>
      <div class="sheet-block"><h4>The unit decides</h4>
        <p>If today is not a good day, say so — the visit is rescheduled at no cost. Coordination: care@byoutoyou.com</p></div>
      <div class="sheet-sign"><div>Care team member</div><div>Date / time approved</div></div>
    </div>`;
  openModal('#sheet-modal');
  $('#sheet-print').onclick = () => window.print();
  $('#sheet-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(handoffText(h, req)); toast('Sheet copied'); }
    catch { toast('Copy failed'); }
  };
}

/* --- 4. gift a visit ----------------------------------------------------- */
const GIFT_AMOUNTS = [55, 75, 95, 130];

function openGift() {
  $('#gift-amounts').innerHTML = GIFT_AMOUNTS.map((a, i) => `
    <label class="sp"><input type="radio" name="gift-amount" value="${a}" ${i === 2 ? 'checked' : ''}>
      <span>$${a}</span><span class="sp-price">${a === 55 ? 'a shave' : a === 75 ? 'a haircut' : a === 95 ? 'cut + wash' : 'braids'}</span></label>`).join('');
  $('#gift-form').hidden = false;
  $('#gift-done').hidden = true;
  openModal('#gift-modal');
}

function submitGift(e) {
  e.preventDefault();
  const to = $('#gift-to').value.trim(), email = $('#gift-email').value.trim(), from = $('#gift-from').value.trim();
  if (!to || !from || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Please complete the highlighted fields'); return; }
  const amount = $('input[name="gift-amount"]:checked')?.value || 95;
  const note = $('#gift-note').value.trim() || 'Thinking of you. Let someone make you feel like yourself today.';
  const body = [
    `${to},`, '',
    note, '',
    `${from} has covered a $${amount} bedside visit for you through byoutoyou.`,
    'Pick the hospital, the service and the day at https://byoutoyou.com — the professional who comes is based near that hospital.',
    '', `Gift reference: GIFT-${amount}-${Date.now().toString(36).toUpperCase()}`
  ].join('\n');
  $('#gift-mail').href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${from} sent you a bedside visit`)}&body=${encodeURIComponent(body)}`;
  $('#gift-done-text').textContent = `A $${amount} visit for ${to}. Send it now, and we will invoice you only when it is used.`;
  $('#gift-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(body); toast('Message copied'); } catch { toast('Copy failed'); }
  };
  $('#gift-form').hidden = true;
  $('#gift-done').hidden = false;
  const gifts = store.get('byt_gifts', []);
  gifts.unshift({ to, email, amount, created: new Date().toISOString().slice(0, 10) });
  store.set('byt_gifts', gifts.slice(0, 20));
}

/* --- 5. the professional application that fills coverage ----------------- */
function openPro() {
  $('#pro-services').innerHTML = SERVICES.slice(0, 8).map(s =>
    `<label class="sp"><input type="checkbox" value="${s.id}"><span>${esc(s.name)}</span></label>`).join('');
  $('#pro-form').hidden = false;
  $('#pro-done').hidden = true;
  openModal('#pro-modal');
}

function submitPro(e) {
  e.preventDefault();
  const need = ['#pro-name', '#pro-license', '#pro-zip', '#pro-email', '#pro-phone'];
  let ok = true;
  need.forEach(sel => {
    const el = $(sel);
    const bad = !el.value.trim() || (el.id === 'pro-zip' && !/^\d{5}$/.test(el.value.trim()))
      || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
    el.classList.toggle('err', bad);
    if (bad) ok = false;
  });
  if (!ok) { toast('Please complete the highlighted fields'); return; }
  const services = $$('#pro-services input:checked').map(i => SERVICES.find(s => s.id === i.value)?.name).filter(Boolean);
  const body = [
    `Name: ${$('#pro-name').value.trim()}`,
    `State licence: ${$('#pro-license').value.trim()}`,
    `Home ZIP: ${$('#pro-zip').value.trim()}`,
    `Travel radius: ${$('#pro-radius').value}`,
    `Services: ${services.join(', ') || '—'}`,
    `Languages: ${$('#pro-langs').value.trim() || '—'}`,
    `Experience: ${$('#pro-years').value.trim() || '—'} years`,
    `Email: ${$('#pro-email').value.trim()}`,
    `Phone: ${$('#pro-phone').value.trim()}`,
    '',
    'I understand visits are offered only inside my declared radius.'
  ].join('\n');
  $('#pro-mail').href = `mailto:pros@byoutoyou.com?subject=${encodeURIComponent('Professional application — ZIP ' + $('#pro-zip').value.trim())}&body=${encodeURIComponent(body)}`;
  $('#pro-done-text').textContent = `We will verify your licence and insurance, then open the hospitals within ${$('#pro-radius').value} of ${$('#pro-zip').value.trim()}.`;
  $('#pro-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(body); toast('Application copied'); } catch { toast('Copy failed'); }
  };
  $('#pro-form').hidden = true;
  $('#pro-done').hidden = false;
}

/* --- 6. share a hospital ------------------------------------------------- */
async function shareHospital(h, state) {
  const url = `${location.origin}/#/hospital/${state}/${h.id}`;
  const text = `${h.name} — ${h.city}, ${state}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'byoutoyou', text, url }); return; } catch { /* dismissed */ }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch { toast(url); }
}

/* --- 7-10 are wired into the flows: recurring visits and language live in
   the booking form, the waitlist suggests covered hospitals nearby, and the
   keyboard map is bound in bindExtraKeys(). ------------------------------- */

function openModal(sel) {
  $(sel).hidden = false;
  document.body.style.overflow = 'hidden';
  const focusable = $(sel).querySelector('input,select,textarea,button:not(.modal-close)');
  if (focusable) setTimeout(() => focusable.focus(), 30);
}

function nearestCovered(h, limit = 3) {
  if (!app.search || !h || h.lat == null) return [];
  return app.search
    .filter(o => o.lat != null && isCovered(o))
    .map(o => ({ ...o, d: milesBetween(h.lat, h.lon, o.lat, o.lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ theme */
function initTheme() {
  const saved = store.get('byt_theme', null);
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = saved || (prefersDark ? 'dark' : 'light');
}

/* ------------------------------------------------------------------ events */
function bindEvents() {
  window.addEventListener('hashchange', route);

  document.addEventListener('click', e => {
    const t = e.target;

    if (t.closest('[data-open-search]')) { e.preventDefault(); openPalette('search'); }
    if (t.closest('[data-close-search]')) closePalette();
    if (t.closest('[data-near-me]')) { e.preventDefault(); askLocation(); }
    if (t.closest('[data-close-drawer]')) closeDrawer();
    if (t.closest('[data-close-booking]')) closeBooking();
    if (t.closest('[data-close-compare]')) { $('#compare-modal').hidden = true; document.body.style.overflow = ''; }
    if (t.closest('[data-open-booking]')) openBooking(app.bookingHospital, app.bookingHospital?.state);
    if (t.closest('[data-open-pro]')) { e.preventDefault(); openPro(); }
    if (t.closest('[data-open-gift]')) { e.preventDefault(); openGift(); }
    if (t.closest('[data-open-keys]')) { e.preventDefault(); openModal('#keys-modal'); }
    if (t.closest('[data-close-modal]')) {
      t.closest('.modal').hidden = true;
      document.body.style.overflow = '';
    }
    if (t.closest('[data-open-partner]')) {
      location.href = 'mailto:partners@byoutoyou.com?subject=' + encodeURIComponent('Vendor credentialing pack request');
    }

    if (t.closest('[data-toggle-theme]')) {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('byt_theme', next);
    }
    if (t.closest('[data-toggle-nav]')) {
      const nav = $('.mobile-nav');
      nav.hidden = !nav.hidden;
      t.closest('[data-toggle-nav]').setAttribute('aria-expanded', String(!nav.hidden));
    }
    if (t.closest('.mobile-nav a')) $('.mobile-nav').hidden = true;

    const pItem = t.closest('.p-item');
    if (pItem) paletteOpen(Number(pItem.dataset.i));

    const card = t.closest('.hosp');
    if (card) {
      const id = card.dataset.id, stateCode = card.dataset.state;
      const h = findHospital(id, stateCode) || store.get('byt_saved', []).find(s => s.id === id);
      if (!h) return;
      if (t.closest('[data-open-hospital]')) openHospital(id, stateCode);
      else if (t.closest('[data-book]')) openBooking(h, stateCode);
      else if (t.closest('[data-save]')) toggleSave(h, stateCode);
      else if (t.closest('[data-compare]')) toggleCompare(h, stateCode);
    }

    const untray = t.closest('[data-untray]');
    if (untray) {
      app.compare = app.compare.filter(c => c.id !== untray.dataset.untray);
      renderTray();
    }
    if (t.closest('#tray-open')) openCompare();
    if (t.closest('#tray-clear')) { app.compare = []; renderTray(); }

    const bookCmp = t.closest('[data-book-compare]');
    if (bookCmp) {
      const h = app.compare.find(c => c.id === bookCmp.dataset.bookCompare);
      $('#compare-modal').hidden = true;
      if (h) openBooking(h, h.state);
    }
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette('search'); return; }
    if (e.key === 'Escape') {
      if (!$('#palette').hidden) closePalette();
      else if (!$('#drawer').hidden) closeDrawer();
      else if (!$('#booking').hidden) closeBooking();
      else {
        const open = $$('.modal').find(m => !m.hidden);
        if (open) { open.hidden = true; document.body.style.overflow = ''; }
      }
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === '/') { e.preventDefault(); openPalette('search'); return; }
      if (e.key === '?') { e.preventDefault(); openModal('#keys-modal'); return; }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); askLocation(); return; }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); location.hash = '#/saved'; return; }
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); location.hash = '#/states'; return; }
    }
    if (!$('#palette').hidden && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Enter') { paletteOpen(paletteSel); return; }
      paletteSel = Math.max(0, Math.min(paletteRows.length - 1, paletteSel + (e.key === 'ArrowDown' ? 1 : -1)));
      $$('.p-item').forEach((el, i) => el.classList.toggle('sel', i === paletteSel));
      $('.p-item.sel')?.scrollIntoView({ block: 'nearest' });
    }
  });

  let qt;
  $('#palette-q').addEventListener('input', e => {
    clearTimeout(qt);
    const v = e.target.value;
    qt = setTimeout(() => paletteQuery(v), 90);
  });

  $('#state-filter').addEventListener('input', drawStateGrid);
  $$('[data-sort-states]').forEach(b => b.addEventListener('click', () => {
    statesSort = b.dataset.sortStates;
    $$('[data-sort-states]').forEach(x => x.classList.toggle('active', x === b));
    drawStateGrid();
  }));

  ['#hosp-search', '#filter-city', '#filter-type', '#filter-owner', '#filter-er', '#filter-rated', '#filter-live', '#sort-hosp']
    .forEach(sel => {
      const el = $(sel);
      const evt = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        if (sel === '#sort-hosp' && el.value === 'distance' && !app.coords) {
          askLocationForSort();
          return;
        }
        applyFilters();
      });
    });

  $('#clear-filters').addEventListener('click', () => {
    $('#hosp-search').value = '';
    ['#filter-city', '#filter-type', '#filter-owner'].forEach(s => { $(s).value = ''; });
    $('#filter-er').checked = false;
    $('#filter-rated').checked = false;
    $('#filter-live').checked = false;
    $('#sort-hosp').value = 'city';
    applyFilters();
  });

  $('#load-more').addEventListener('click', renderPage);

  $('#bk-next').addEventListener('click', () => { if (validateStep(app.bookingStep)) showBookingStep(app.bookingStep + 1); });
  $('#bk-back').addEventListener('click', () => showBookingStep(app.bookingStep - 1));
  $('#booking-form').addEventListener('submit', submitBooking);
  $('#pro-form').addEventListener('submit', submitPro);
  $('#gift-form').addEventListener('submit', submitGift);
  ['#bk-repeat', '#bk-lang'].forEach(sel => $(sel).addEventListener('change', () => {
    if (app.bookingStep === 3) renderBookingSummary();
  }));
  $('#service-picker').addEventListener('change', () => { if (app.bookingStep === 3) renderBookingSummary(); });
}

function askLocationForSort() {
  if (!navigator.geolocation) { toast('Location is not available'); $('#sort-hosp').value = 'city'; return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      app.coords = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) };
      store.set('byt_coords', app.coords);
      applyFilters();
    },
    () => { toast('Could not get your location'); $('#sort-hosp').value = 'city'; applyFilters(); }
  );
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  initTheme();
  renderServices();
  renderFaq();
  bindEvents();
  $('[data-year]').textContent = new Date().getFullYear();

  try { await loadIndex(); } catch { /* directory rebuilding — views degrade gracefully */ }
  await loadCoverage();
  loadSearch().catch(() => { /* only needed once search or a waitlist runs */ });
  renderStats();
  renderMap();
  await route();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
}

boot();
})();
