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

// ===== Auth =====
async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (data.authenticated) {
      showApp();
    } else {
      showLogin();
    }
  } catch {
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

async function login() {
  const pin = pinInput.value;
  if (!pin) return;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Bezig...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });

    if (res.ok) {
      loginError.classList.add('hidden');
      showApp();
    } else {
      loginError.classList.remove('hidden');
      pinInput.value = '';
      pinInput.focus();
      pinInput.classList.add('shake');
      setTimeout(() => pinInput.classList.remove('shake'), 500);
    }
  } catch {
    showToast('Verbindingsfout', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Inloggen';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
}

// ===== Data Loading =====
async function loadData() {
  await Promise.all([loadItems(), loadStats(), loadCategories()]);
}

async function loadItems() {
  const search = searchInput.value;
  const category = categoryFilter.value;
  const sort = sortSelect.value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (sort) params.set('sort', sort);

  try {
    const res = await fetch(`/api/items?${params}`);
    if (res.status === 401) return showLogin();
    const items = await res.json();
    currentItems = items;
    renderItems(items);
  } catch {
    showToast('Kon items niet laden', 'error');
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    document.getElementById('stat-items').textContent = stats.totalItems;
    document.getElementById('stat-quantity').textContent = stats.totalQuantity;
    document.getElementById('stat-categories').textContent = stats.totalCategories;

    const expiringEl = document.getElementById('stat-expiring');
    expiringEl.textContent = stats.expiringSoon + stats.expired;

    const expiringCard = document.getElementById('stat-expiring-card');
    if (stats.expired > 0) {
      expiringCard.style.borderLeft = `4px solid ${getComputedStyle(document.documentElement).getPropertyValue('--danger')}`;
    } else if (stats.expiringSoon > 0) {
      expiringCard.style.borderLeft = `4px solid ${getComputedStyle(document.documentElement).getPropertyValue('--warning')}`;
    } else {
      expiringCard.style.borderLeft = '';
    }
  } catch {}
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) return;
    const categories = await res.json();

    // Update filter dropdown
    const currentVal = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="Alle">Alle categorieën</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
    categoryFilter.value = currentVal;

    // Update datalist for form
    const datalist = document.getElementById('category-list');
    datalist.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      datalist.appendChild(opt);
    });
  } catch {}
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
    name: document.getElementById('item-name').value,
    category: document.getElementById('item-category').value || 'Overig',
    quantity: parseInt(document.getElementById('item-quantity').value) || 1,
    unit: document.getElementById('item-unit').value,
    expiry_date: document.getElementById('item-expiry').value || null,
    notes: document.getElementById('item-notes').value
  };

  try {
    const url = id ? `/api/items/${id}` : '/api/items';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.status === 401) return showLogin();
    if (!res.ok) {
      const err = await res.json();
      return showToast(err.error || 'Er ging iets mis', 'error');
    }

    closeModal();
    showToast(id ? 'Product bijgewerkt!' : 'Product toegevoegd!', 'success');
    loadData();
  } catch {
    showToast('Verbindingsfout', 'error');
  }
}

async function deleteItem() {
  if (!deleteItemId) return;

  try {
    const res = await fetch(`/api/items/${deleteItemId}`, { method: 'DELETE' });
    if (res.status === 401) return showLogin();
    if (!res.ok) return showToast('Kon item niet verwijderen', 'error');

    closeDeleteModal();
    showToast('Product verwijderd', 'success');
    loadData();
  } catch {
    showToast('Verbindingsfout', 'error');
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

// Close modals on overlay click
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) closeDeleteModal(); });

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});

// ===== Init =====
checkAuth();
