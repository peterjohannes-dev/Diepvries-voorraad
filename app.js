// ===== Supabase Config =====
const SUPABASE_URL = 'https://tpeoknoqfkixafqjxqcw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZW9rbm9xZmtpeGFmcWp4cWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTI2OTAsImV4cCI6MjA4OTU4ODY5MH0.c6-7-CT7nyzfcGMiyGr03EdZvKplx9NBvKlxiNvjIHE';
const PIN_CODE = '3523';

// ===== Supabase REST helper =====
async function supabase(table, { method = 'GET', filters = '', body = null, select = '*', order = '' } = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : ''
  };

  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
  if (filters) url += `&${filters}`;
  if (order) url += `&order=${order}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Database fout');
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ===== State =====
let currentItems = [];
let deleteItemId = null;

// ===== DOM Elements =====
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const sortSelect = document.getElementById('sort-select');
const addBtn = document.getElementById('add-btn');
const itemsContainer = document.getElementById('items-container');
const emptyState = document.getElementById('empty-state');
const modalOverlay = document.getElementById('modal-overlay');
const deleteOverlay = document.getElementById('delete-overlay');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const formSubmitBtn = document.getElementById('form-submit-btn');

// ===== Auth (simple PIN stored in sessionStorage) =====
function checkAuth() {
  if (sessionStorage.getItem('authenticated') === 'true') {
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  pinInput.value = '';
  pinInput.focus();
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  loadData();
}

function login() {
  const pin = pinInput.value;
  if (!pin) return;

  if (pin === PIN_CODE) {
    sessionStorage.setItem('authenticated', 'true');
    loginError.classList.add('hidden');
    showApp();
  } else {
    loginError.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
}

function logout() {
  sessionStorage.removeItem('authenticated');
  showLogin();
}

// ===== Data Loading =====
async function loadData() {
  await Promise.all([loadItems(), loadCategories()]);
  updateStats();
}

async function loadItems() {
  const search = searchInput.value.trim();
  const category = categoryFilter.value;
  const sort = sortSelect.value;

  let filters = '';
  if (search) {
    filters += `or=(name.ilike.*${encodeURIComponent(search)}*,notes.ilike.*${encodeURIComponent(search)}*)`;
  }
  if (category && category !== 'Alle') {
    filters += (filters ? '&' : '') + `category=eq.${encodeURIComponent(category)}`;
  }

  let order = '';
  switch (sort) {
    case 'name': order = 'name.asc'; break;
    case 'date': order = 'date_added.desc'; break;
    case 'expiry': order = 'expiry_date.asc.nullslast'; break;
    case 'category': order = 'category.asc,name.asc'; break;
    default: order = 'updated_at.desc';
  }

  try {
    const items = await supabase('items', { filters, order });
    currentItems = items;
    renderItems(items);
    updateStats();
  } catch (e) {
    showToast('Kon items niet laden: ' + e.message, 'error');
  }
}

async function loadCategories() {
  try {
    const items = await supabase('items', { select: 'category' });
    const categories = [...new Set(items.map(i => i.category))].sort();

    const currentVal = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="Alle">Alle categorieën</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
    categoryFilter.value = currentVal;

    const datalist = document.getElementById('category-list');
    datalist.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      datalist.appendChild(opt);
    });
  } catch {}
}

function updateStats() {
  const items = currentItems;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  document.getElementById('stat-items').textContent = items.length;
  document.getElementById('stat-quantity').textContent = items.reduce((sum, i) => sum + i.quantity, 0);
  document.getElementById('stat-categories').textContent = new Set(items.map(i => i.category)).size;

  let expiring = 0;
  let expired = 0;
  items.forEach(item => {
    if (!item.expiry_date) return;
    const exp = new Date(item.expiry_date + 'T00:00:00');
    if (exp < today) expired++;
    else if (exp <= nextWeek) expiring++;
  });

  document.getElementById('stat-expiring').textContent = expiring + expired;
  const card = document.getElementById('stat-expiring-card');
  if (expired > 0) card.style.borderLeft = '4px solid var(--danger)';
  else if (expiring > 0) card.style.borderLeft = '4px solid var(--warning)';
  else card.style.borderLeft = '';
}

// ===== Rendering =====
function renderItems(items) {
  if (items.length === 0) {
    itemsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  itemsContainer.classList.remove('hidden');

  itemsContainer.innerHTML = items.map(item => {
    const expiryInfo = getExpiryInfo(item.expiry_date);
    const cardClass = expiryInfo.class ? `item-card ${expiryInfo.class}` : 'item-card';

    return `
      <div class="${cardClass}" data-id="${item.id}">
        <div class="item-header">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <div class="item-actions">
            <button class="btn btn-ghost btn-icon" onclick="openEditModal(${item.id})" title="Bewerken">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="openDeleteModal(${item.id}, '${escapeHtml(item.name).replace(/'/g, "\\'")}')" title="Verwijderen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="item-meta">
          <span class="item-badge badge-category">${escapeHtml(item.category)}</span>
          <span class="item-badge badge-quantity">${item.quantity} ${escapeHtml(item.unit)}</span>
          ${expiryInfo.badge}
        </div>
        ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
        <div class="item-date">Toegevoegd: ${formatDate(item.date_added)}</div>
      </div>
    `;
  }).join('');
}

function getExpiryInfo(expiryDate) {
  if (!expiryDate) return { badge: '', class: '' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      badge: `<span class="item-badge badge-expiry danger">Verlopen (${Math.abs(daysLeft)}d geleden)</span>`,
      class: 'expired'
    };
  } else if (daysLeft <= 7) {
    return {
      badge: `<span class="item-badge badge-expiry warning">Nog ${daysLeft}d houdbaar</span>`,
      class: 'expiring-soon'
    };
  } else {
    return {
      badge: `<span class="item-badge badge-expiry">THT: ${formatDate(expiryDate)}</span>`,
      class: ''
    };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Modal =====
function openAddModal() {
  modalTitle.textContent = 'Product toevoegen';
  formSubmitBtn.textContent = 'Toevoegen';
  itemForm.reset();
  document.getElementById('item-id').value = '';
  document.getElementById('item-quantity').value = 1;
  modalOverlay.classList.remove('hidden');
  document.getElementById('item-name').focus();
}

function openEditModal(id) {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;

  modalTitle.textContent = 'Product bewerken';
  formSubmitBtn.textContent = 'Opslaan';
  document.getElementById('item-id').value = item.id;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-quantity').value = item.quantity;
  document.getElementById('item-unit').value = item.unit;
  document.getElementById('item-expiry').value = item.expiry_date || '';
  document.getElementById('item-notes').value = item.notes || '';
  modalOverlay.classList.remove('hidden');
  document.getElementById('item-name').focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
}

function openDeleteModal(id, name) {
  deleteItemId = id;
  document.getElementById('delete-item-name').textContent = name;
  deleteOverlay.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteOverlay.classList.add('hidden');
  deleteItemId = null;
}

// ===== CRUD =====
async function saveItem(e) {
  e.preventDefault();

  const id = document.getElementById('item-id').value;
  const data = {
    name: document.getElementById('item-name').value.trim(),
    category: document.getElementById('item-category').value.trim() || 'Overig',
    quantity: parseInt(document.getElementById('item-quantity').value) || 1,
    unit: document.getElementById('item-unit').value,
    expiry_date: document.getElementById('item-expiry').value || null,
    notes: document.getElementById('item-notes').value.trim() || null,
    updated_at: new Date().toISOString()
  };

  if (!data.name) {
    showToast('Vul een productnaam in', 'error');
    return;
  }

  try {
    if (id) {
      await supabase('items', {
        method: 'PATCH',
        filters: `id=eq.${id}`,
        body: data
      });
      showToast('Product bijgewerkt!', 'success');
    } else {
      data.date_added = new Date().toISOString().split('T')[0];
      await supabase('items', {
        method: 'POST',
        body: data
      });
      showToast('Product toegevoegd!', 'success');
    }
    closeModal();
    loadData();
  } catch (e) {
    showToast('Fout: ' + e.message, 'error');
  }
}

async function deleteItem() {
  if (!deleteItemId) return;

  try {
    await supabase('items', {
      method: 'DELETE',
      filters: `id=eq.${deleteItemId}`
    });
    closeDeleteModal();
    showToast('Product verwijderd', 'success');
    loadData();
  } catch (e) {
    showToast('Fout: ' + e.message, 'error');
  }
}

// ===== Toast =====
function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Event Listeners =====
loginBtn.addEventListener('click', login);
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
logoutBtn.addEventListener('click', logout);
addBtn.addEventListener('click', openAddModal);
itemForm.addEventListener('submit', saveItem);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteItem);

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadItems, 300);
});
categoryFilter.addEventListener('change', loadItems);
sortSelect.addEventListener('change', loadItems);

modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) closeDeleteModal(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});

// ===== Init =====
checkAuth();
