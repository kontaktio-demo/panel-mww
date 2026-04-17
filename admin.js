'use strict';

/* ============================================================
   MWW Admin Panel – Main Application Logic
   ============================================================ */

// ─── State ───────────────────────────────────────────────
const state = {
  token: '',
  user: null,
  offers: [],
  stats: null,
  currentPage: 'dashboard',
  editingOffer: null,
  uploadedImages: [],  // images for new offer form
};

// ─── Helpers ─────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const API = () => ADMIN_CONFIG.API_BASE_URL;
const EP = () => ADMIN_CONFIG.ENDPOINTS;

function getToken() {
  try { return sessionStorage.getItem('mww_admin_token') || ''; }
  catch { return ''; }
}
function setToken(t) {
  try { sessionStorage.setItem('mww_admin_token', t); } catch {}
  state.token = t;
}
function clearToken() {
  try { sessionStorage.removeItem('mww_admin_token'); } catch {}
  state.token = '';
  state.user = null;
}

function authHeaders() {
  return { 'Authorization': 'Bearer ' + (state.token || getToken()) };
}
function jsonAuthHeaders() {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

function formatPrice(n) {
  return new Intl.NumberFormat('pl-PL').format(n || 0);
}
function formatDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─── Toast notifications ─────────────────────────────────
function initToasts() {
  if (!$('.toast-container')) {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
}
function toast(msg, type) {
  initToasts();
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.textContent = msg;
  $('.toast-container').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}

// ─── API Calls ───────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(API() + endpoint, { headers: authHeaders() });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(API() + endpoint, {
    method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body),
  });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'HTTP ' + res.status);
  return data;
}

async function apiPatch(endpoint, body) {
  const res = await fetch(API() + endpoint, {
    method: 'PATCH', headers: jsonAuthHeaders(), body: JSON.stringify(body),
  });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'HTTP ' + res.status);
  return data;
}

async function apiDelete(endpoint) {
  const res = await fetch(API() + endpoint, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'HTTP ' + res.status);
  }
  return res.json().catch(() => ({}));
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(API() + EP().IMAGE_UPLOAD, {
    method: 'POST', headers: authHeaders(), body: fd,
  });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.image;
}

async function uploadMultipleImages(files) {
  const fd = new FormData();
  for (const f of files) fd.append('images', f);
  const res = await fetch(API() + EP().IMAGE_UPLOAD_MULTI, {
    method: 'POST', headers: authHeaders(), body: fd,
  });
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.images;
}

// ─── Auth ────────────────────────────────────────────────
function showLogin() {
  $('#loginScreen').style.display = 'flex';
  $('#app').style.display = 'none';
}

function showApp() {
  $('#loginScreen').style.display = 'none';
  $('#app').style.display = 'flex';
  if (state.user) {
    $('#currentUser').textContent = state.user.username || 'Admin';
  }
  navigateTo('dashboard');
}

async function doLogin() {
  const user = $('#loginUser').value.trim();
  const pass = $('#loginPass').value;
  const errEl = $('#loginError');
  const btn = $('#loginBtn');

  if (!user || !pass) { errEl.textContent = 'Wpisz login i hasło.'; return; }

  btn.textContent = 'Logowanie...';
  btn.disabled = true;
  errEl.textContent = '';

  try {
    const res = await fetch(API() + EP().AUTH_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.token) {
      setToken(data.token);
      state.user = data.user;
      showApp();
    } else {
      errEl.textContent = data.message || 'Nieprawidłowe dane logowania.';
    }
  } catch {
    errEl.textContent = 'Nie można połączyć się z serwerem.';
  }

  btn.textContent = 'Zaloguj się';
  btn.disabled = false;
}

async function verifySession() {
  const token = getToken();
  if (!token) return;
  state.token = token;

  try {
    const data = await apiGet(EP().AUTH_VERIFY);
    if (data.valid) {
      state.user = data.user;
      showApp();
    } else {
      clearToken();
    }
  } catch {
    // Token might still be valid, network issue
  }
}

function doLogout() {
  clearToken();
  showLogin();
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#loginError').textContent = '';
}

// ─── Navigation ──────────────────────────────────────────
function navigateTo(page) {
  state.currentPage = page;

  // Update sidebar
  $$('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Update title
  const titles = {
    dashboard: 'Dashboard',
    offers: 'Oferty',
    add: 'Dodaj ofertę',
    preview: 'Podgląd strony',
    settings: 'Ustawienia',
  };
  $('#pageTitle').textContent = titles[page] || page;

  // Close sidebar on mobile
  $('#sidebar').classList.remove('open');

  // Render page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'offers': renderOffers(); break;
    case 'add': renderAddForm(); break;
    case 'preview': renderPreview(); break;
    case 'settings': renderSettings(); break;
    default: renderDashboard();
  }
}

// ─── Dashboard ───────────────────────────────────────────
async function renderDashboard() {
  const content = $('#pageContent');
  content.innerHTML = '<div class="stats-grid"><div class="stat-card"><div class="stat-number">–</div><div class="stat-label">Ładowanie...</div></div></div>';

  try {
    const [stats, offers] = await Promise.all([
      apiGet(EP().OFFERS_STATS).catch(() => null),
      apiGet(EP().OFFERS_ALL),
    ]);

    state.offers = offers || [];
    state.stats = stats;

    const s = stats || { total: offers.length, active: 0, inactive: 0, sprzedaz: 0, wynajem: 0, categories: {} };

    const recentOffers = offers.slice(0, 5);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${s.total || 0}</div>
          <div class="stat-label">Wszystkich ofert</div>
        </div>
        <div class="stat-card success">
          <div class="stat-number">${s.active || 0}</div>
          <div class="stat-label">Aktywnych</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-number">${s.sprzedaz || 0}</div>
          <div class="stat-label">Sprzedaż</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-number">${s.wynajem || 0}</div>
          <div class="stat-label">Wynajem</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Kategorie ofert</div>
        </div>
        <div class="stats-grid" style="margin-bottom:0">
          ${Object.entries(s.categories || {}).map(([k, v]) => `
            <div class="stat-card">
              <div class="stat-number" style="font-size:1.3rem">${v}</div>
              <div class="stat-label">${categoryLabel(k)}</div>
            </div>
          `).join('') || '<p style="color:var(--text-muted);font-size:.85rem">Brak ofert</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Ostatnio dodane</div>
          <button class="btn btn-outline btn-sm" onclick="navigateTo('offers')">Zobacz wszystkie</button>
        </div>
        ${recentOffers.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Zdjęcie</th><th>Tytuł</th><th>Cena</th><th>Status</th><th>Data</th>
              </tr></thead>
              <tbody>
                ${recentOffers.map(o => `
                  <tr>
                    <td><img class="tbl-thumb" src="${getOfferThumb(o)}" alt="" onerror="this.style.display='none'" loading="lazy"></td>
                    <td><span class="tbl-title">${escHtml(o.title)}</span><br><span class="tbl-sub">${categoryLabel(o.category)}</span></td>
                    <td>${formatPrice(o.price)} ${escHtml(o.currency || 'PLN')}</td>
                    <td><span class="badge ${o.active !== false ? 'badge-active' : 'badge-inactive'}">${o.active !== false ? 'Aktywna' : 'Nieaktywna'}</span></td>
                    <td style="white-space:nowrap">${formatDate(o.createdAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><h3>Brak ofert</h3><p>Dodaj pierwszą ofertę klikając "Dodaj ofertę" w menu.</p></div>'}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="card"><div class="empty-state"><h3>Błąd</h3><p>${escHtml(err.message)}</p></div></div>`;
  }
}

function categoryLabel(cat) {
  const map = {
    mieszkanie: 'Mieszkania', dom: 'Domy', dzialka: 'Działki',
    lokal: 'Lokale', biuro: 'Biura', garaz: 'Garaże',
    magazyn: 'Magazyny', inne: 'Inne',
  };
  return map[cat] || cat || '–';
}

function getOfferThumb(offer) {
  if (offer.images && offer.images.length > 0) {
    const img = offer.images[0];
    return API() + (img.thumbWebp || img.thumb || img.webp || img.original || '');
  }
  return offer.img || '';
}

function getOfferImg(offer) {
  if (offer.images && offer.images.length > 0) {
    const img = offer.images[0];
    return API() + (img.webp || img.avif || img.original || '');
  }
  return offer.img || '';
}

// ─── Offers List ─────────────────────────────────────────
async function renderOffers() {
  const content = $('#pageContent');
  content.innerHTML = '<p style="color:var(--text-muted)">Ładowanie ofert...</p>';

  try {
    state.offers = await apiGet(EP().OFFERS_ALL);
  } catch (err) {
    content.innerHTML = `<div class="card"><div class="empty-state"><h3>Błąd</h3><p>${escHtml(err.message)}</p></div></div>`;
    return;
  }

  renderOffersTable();
}

function renderOffersTable(searchTerm, filterType, filterStatus) {
  const content = $('#pageContent');
  let offers = [...state.offers];

  // Apply filters
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    offers = offers.filter(o =>
      (o.title || '').toLowerCase().includes(q) ||
      (o.address || '').toLowerCase().includes(q) ||
      (o.city || '').toLowerCase().includes(q)
    );
  }
  if (filterType) offers = offers.filter(o => o.type === filterType);
  if (filterStatus === 'active') offers = offers.filter(o => o.active !== false);
  if (filterStatus === 'inactive') offers = offers.filter(o => o.active === false);

  content.innerHTML = `
    <div class="toolbar">
      <input class="search-input" id="offerSearch" placeholder="Szukaj po tytule, adresie..." value="${escHtml(searchTerm || '')}">
      <select class="filter-select" id="offerFilterType">
        <option value="">Wszystkie typy</option>
        <option value="sprzedaz" ${filterType === 'sprzedaz' ? 'selected' : ''}>Sprzedaż</option>
        <option value="wynajem" ${filterType === 'wynajem' ? 'selected' : ''}>Wynajem</option>
      </select>
      <select class="filter-select" id="offerFilterStatus">
        <option value="">Wszystkie statusy</option>
        <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>Aktywne</option>
        <option value="inactive" ${filterStatus === 'inactive' ? 'selected' : ''}>Nieaktywne</option>
      </select>
      <button class="btn btn-primary" onclick="navigateTo('add')">+ Dodaj ofertę</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Oferty (${offers.length})</div>
      </div>
      ${offers.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Zdjęcie</th><th>Tytuł</th><th>Typ</th><th>Cena</th><th>Pow.</th><th>Lokalizacja</th><th>Status</th><th>Wyróż.</th><th>Wyśw.</th><th>Akcje</th>
            </tr></thead>
            <tbody>
              ${offers.map(o => `
                <tr>
                  <td><img class="tbl-thumb" src="${getOfferThumb(o)}" alt="" onerror="this.style.display='none'" loading="lazy" onclick="openLightbox('${getOfferImg(o)}')"></td>
                  <td><span class="tbl-title">${escHtml(o.title)}</span><br><span class="tbl-sub">${categoryLabel(o.category)}</span></td>
                  <td><span class="badge ${o.type === 'sprzedaz' ? 'badge-sale' : 'badge-rent'}">${o.type === 'sprzedaz' ? 'Sprzedaż' : 'Wynajem'}</span></td>
                  <td style="white-space:nowrap">${formatPrice(o.price)} ${escHtml(o.currency || 'PLN')}</td>
                  <td>${o.area || 0} m²</td>
                  <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(o.address)}</td>
                  <td><span class="badge ${o.active !== false ? 'badge-active' : 'badge-inactive'}">${o.active !== false ? 'Aktywna' : 'Nieaktywna'}</span></td>
                  <td>${o.featured ? '<span class="badge badge-featured">★</span>' : '–'}</td>
                  <td>${o.views || 0}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-outline btn-sm" onclick="openEditModal('${o._id || o.id}')">Edytuj</button>
                      <button class="btn btn-outline btn-sm" onclick="toggleOffer('${o._id || o.id}')">${o.active !== false ? 'Ukryj' : 'Pokaż'}</button>
                      <button class="btn btn-outline btn-sm" onclick="toggleFeatured('${o._id || o.id}')">${o.featured ? 'Odznacz' : '★'}</button>
                      <button class="btn btn-outline btn-sm" onclick="previewSingle('${o._id || o.id}')">Podgląd</button>
                      <button class="btn btn-danger-outline btn-sm" onclick="deleteOffer('${o._id || o.id}')">Usuń</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><h3>Brak ofert</h3><p>Dodaj pierwszą ofertę.</p></div>'}
    </div>
  `;

  // Bind search/filter events
  const searchInput = $('#offerSearch');
  const typeFilter = $('#offerFilterType');
  const statusFilter = $('#offerFilterStatus');

  let debounce;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        renderOffersTable(searchInput.value, typeFilter.value, statusFilter.value);
      }, 300);
    });
  }
  if (typeFilter) typeFilter.addEventListener('change', () => {
    renderOffersTable(searchInput.value, typeFilter.value, statusFilter.value);
  });
  if (statusFilter) statusFilter.addEventListener('change', () => {
    renderOffersTable(searchInput.value, typeFilter.value, statusFilter.value);
  });
}

// ─── Offer CRUD ──────────────────────────────────────────
async function toggleOffer(id) {
  try {
    await apiPatch(EP().OFFERS + '/' + id + '/toggle', {});
    toast('Status oferty zmieniony.', 'success');
    await renderOffers();
  } catch (err) {
    toast('Błąd: ' + err.message, 'error');
  }
}

async function toggleFeatured(id) {
  try {
    await apiPatch(EP().OFFERS + '/' + id + '/featured', {});
    toast('Status wyróżnienia zmieniony.', 'success');
    await renderOffers();
  } catch (err) {
    toast('Błąd: ' + err.message, 'error');
  }
}

async function deleteOffer(id) {
  if (!confirm('Czy na pewno chcesz usunąć tę ofertę? Tej operacji nie można cofnąć.')) return;
  try {
    await apiDelete(EP().OFFERS + '/' + id);
    toast('Oferta usunięta.', 'success');
    await renderOffers();
  } catch (err) {
    toast('Błąd: ' + err.message, 'error');
  }
}

// ─── Add Offer Form ──────────────────────────────────────
function renderAddForm(prefill) {
  state.uploadedImages = prefill ? (prefill.images || []) : [];
  const o = prefill || {};
  const content = $('#pageContent');

  content.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${prefill ? 'Edytuj ofertę' : 'Nowa oferta'}</div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Transakcja *</label>
          <select id="fType">
            <option value="sprzedaz" ${o.type === 'sprzedaz' || !o.type ? 'selected' : ''}>Sprzedaż</option>
            <option value="wynajem" ${o.type === 'wynajem' ? 'selected' : ''}>Wynajem</option>
          </select>
        </div>
        <div class="form-field">
          <label>Kategoria *</label>
          <select id="fCategory">
            ${['mieszkanie','dom','dzialka','lokal','biuro','garaz','magazyn','inne'].map(c =>
              `<option value="${c}" ${o.category === c ? 'selected' : ''}>${categoryLabel(c)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Status</label>
          <select id="fActive">
            <option value="true" ${o.active !== false ? 'selected' : ''}>Aktywna</option>
            <option value="false" ${o.active === false ? 'selected' : ''}>Nieaktywna</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field col-2">
          <label>Tytuł oferty *</label>
          <input type="text" id="fTitle" placeholder="np. Apartament na Śródmieściu" value="${escHtml(o.title || '')}">
        </div>
        <div class="form-field">
          <label>Nr referencyjny</label>
          <input type="text" id="fRefNumber" placeholder="np. MWW-001" value="${escHtml(o.refNumber || '')}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Cena *</label>
          <input type="number" id="fPrice" placeholder="np. 350000" min="0" value="${o.price || ''}">
        </div>
        <div class="form-field">
          <label>Waluta / okres</label>
          <input type="text" id="fCurrency" placeholder="PLN lub PLN/mies" value="${escHtml(o.currency || 'PLN')}">
        </div>
        <div class="form-field">
          <label>Powierzchnia (m²) *</label>
          <input type="number" id="fArea" placeholder="np. 62" min="0" step="0.01" value="${o.area || ''}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Pokoje</label>
          <input type="number" id="fRooms" placeholder="0" min="0" value="${o.rooms || ''}">
        </div>
        <div class="form-field">
          <label>Piętro</label>
          <input type="number" id="fFloor" placeholder="np. 3" min="0" value="${o.floor || ''}">
        </div>
        <div class="form-field">
          <label>Łącznie pięter</label>
          <input type="number" id="fTotalFloors" placeholder="np. 7" min="0" value="${o.totalFloors || ''}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Lokalizacja</div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Pełny adres *</label>
          <input type="text" id="fAddress" placeholder="ul. Piotrkowska 100, Śródmieście, Łódź" value="${escHtml(o.address || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Miasto</label>
          <input type="text" id="fCity" placeholder="np. Łódź" value="${escHtml(o.city || '')}">
        </div>
        <div class="form-field">
          <label>Dzielnica</label>
          <input type="text" id="fDistrict" placeholder="np. Śródmieście" value="${escHtml(o.district || '')}">
        </div>
        <div class="form-field">
          <label>Ulica</label>
          <input type="text" id="fStreet" placeholder="np. Piotrkowska" value="${escHtml(o.street || '')}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Szczegóły nieruchomości</div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Rok budowy</label>
          <input type="number" id="fYearBuilt" placeholder="np. 2020" value="${o.yearBuilt || ''}">
        </div>
        <div class="form-field">
          <label>Rodzaj budynku</label>
          <select id="fBuildingType">
            <option value="">– brak –</option>
            ${['blok','kamienica','apartamentowiec','dom wolnostojący','bliźniak','szeregowiec','loft','plomba'].map(t =>
              `<option value="${t}" ${o.buildingType === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Materiał budynku</label>
          <select id="fBuildingMaterial">
            <option value="">– brak –</option>
            ${['cegła','wielka płyta','beton','drewno','pustak','silikat','inne'].map(t =>
              `<option value="${t}" ${o.buildingMaterial === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Ogrzewanie</label>
          <select id="fHeatingType">
            <option value="">– brak –</option>
            ${['miejskie','gazowe','elektryczne','kominkowe','podłogowe','pompa ciepła','inne'].map(t =>
              `<option value="${t}" ${o.heatingType === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Stan</label>
          <select id="fCondition">
            <option value="">– brak –</option>
            ${['do zamieszkania','do remontu','deweloperski','po remoncie','w budowie','surowy'].map(t =>
              `<option value="${t}" ${o.condition === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Parking</label>
          <select id="fParking">
            <option value="">– brak –</option>
            ${['garaż','miejsce podziemne','miejsce naziemne','brak'].map(t =>
              `<option value="${t}" ${o.parking === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Cechy nieruchomości</label>
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px">
            ${[
              { id: 'fBalcony', label: 'Balkon', val: o.balcony },
              { id: 'fTerrace', label: 'Taras', val: o.terrace },
              { id: 'fGarden', label: 'Ogród', val: o.garden },
              { id: 'fElevator', label: 'Winda', val: o.elevator },
              { id: 'fBasement', label: 'Piwnica', val: o.basement },
              { id: 'fFurnished', label: 'Umeblowane', val: o.furnished },
              { id: 'fFencing', label: 'Ogrodzenie', val: o.fencing },
              { id: 'fFeatured', label: 'Wyróżniona', val: o.featured },
            ].map(f => `
              <label class="form-check">
                <input type="checkbox" id="${f.id}" ${f.val ? 'checked' : ''}> ${f.label}
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Działka (opcjonalne)</div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Pow. działki (m²)</label>
          <input type="number" id="fPlotArea" placeholder="np. 1000" min="0" value="${o.plotArea || ''}">
        </div>
        <div class="form-field">
          <label>Typ działki</label>
          <select id="fPlotType">
            <option value="">– brak –</option>
            ${['budowlana','rolna','rekreacyjna','leśna','inwestycyjna','siedliskowa'].map(t =>
              `<option value="${t}" ${o.plotType === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Media / uzbrojenie</label>
          <input type="text" id="fUtilities" placeholder="prąd, woda, gaz..." value="${escHtml(o.utilities || '')}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Koszty i kontakt</div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Czynsz adm. (PLN/mies)</label>
          <input type="number" id="fRent" min="0" placeholder="np. 500" value="${o.rent || ''}">
        </div>
        <div class="form-field">
          <label>Kaucja (PLN)</label>
          <input type="number" id="fDeposit" min="0" placeholder="np. 3000" value="${o.deposit || ''}">
        </div>
        <div class="form-field">
          <label>Dostępne od</label>
          <input type="date" id="fAvailableFrom" value="${o.availableFrom ? o.availableFrom.substring(0, 10) : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Agent – imię</label>
          <input type="text" id="fAgentName" value="${escHtml(o.agentName || '')}">
        </div>
        <div class="form-field">
          <label>Agent – telefon</label>
          <input type="text" id="fAgentPhone" value="${escHtml(o.agentPhone || '')}">
        </div>
        <div class="form-field">
          <label>Agent – email</label>
          <input type="email" id="fAgentEmail" value="${escHtml(o.agentEmail || '')}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Opis i media</div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Krótki opis (maks. 300 znaków)</label>
          <input type="text" id="fShortDesc" maxlength="300" placeholder="Krótki opis widoczny na karcie oferty" value="${escHtml(o.shortDesc || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Pełny opis</label>
          <textarea id="fDesc" rows="6" placeholder="Szczegółowy opis nieruchomości...">${escHtml(o.desc || '')}</textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Dodatkowe cechy (oddzielone przecinkami)</label>
          <input type="text" id="fFeatures" placeholder="klimatyzacja, alarm, monitoring, pralka..." value="${escHtml((o.features || []).join(', '))}">
          <span class="hint">Np: klimatyzacja, alarm, monitoring, wideo-domofon</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>URL do filmu (YouTube/Vimeo)</label>
          <input type="url" id="fVideoUrl" placeholder="https://youtube.com/..." value="${escHtml(o.videoUrl || '')}">
        </div>
        <div class="form-field">
          <label>Spacer wirtualny 3D (URL)</label>
          <input type="url" id="fVirtualTourUrl" placeholder="https://..." value="${escHtml(o.virtualTourUrl || '')}">
        </div>
        <div class="form-field">
          <label>Źródło oferty</label>
          <input type="text" id="fSource" placeholder="np. otodom, olx, własne" value="${escHtml(o.source || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>URL źródłowy oferty</label>
          <input type="url" id="fSourceUrl" placeholder="https://..." value="${escHtml(o.sourceUrl || '')}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Zdjęcia</div>
      </div>
      <div class="upload-zone" id="uploadZone">
        <input type="file" id="fileInput" multiple accept="image/*">
        <div class="upload-zone-icon">📷</div>
        <div class="upload-zone-text">Przeciągnij zdjęcia tutaj lub kliknij aby wybrać</div>
        <div class="upload-zone-hint">JPG, PNG, WebP, AVIF • max 10 MB per zdjęcie • maks. 20 zdjęć</div>
      </div>
      <div class="upload-progress" id="uploadProgress">
        <div class="progress-bar"><div class="progress-bar-fill" id="progressFill"></div></div>
        <p style="font-size:.78rem;color:var(--text-muted);margin-top:4px" id="uploadStatus">Przesyłanie...</p>
      </div>
      <div class="images-preview" id="imagesPreview"></div>

      <div class="form-row" style="margin-top:16px">
        <div class="form-field col-full">
          <label>Lub wklej URL głównego zdjęcia (stary sposób)</label>
          <input type="url" id="fImgUrl" placeholder="https://..." value="${escHtml(o.img || '')}">
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:8px;margin-bottom:40px">
      <button class="btn btn-primary" id="submitOfferBtn" style="padding:12px 32px;font-size:.9rem">${prefill ? 'Zapisz zmiany' : 'Dodaj ofertę'}</button>
      <button class="btn btn-outline" onclick="navigateTo('offers')">Anuluj</button>
    </div>
  `;

  // Bind upload events
  bindUploadZone();
  renderImagesPreview();

  // Submit
  $('#submitOfferBtn').addEventListener('click', () => {
    if (prefill) {
      submitEditOffer(prefill._id || prefill.id);
    } else {
      submitNewOffer();
    }
  });
}

function bindUploadZone() {
  const zone = $('#uploadZone');
  const input = $('#fileInput');
  if (!zone || !input) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    if (input.files.length) handleFiles(input.files);
  });
}

async function handleFiles(files) {
  const progress = $('#uploadProgress');
  const fill = $('#progressFill');
  const status = $('#uploadStatus');

  progress.style.display = 'block';
  fill.style.width = '0%';
  status.textContent = `Przesyłanie 0/${files.length}...`;

  let done = 0;
  for (const file of files) {
    try {
      status.textContent = `Przesyłanie ${done + 1}/${files.length}: ${file.name}`;
      const img = await uploadImage(file);
      state.uploadedImages.push(img);
      done++;
      fill.style.width = Math.round((done / files.length) * 100) + '%';
    } catch (err) {
      toast('Błąd przesyłania: ' + (err.message || file.name), 'error');
      done++;
    }
  }

  status.textContent = `Przesłano ${done}/${files.length} zdjęć.`;
  setTimeout(() => { progress.style.display = 'none'; }, 2000);
  renderImagesPreview();
}

function renderImagesPreview() {
  const wrap = $('#imagesPreview');
  if (!wrap) return;

  if (state.uploadedImages.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = state.uploadedImages.map((img, idx) => `
    <div class="preview-item">
      <img src="${API() + (img.thumbWebp || img.thumb || img.webp || img.original)}" alt="${escHtml(img.alt)}" onclick="openLightbox('${API() + (img.webp || img.original)}')" loading="lazy">
      <button class="preview-remove" onclick="removeUploadedImage(${idx})">✕</button>
      ${idx === 0 ? '<span class="preview-main-badge">Główne</span>' : ''}
    </div>
  `).join('');
}

function removeUploadedImage(idx) {
  state.uploadedImages.splice(idx, 1);
  renderImagesPreview();
}

function gatherFormData() {
  const features = ($('#fFeatures').value || '')
    .split(',')
    .map(f => f.trim())
    .filter(Boolean);

  return {
    type: $('#fType').value,
    category: $('#fCategory').value,
    active: $('#fActive').value === 'true',
    title: $('#fTitle').value.trim(),
    refNumber: $('#fRefNumber').value.trim(),
    price: parseFloat($('#fPrice').value) || 0,
    currency: $('#fCurrency').value.trim() || 'PLN',
    area: parseFloat($('#fArea').value) || 0,
    rooms: parseInt($('#fRooms').value) || 0,
    floor: parseInt($('#fFloor').value) || 0,
    totalFloors: parseInt($('#fTotalFloors').value) || 0,
    address: $('#fAddress').value.trim(),
    city: $('#fCity').value.trim(),
    district: $('#fDistrict').value.trim(),
    street: $('#fStreet').value.trim(),
    yearBuilt: parseInt($('#fYearBuilt').value) || null,
    buildingType: $('#fBuildingType').value,
    buildingMaterial: $('#fBuildingMaterial').value,
    heatingType: $('#fHeatingType').value,
    condition: $('#fCondition').value,
    parking: $('#fParking').value,
    balcony: $('#fBalcony').checked,
    terrace: $('#fTerrace').checked,
    garden: $('#fGarden').checked,
    elevator: $('#fElevator').checked,
    basement: $('#fBasement').checked,
    furnished: $('#fFurnished').checked,
    fencing: $('#fFencing').checked,
    featured: $('#fFeatured').checked,
    plotArea: parseFloat($('#fPlotArea').value) || 0,
    plotType: $('#fPlotType').value,
    utilities: $('#fUtilities').value.trim(),
    rent: parseFloat($('#fRent').value) || 0,
    deposit: parseFloat($('#fDeposit').value) || 0,
    availableFrom: $('#fAvailableFrom').value || null,
    agentName: $('#fAgentName').value.trim(),
    agentPhone: $('#fAgentPhone').value.trim(),
    agentEmail: $('#fAgentEmail').value.trim(),
    shortDesc: $('#fShortDesc').value.trim(),
    desc: $('#fDesc').value.trim(),
    features,
    videoUrl: $('#fVideoUrl').value.trim(),
    virtualTourUrl: $('#fVirtualTourUrl').value.trim(),
    source: $('#fSource').value.trim(),
    sourceUrl: $('#fSourceUrl').value.trim(),
    images: state.uploadedImages,
    img: $('#fImgUrl').value.trim(),
  };
}

async function submitNewOffer() {
  const data = gatherFormData();

  if (!data.title || !data.price || !data.area || !data.address) {
    toast('Wypełnij wymagane pola: Tytuł, Cena, Powierzchnia, Adres.', 'error');
    return;
  }

  const btn = $('#submitOfferBtn');
  btn.textContent = 'Dodawanie...';
  btn.disabled = true;

  try {
    await apiPost(EP().OFFERS, data);
    toast('Oferta dodana pomyślnie!', 'success');
    state.uploadedImages = [];
    navigateTo('offers');
  } catch (err) {
    toast('Błąd: ' + err.message, 'error');
  }

  btn.textContent = 'Dodaj ofertę';
  btn.disabled = false;
}

async function submitEditOffer(id) {
  const data = gatherFormData();

  if (!data.title || !data.price || !data.area || !data.address) {
    toast('Wypełnij wymagane pola: Tytuł, Cena, Powierzchnia, Adres.', 'error');
    return;
  }

  const btn = $('#submitOfferBtn');
  btn.textContent = 'Zapisywanie...';
  btn.disabled = true;

  try {
    await apiPatch(EP().OFFERS + '/' + id, data);
    toast('Oferta zaktualizowana!', 'success');
    state.uploadedImages = [];
    navigateTo('offers');
  } catch (err) {
    toast('Błąd: ' + err.message, 'error');
  }

  btn.textContent = 'Zapisz zmiany';
  btn.disabled = false;
}

// ─── Edit Modal / Inline Edit ────────────────────────────
async function openEditModal(id) {
  const offer = state.offers.find(o => (o._id || o.id) === id);
  if (!offer) { toast('Nie znaleziono oferty.', 'error'); return; }

  state.currentPage = 'add';
  $('#pageTitle').textContent = 'Edytuj ofertę';
  renderAddForm(offer);
}

// ─── Preview ─────────────────────────────────────────────
async function renderPreview() {
  const content = $('#pageContent');

  if (state.offers.length === 0) {
    try { state.offers = await apiGet(EP().OFFERS_ALL); } catch {}
  }

  const activeOffers = state.offers.filter(o => o.active !== false);

  content.innerHTML = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Podgląd strony – tak wyglądają oferty na stronie</div>
      </div>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">
        Poniżej widzisz podgląd ${activeOffers.length} aktywnych ofert tak jak będą wyglądać na stronie ofert.
      </p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">
      ${activeOffers.map(o => renderPreviewCard(o)).join('')}
    </div>

    ${!activeOffers.length ? '<div class="empty-state"><h3>Brak aktywnych ofert</h3><p>Dodaj lub aktywuj oferty aby zobaczyć podgląd.</p></div>' : ''}
  `;
}

function renderPreviewCard(o) {
  const fmtPrice = formatPrice(o.price);
  const typeLabel = o.type === 'sprzedaz' ? 'Sprzedaż' : 'Wynajem';
  const imgSrc = getOfferImg(o);

  return `
    <div class="preview-card" onclick="previewSingle('${o._id || o.id}')" style="cursor:pointer">
      <div class="preview-card-photo">
        ${imgSrc ? `<img src="${imgSrc}" alt="${escHtml(o.title)}" loading="lazy" onerror="this.style.display='none'">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">Brak zdjęcia</div>'}
        <span class="preview-card-badge" ${o.type === 'wynajem' ? 'style="background:#555"' : ''}>${typeLabel}</span>
        ${o.featured ? '<span class="preview-card-badge" style="left:auto;right:12px;background:var(--warning)">★ Wyróżniona</span>' : ''}
      </div>
      <div class="preview-card-body">
        <div class="preview-price">${fmtPrice} <span class="preview-price-sub">${escHtml(o.currency || 'PLN')}</span></div>
        <div class="preview-title">${escHtml(o.title)}</div>
        <div class="preview-meta">
          <span class="preview-meta-item">📐 ${o.area} m²</span>
          ${o.rooms ? `<span class="preview-meta-item">🚪 ${o.rooms} pok.</span>` : ''}
          ${o.floor ? `<span class="preview-meta-item">🏢 ${o.floor}/${o.totalFloors || '?'} p.</span>` : ''}
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px">📍 ${escHtml(o.address)}</div>
        ${o.shortDesc || o.desc ? `<p class="preview-desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(o.shortDesc || o.desc)}</p>` : ''}
      </div>
    </div>
  `;
}

function previewSingle(id) {
  const o = state.offers.find(off => (off._id || off.id) === id);
  if (!o) return;

  const content = $('#pageContent');
  state.currentPage = 'preview';
  $('#pageTitle').textContent = 'Podgląd oferty';

  const fmtPrice = formatPrice(o.price);
  const typeLabel = o.type === 'sprzedaz' ? 'Sprzedaż' : 'Wynajem';
  const allImages = (o.images || []).map(img => API() + (img.webp || img.avif || img.original));
  const mainImg = getOfferImg(o);

  const details = [
    o.category ? ['Kategoria', categoryLabel(o.category)] : null,
    o.rooms ? ['Pokoje', o.rooms] : null,
    o.floor ? ['Piętro', `${o.floor}/${o.totalFloors || '?'}`] : null,
    o.yearBuilt ? ['Rok budowy', o.yearBuilt] : null,
    o.buildingType ? ['Budynek', o.buildingType] : null,
    o.buildingMaterial ? ['Materiał', o.buildingMaterial] : null,
    o.heatingType ? ['Ogrzewanie', o.heatingType] : null,
    o.condition ? ['Stan', o.condition] : null,
    o.parking ? ['Parking', o.parking] : null,
    o.plotArea ? ['Pow. działki', o.plotArea + ' m²'] : null,
    o.plotType ? ['Typ działki', o.plotType] : null,
    o.utilities ? ['Media', o.utilities] : null,
    o.rent ? ['Czynsz', formatPrice(o.rent) + ' PLN/mies'] : null,
    o.deposit ? ['Kaucja', formatPrice(o.deposit) + ' PLN'] : null,
    o.availableFrom ? ['Dostępne od', formatDate(o.availableFrom)] : null,
    o.pricePerM2 ? ['Cena za m²', formatPrice(o.pricePerM2) + ' PLN'] : null,
    o.refNumber ? ['Nr ref.', o.refNumber] : null,
    o.source ? ['Źródło', o.source] : null,
  ].filter(Boolean);

  const boolFeatures = [
    o.balcony ? 'Balkon' : null,
    o.terrace ? 'Taras' : null,
    o.garden ? 'Ogród' : null,
    o.elevator ? 'Winda' : null,
    o.basement ? 'Piwnica' : null,
    o.furnished ? 'Umeblowane' : null,
    o.fencing ? 'Ogrodzenie' : null,
  ].filter(Boolean);

  content.innerHTML = `
    <button class="btn btn-outline" onclick="renderPreview()" style="margin-bottom:16px">← Wróć do listy</button>

    <div class="preview-container">
      <div class="preview-card">
        <div class="preview-card-photo" style="height:400px">
          ${mainImg ? `<img src="${mainImg}" alt="${escHtml(o.title)}" loading="lazy" onerror="this.style.display='none'" onclick="openLightbox('${mainImg}')">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.2rem">Brak zdjęcia</div>'}
          <span class="preview-card-badge" ${o.type === 'wynajem' ? 'style="background:#555"' : ''}>${typeLabel}</span>
          ${o.featured ? '<span class="preview-card-badge" style="left:auto;right:12px;background:var(--warning)">★ Wyróżniona</span>' : ''}
        </div>
        <div class="preview-card-body">
          <div class="preview-price" style="font-size:2rem">${fmtPrice} <span class="preview-price-sub">${escHtml(o.currency || 'PLN')}</span></div>
          <div class="preview-title" style="font-size:1.3rem">${escHtml(o.title)}</div>
          <div class="preview-meta" style="margin:16px 0">
            <span class="preview-meta-item">📐 ${o.area} m²</span>
            ${o.rooms ? `<span class="preview-meta-item">🚪 ${o.rooms} pok.</span>` : ''}
            ${o.floor ? `<span class="preview-meta-item">🏢 ${o.floor}/${o.totalFloors || '?'} p.</span>` : ''}
            ${o.views ? `<span class="preview-meta-item">👁 ${o.views} wyświetleń</span>` : ''}
          </div>
          <div style="font-size:.9rem;color:var(--text-muted);margin-bottom:16px">📍 ${escHtml(o.address)}</div>

          ${o.desc ? `<div class="preview-desc" style="margin-bottom:20px;-webkit-line-clamp:unset">${escHtml(o.desc).replace(/\n/g, '<br>')}</div>` : ''}

          ${boolFeatures.length || (o.features && o.features.length) ? `
            <div style="margin-bottom:16px">
              <strong style="font-size:.85rem;display:block;margin-bottom:8px">Cechy:</strong>
              <div class="tags-wrap">
                ${boolFeatures.map(f => `<span class="tag">✓ ${f}</span>`).join('')}
                ${(o.features || []).map(f => `<span class="tag">✓ ${escHtml(f)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${details.length ? `
            <div class="preview-details-grid">
              ${details.map(([l, v]) => `
                <div class="preview-detail">
                  <span class="preview-detail-label">${escHtml(l)}</span>
                  <span class="preview-detail-value">${escHtml(String(v))}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${allImages.length > 1 ? `
            <div style="margin-top:24px">
              <strong style="font-size:.85rem;display:block;margin-bottom:8px">Galeria (${allImages.length} zdjęć):</strong>
              <div class="preview-gallery">
                ${allImages.map(src => `<img src="${src}" alt="" loading="lazy" onclick="openLightbox('${src}')">`).join('')}
              </div>
            </div>
          ` : ''}

          ${o.videoUrl ? `
            <div style="margin-top:20px">
              <strong style="font-size:.85rem;display:block;margin-bottom:8px">Film:</strong>
              <a href="${escHtml(o.videoUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🎬 Obejrzyj film</a>
            </div>
          ` : ''}

          ${o.virtualTourUrl ? `
            <div style="margin-top:12px">
              <a href="${escHtml(o.virtualTourUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔄 Spacer wirtualny 3D</a>
            </div>
          ` : ''}

          ${o.agentName || o.agentPhone || o.agentEmail ? `
            <div style="margin-top:24px;padding:16px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border-soft)">
              <strong style="font-size:.85rem;display:block;margin-bottom:8px">Kontakt:</strong>
              ${o.agentName ? `<div style="font-size:.88rem;margin-bottom:4px">👤 ${escHtml(o.agentName)}</div>` : ''}
              ${o.agentPhone ? `<div style="font-size:.88rem;margin-bottom:4px">📞 <a href="tel:${escHtml(o.agentPhone)}">${escHtml(o.agentPhone)}</a></div>` : ''}
              ${o.agentEmail ? `<div style="font-size:.88rem">📧 <a href="mailto:${escHtml(o.agentEmail)}">${escHtml(o.agentEmail)}</a></div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="btn-group" style="margin-top:16px">
      <button class="btn btn-primary" onclick="openEditModal('${o._id || o.id}')">Edytuj ofertę</button>
      <button class="btn btn-outline" onclick="toggleOffer('${o._id || o.id}').then(()=>renderPreview())">${o.active !== false ? 'Dezaktywuj' : 'Aktywuj'}</button>
      <button class="btn btn-danger-outline" onclick="deleteOffer('${o._id || o.id}').then(()=>renderPreview())">Usuń</button>
    </div>
  `;
}

// ─── Settings ────────────────────────────────────────────
function renderSettings() {
  const content = $('#pageContent');
  content.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Zmiana hasła</div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Aktualne hasło</label>
          <input type="password" id="sCurrent" autocomplete="current-password">
        </div>
        <div class="form-field">
          <label>Nowe hasło</label>
          <input type="password" id="sNew" autocomplete="new-password">
        </div>
        <div class="form-field">
          <label>Powtórz nowe hasło</label>
          <input type="password" id="sConfirm" autocomplete="new-password">
        </div>
      </div>
      <button class="btn btn-primary" id="changePassBtn" style="margin-top:8px">Zmień hasło</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Informacje o backendzie</div>
      </div>
      <div class="form-row">
        <div class="form-field col-full">
          <label>Adres API</label>
          <input type="text" readonly value="${API()}" style="background:var(--bg)">
        </div>
      </div>
      <div id="healthStatus" style="margin-top:12px;font-size:.85rem;color:var(--text-muted)">Sprawdzanie statusu...</div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Konfiguracja panelu</div>
      </div>
      <p style="font-size:.85rem;color:var(--text-muted);line-height:1.6">
        Aby zmienić adres API backendu, edytuj plik <code>admin-config.js</code> i ustaw poprawny adres w polu <code>API_BASE_URL</code>.
      </p>
    </div>
  `;

  // Change password
  $('#changePassBtn').addEventListener('click', async () => {
    const current = $('#sCurrent').value;
    const newPass = $('#sNew').value;
    const confirm = $('#sConfirm').value;

    if (!current || !newPass) { toast('Wypełnij wszystkie pola.', 'error'); return; }
    if (newPass !== confirm) { toast('Nowe hasła nie są identyczne.', 'error'); return; }
    if (newPass.length < 6) { toast('Nowe hasło musi mieć min. 6 znaków.', 'error'); return; }

    try {
      await apiPost(EP().AUTH_CHANGE_PASS, { currentPassword: current, newPassword: newPass });
      toast('Hasło zmienione pomyślnie!', 'success');
      $('#sCurrent').value = '';
      $('#sNew').value = '';
      $('#sConfirm').value = '';
    } catch (err) {
      toast('Błąd: ' + err.message, 'error');
    }
  });

  // Health check
  fetch(API() + EP().HEALTH)
    .then(r => r.json())
    .then(data => {
      $('#healthStatus').innerHTML = `<span style="color:var(--success)">✓ Backend online</span> — ${data.timestamp || ''}`;
    })
    .catch(() => {
      $('#healthStatus').innerHTML = '<span style="color:var(--danger)">✗ Backend offline lub niedostępny</span>';
    });
}

// ─── Lightbox ────────────────────────────────────────────
function openLightbox(src) {
  if (!src) return;
  const lb = $('#lightbox');
  $('#lightboxImg').src = src;
  lb.classList.add('open');
}
function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.remove('open');
  $('#lightboxImg').src = '';
}

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Login
  $('#loginBtn').addEventListener('click', doLogin);
  $('#loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginPass').focus(); });

  // Logout
  $('#logoutBtn').addEventListener('click', doLogout);

  // Navigation
  $$('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Mobile sidebar
  $('#hamburgerBtn').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });
  $('#sidebarClose').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
  });

  // Lightbox
  $('#lightboxClose').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', e => {
    if (e.target === $('#lightbox')) closeLightbox();
  });

  // Edit modal close
  $('#editModalClose').addEventListener('click', () => {
    $('#editModal').classList.remove('open');
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLightbox();
      $('#editModal').classList.remove('open');
      $('#sidebar').classList.remove('open');
    }
  });

  // Try to restore session
  verifySession();
});
