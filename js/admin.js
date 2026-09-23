// Admin Panel Controller for ZAMAN Chaihana
let currentMenu = (typeof window !== 'undefined' && window.__INITIAL_MENU__) ? window.__INITIAL_MENU__ : {};
let currentCategory = 'all';
let currentSearch = '';
let tempPhotoBase64 = null;
let editingDishId = null;
let editingCategoryKey = null;

function updateConnectionStatus(isOnline, text) {
  const badge = document.getElementById('serverConnectionStatus');
  if (!badge) return;
  if (isOnline) {
    badge.style.background = 'rgba(76,175,80,0.18)';
    badge.style.color = '#81C784';
    badge.style.borderColor = 'rgba(76,175,80,0.4)';
    badge.textContent = '🟢 ' + (text || 'Онлайн');
  } else {
    badge.style.background = 'rgba(244,67,54,0.18)';
    badge.style.color = '#EF5350';
    badge.style.borderColor = 'rgba(244,67,54,0.4)';
    badge.textContent = '🔴 ' + (text || 'Нет связи');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#C62828; color:#FFF; padding:0.9rem 1rem; text-align:center; font-weight:700; font-size:0.92rem; position:sticky; top:0; z-index:99999; box-shadow:0 4px 15px rgba(0,0,0,0.5);';
    banner.innerHTML = '⚠️ Внимание: Вы открыли админ-панель напрямую из папки через проводник (file://). В этом режиме сохранение в базу данных невозможно. Откройте сайт через сервер: <a href="http://localhost:5500/admin.html" style="color:#FFE082; text-decoration:underline;">http://localhost:5500/admin.html</a> или по ссылке туннеля!';
    document.body.prepend(banner);
    updateConnectionStatus(false, 'Локальный файл (нет сервера)');
  }

  if (currentMenu && Object.keys(currentMenu).length > 0) {
    renderCategoryFilters();
    renderDishes();
    updateStats();
  }
  initAuth();
  initForgotPasswordModal();
  initCategoryFilters();
  initSearch();
  initModals();
  loadMenu();
  loadConfig();
  initSyncAndSharing();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js?v=12').catch(() => {});
    });
  }
});

/**
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 */
function initAuth() {
  const token = localStorage.getItem('zaman_admin_token');
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const bypassBtn = document.getElementById('btnBypassLogin');

  if (token) {
    if (loginOverlay) loginOverlay.style.display = 'none';
  } else {
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }

  if (bypassBtn) {
    bypassBtn.addEventListener('click', function() {
      if (loginOverlay) loginOverlay.style.display = 'none';
      showToast('👁️ Включен режим просмотра');
    });
  }

  // Password Visibility Eye Toggles
  const toggleEye = document.getElementById('btnTogglePassword');
  const passwordInput = document.getElementById('adminPasswordInput');
  if (toggleEye && passwordInput) {
    toggleEye.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleEye.textContent = '🙈';
        toggleEye.title = 'Скрыть пароль';
      } else {
        passwordInput.type = 'password';
        toggleEye.textContent = '👁️';
        toggleEye.title = 'Показать пароль';
      }
    });
  }

  const toggleNewEye = document.getElementById('btnToggleNewPassword');
  const newPassInput = document.getElementById('cfgNewPassword');
  if (toggleNewEye && newPassInput) {
    toggleNewEye.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (newPassInput.type === 'password') {
        newPassInput.type = 'text';
        toggleNewEye.textContent = '🙈';
        toggleNewEye.title = 'Скрыть пароль';
      } else {
        newPassInput.type = 'password';
        toggleNewEye.textContent = '👁️';
        toggleNewEye.title = 'Показать пароль';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const password = document.getElementById('adminPasswordInput').value.trim();
      loginError.style.display = 'none';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('zaman_admin_token', data.token);
          loginOverlay.style.display = 'none';
          showToast('✅ Добро пожаловать в панель администратора!');
          loadMenu();
          loadConfig();
        } else {
          loginError.textContent = data.message || 'Неверный пароль';
          loginError.style.display = 'block';
        }
      } catch (err) {
        loginError.textContent = 'Ошибка подключения к серверу';
        loginError.style.display = 'block';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('zaman_admin_token');
      window.location.reload();
    });
  }
}

/**
 * ============================================================
 * DATA LOADING & SAVING
 * ============================================================
 */
async function loadMenu() {
  // 1. Instantly check localStorage cache
  try {
    const cached = localStorage.getItem('zaman_menu_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        currentMenu = parsed;
        renderCategoryFilters();
        renderDishes();
        updateStats();
      }
    }
  } catch (e) {}

  let loaded = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/menu?t=' + Date.now(), { 
      signal: ctrl.signal,
      cache: 'no-cache'
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        currentMenu = data;
        localStorage.setItem('zaman_menu_cache', JSON.stringify(data));
        loaded = true;
        updateConnectionStatus(true, 'Онлайн');
      }
    }
  } catch (err) {}

  if (!loaded) {
    try {
      const res2 = await fetch('data/menu.json?t=' + Date.now(), { cache: 'no-cache' });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && typeof data2 === 'object' && Object.keys(data2).length > 0) {
          currentMenu = data2;
          localStorage.setItem('zaman_menu_cache', JSON.stringify(data2));
          loaded = true;
          updateConnectionStatus(true, 'Онлайн');
        }
      }
    } catch (e) {}
  }

  if (!loaded) {
    updateConnectionStatus(false, 'Нет связи с сервером');
  }

  if (currentMenu && Object.keys(currentMenu).length > 0) {
    renderCategoryFilters();
    renderDishes();
    updateStats();
  }
}

async function syncMenuFromServer(showFeedback = false) {
  // If user is editing a dish modal, skip auto-sync to avoid interrupting input
  if (!showFeedback && document.querySelector('.admin-modal.active')) return;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/menu?t=' + Date.now(), { 
      signal: ctrl.signal,
      cache: 'no-cache'
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        currentMenu = data;
        localStorage.setItem('zaman_menu_cache', JSON.stringify(data));
        updateConnectionStatus(true, 'Онлайн');
        renderCategoryFilters();
        renderDishes();
        updateStats();
        if (showFeedback) showToast('🔄 Меню синхронизировано со всеми изменениями!');
      }
    }
  } catch (e) {
    if (showFeedback) showToast('⚠️ Не удалось загрузить свежие данные');
  }
}

function initSyncAndSharing() {
  const btnSync = document.getElementById('btnSyncMenu');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      const oldHtml = btnSync.innerHTML;
      btnSync.disabled = true;
      btnSync.innerHTML = '⏳ <span>Синхронизация...</span>';
      await syncMenuFromServer(true);
      setTimeout(() => {
        btnSync.disabled = false;
        btnSync.innerHTML = oldHtml;
      }, 500);
    });
  }

  const btnCopy = document.getElementById('btnCopyAdminLink');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const url = window.location.href.split('#')[0].split('?')[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('📋 Ссылка на админ-панель скопирована! Отправьте её другу.');
        }).catch(() => {
          prompt('Скопируйте ссылку на админ-панель для друга:', url);
        });
      } else {
        prompt('Скопируйте ссылку на админ-панель для друга:', url);
      }
    });
  }

  // Auto-sync when user switches back to this browser tab
  window.addEventListener('focus', () => {
    syncMenuFromServer(false);
  });

  // Background auto-sync every 25 seconds
  setInterval(() => {
    syncMenuFromServer(false);
  }, 25000);
}

async function saveMenuToServer(silent = false, modifiedCatKey = null) {
  // 1. Smart merge: fetch latest server menu first so changes made by another computer are never lost
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const freshRes = await fetch('/api/menu?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-cache' });
    clearTimeout(timer);
    if (freshRes.ok) {
      const serverMenu = await freshRes.json();
      if (serverMenu && typeof serverMenu === 'object' && Object.keys(serverMenu).length > 0) {
        if (modifiedCatKey && currentMenu[modifiedCatKey]) {
          // Keep our modified category, but adopt all other categories updated by the colleague
          const ourCategory = currentMenu[modifiedCatKey];
          currentMenu = Object.assign({}, serverMenu, { [modifiedCatKey]: ourCategory });
        } else {
          // Adopt any new categories from server
          for (const k in serverMenu) {
            if (!currentMenu[k]) {
              currentMenu[k] = serverMenu[k];
            }
          }
        }
      }
    }
  } catch (e) {}

  // 2. Immediately store in localStorage so changes are never lost
  try {
    localStorage.setItem('zaman_menu_cache', JSON.stringify(currentMenu));
    if (typeof window !== 'undefined') window.__INITIAL_MENU__ = currentMenu;
  } catch (e) {}

  // 3. Send to backend server API
  try {
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('zaman_admin_token') || '')
      },
      body: JSON.stringify(currentMenu)
    });

    if (res.ok) {
      updateConnectionStatus(true, 'Онлайн');
      if (!silent) showToast('✅ Меню успешно сохранено на сайте!');
      renderDishes();
      updateStats();
      return true;
    } else {
      updateConnectionStatus(false, 'Ошибка сервера ' + res.status);
      if (!silent) showToast('⚠️ Ошибка сервера (' + res.status + ') при сохранении');
      renderDishes();
      updateStats();
      return false;
    }
  } catch (err) {
    updateConnectionStatus(false, 'Нет связи с сервером');
    if (!silent) showToast('❌ Нет связи с сервером! Проверьте подключение.');
    renderDishes();
    updateStats();
    return false;
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config?t=' + Date.now());
    if (res.ok) {
      const cfg = await res.json();
      if (document.getElementById('cfgPhone')) document.getElementById('cfgPhone').value = cfg.phone || '';
      if (document.getElementById('cfgAddress')) document.getElementById('cfgAddress').value = cfg.address || '';
      if (document.getElementById('cfgInstagram')) document.getElementById('cfgInstagram').value = cfg.instagram || '';
      if (document.getElementById('cfgEmail')) document.getElementById('cfgEmail').value = cfg.adminEmail || '';
    }
  } catch (e) {}
}

/**
 * ============================================================
 * CATEGORY FILTERS & STATS
 * ============================================================
 */
function renderCategoryFilters() {
  const container = document.getElementById('categoryFilterStrip');
  if (!container) return;

  let inStopList = 0;
  Object.keys(currentMenu).forEach(key => {
    const cat = currentMenu[key];
    if (cat.dishes && Array.isArray(cat.dishes)) {
      cat.dishes.forEach(d => {
        if (d.available === false) inStopList++;
      });
    }
  });

  container.innerHTML = `
    <button type="button" class="cat-filter-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">
      🍽️ Все блюда
    </button>
    <button type="button" class="cat-filter-btn cat-filter-stoplist ${currentCategory === '__stoplist__' ? 'active' : ''}" data-cat="__stoplist__" title="Показать только позиции в стоп-листе">
      ⛔ Стоп-лист (${inStopList})
    </button>
  `;

  Object.keys(currentMenu).forEach(key => {
    const cat = currentMenu[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-filter-btn ${currentCategory === key ? 'active' : ''}`;
    btn.dataset.cat = key;
    btn.textContent = cat.title;
    container.appendChild(btn);
  });

  // Populate category select in Add Dish Modal
  const modalSelect = document.getElementById('dishModalCategory');
  if (modalSelect) {
    modalSelect.innerHTML = '';
    Object.keys(currentMenu).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${currentMenu[key].title} (${currentMenu[key].titleEn})`;
      modalSelect.appendChild(opt);
    });
  }
}

function initCategoryFilters() {
  const container = document.getElementById('categoryFilterStrip');
  if (!container) return;

  container.addEventListener('click', function(e) {
    const btn = e.target.closest('.cat-filter-btn');
    if (!btn) return;

    container.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.cat;
    renderDishes();
  });

  // Click on "В стоп-листе" stat item switches to stop-list filter
  const statStopListItem = document.getElementById('statStopListItem');
  if (statStopListItem) {
    statStopListItem.addEventListener('click', function() {
      currentCategory = '__stoplist__';
      renderCategoryFilters();
      renderDishes();
    });
  }
}

function initSearch() {
  const searchInput = document.getElementById('adminDishSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    currentSearch = this.value.trim().toLowerCase();
    renderDishes();
  });
}

function updateStats() {
  let totalDishes = 0;
  let totalCategories = Object.keys(currentMenu).length;
  let inStopList = 0;

  Object.keys(currentMenu).forEach(catKey => {
    const cat = currentMenu[catKey];
    if (cat.dishes && Array.isArray(cat.dishes)) {
      totalDishes += cat.dishes.length;
      cat.dishes.forEach(d => {
        if (d.available === false) inStopList++;
      });
    }
  });

  const totalEl = document.getElementById('statTotalDishes');
  const catEl = document.getElementById('statTotalCategories');
  const stopEl = document.getElementById('statStopList');

  if (totalEl) totalEl.textContent = totalDishes;
  if (catEl) catEl.textContent = totalCategories;
  if (stopEl) stopEl.textContent = inStopList;
}

/**
 * ============================================================
 * DISH CARDS RENDERING
 * ============================================================
 */
function renderDishes() {
  const container = document.getElementById('dishesGrid');
  if (!container) return;

  container.innerHTML = '';
  let count = 0;

  Object.keys(currentMenu).forEach(catKey => {
    if (currentCategory !== 'all' && currentCategory !== '__stoplist__' && currentCategory !== catKey) return;

    const cat = currentMenu[catKey];
    if (!cat.dishes || !Array.isArray(cat.dishes)) return;

    cat.dishes.forEach((dish, idx) => {
      const isAvailable = dish.available !== false;

      // When filtering by stop-list, skip dishes that are available
      if (currentCategory === '__stoplist__' && isAvailable) {
        return;
      }

      const name = dish.name || '';
      const desc = dish.desc || '';

      if (currentSearch) {
        if (!name.toLowerCase().includes(currentSearch) && !desc.toLowerCase().includes(currentSearch)) {
          return;
        }
      }

      count++;
      const card = document.createElement('article');
      card.className = `dish-admin-card ${isAvailable ? '' : 'in-stop-list'}`;
      card.id = `admin-dish-${dish.id || idx}`;

      const hasDualPrice = Boolean(dish.priceSmall && dish.priceBig);
      const priceControlsHtml = hasDualPrice ? `
        <div class="inline-dual-price-wrapper" title="Два размера (Маленькая и Большая)">
          <div class="inline-dual-col">
            <span class="inline-dual-label">М:</span>
            <input type="number" class="inline-price-input inline-price-sm" value="${dish.priceSmall}" min="0" step="5" data-cat="${catKey}" data-id="${dish.id || idx}" onchange="saveInlineDualPrice('${catKey}', '${dish.id || idx}')" onkeydown="if(event.key==='Enter'){event.preventDefault(); saveInlineDualPrice('${catKey}', '${dish.id || idx}'); this.blur();}">
            <span class="currency-label">с</span>
          </div>
          <div class="inline-dual-col">
            <span class="inline-dual-label">Б:</span>
            <input type="number" class="inline-price-input inline-price-bg" value="${dish.priceBig}" min="0" step="5" data-cat="${catKey}" data-id="${dish.id || idx}" onchange="saveInlineDualPrice('${catKey}', '${dish.id || idx}')" onkeydown="if(event.key==='Enter'){event.preventDefault(); saveInlineDualPrice('${catKey}', '${dish.id || idx}'); this.blur();}">
            <span class="currency-label">с</span>
          </div>
          <button type="button" class="btn-save-price" onclick="saveInlineDualPrice('${catKey}', '${dish.id || idx}')" title="Сохранить обе цены">💾</button>
        </div>
      ` : `
        <div class="inline-price-box">
          <input type="number" class="inline-price-input" value="${dish.price}" min="0" step="5" data-cat="${catKey}" data-id="${dish.id || idx}" onchange="saveInlinePrice('${catKey}', '${dish.id || idx}')" onkeydown="if(event.key==='Enter'){event.preventDefault(); saveInlinePrice('${catKey}', '${dish.id || idx}'); this.blur();}">
          <span class="currency-label">сом</span>
          <button type="button" class="btn-save-price" onclick="saveInlinePrice('${catKey}', '${dish.id || idx}')">Сохранить</button>
        </div>
      `;

      card.innerHTML = `
        <div class="dish-admin-card-top">
          <div class="dish-admin-thumb" style="background-image: url('${dish.image || 'images/salads/dish-1.jpg'}')"></div>
          <div class="dish-admin-info">
            <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
              <span class="dish-order-badge" title="Порядковый номер блюда в категории">#${idx + 1}</span>
              <span class="dish-admin-cat-badge">${cat.title}</span>
            </div>
            <h3 class="dish-admin-name">${dish.name}</h3>
            <p class="dish-admin-desc">${dish.desc || ''}</p>
          </div>
        </div>

        <div class="dish-admin-controls">
          ${priceControlsHtml}

          <div class="dish-admin-actions">
            <button type="button" class="btn-card-action btn-move" onclick="moveDish('${catKey}', '${dish.id || idx}', -1)" title="Поднять блюдо выше" ${idx === 0 ? 'disabled style="opacity:0.35; cursor:not-allowed;"' : ''}>
              ⬆️
            </button>
            <button type="button" class="btn-card-action btn-move" onclick="moveDish('${catKey}', '${dish.id || idx}', 1)" title="Опустить блюдо ниже" ${idx === cat.dishes.length - 1 ? 'disabled style="opacity:0.35; cursor:not-allowed;"' : ''}>
              ⬇️
            </button>
            <button type="button" class="btn-toggle-stock ${isAvailable ? 'active' : 'stopped'}" onclick="toggleDishStock('${catKey}', '${dish.id || idx}')" title="Нажмите для переключения доступности">
              ${isAvailable ? '✅ В наличии' : '⛔ Стоп-лист'}
            </button>
            <button type="button" class="btn-card-action" onclick="openEditDishModal('${catKey}', '${dish.id || idx}')" title="Редактировать блюдо">
              ✏️
            </button>
            <button type="button" class="btn-card-action" onclick="deleteDish('${catKey}', '${dish.id || idx}')" title="Удалить блюдо">
              🗑️
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  });

  if (count === 0) {
    if (currentCategory === '__stoplist__') {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 0.6rem;">🎉</div>
          <h3 style="font-size: 1.3rem; color: #81C784; margin-bottom: 0.35rem; font-family: 'Playfair Display', serif;">Стоп-лист пуст!</h3>
          <p style="font-size: 0.95rem;">Все блюда ресторана сейчас в наличии и доступны гостям.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <p style="font-size: 1.1rem;">Блюда не найдены по заданным критериям</p>
        </div>
      `;
    }
  }
}

/**
 * Move Dish Up / Down in Sequence
 */
window.moveDish = async function(catKey, dishId, direction) {
  if (!currentMenu[catKey] || !currentMenu[catKey].dishes) return;
  const list = currentMenu[catKey].dishes;
  const idx = list.findIndex((d, i) => (d.id == dishId || i == dishId));
  if (idx === -1) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= list.length) return;

  // Swap
  const item = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = item;

  const saved = await saveMenuToServer(true, catKey);
  if (saved) {
    renderDishes();
    showToast(`✅ «${item.name}» перемещено на позицию #${targetIdx + 1}`);
  }
};

/**
 * Inline Price Quick Save
 */
window.saveInlinePrice = async function(catKey, dishId) {
  const input = document.querySelector(`.inline-price-input[data-cat="${catKey}"][data-id="${dishId}"]`);
  if (!input) return;

  const newPrice = parseInt(input.value, 10);
  if (isNaN(newPrice) || newPrice < 0) {
    showToast('⚠️ Укажите корректную цену');
    return;
  }

  const dish = findDish(catKey, dishId);
  if (dish) {
    dish.price = newPrice;
    
    // Visual green flash confirmation
    const box = input.closest('.inline-price-box');
    if (box) {
      box.style.transition = 'all 0.25s ease';
      box.style.boxShadow = '0 0 12px #4CAF50';
      box.style.borderColor = '#4CAF50';
      setTimeout(() => {
        box.style.boxShadow = '';
        box.style.borderColor = '';
      }, 1500);
    }

    await saveMenuToServer(true, catKey);
    showToast(`✅ Цена «${dish.name}» сохранена: ${newPrice} сом`);
  }
};

/**
 * Inline Dual Price Quick Save (Pizza / Sizes)
 */
window.saveInlineDualPrice = async function(catKey, dishId) {
  const smInput = document.querySelector(`.inline-price-sm[data-cat="${catKey}"][data-id="${dishId}"]`);
  const bgInput = document.querySelector(`.inline-price-bg[data-cat="${catKey}"][data-id="${dishId}"]`);
  if (!smInput || !bgInput) return;

  const pSmall = parseInt(smInput.value, 10);
  const pBig = parseInt(bgInput.value, 10);
  if (isNaN(pSmall) || isNaN(pBig) || pSmall < 0 || pBig < 0) {
    showToast('⚠️ Укажите корректные цены (Маленькая и Большая)');
    return;
  }

  const dish = findDish(catKey, dishId);
  if (dish) {
    dish.priceSmall = pSmall;
    dish.priceBig = pBig;
    dish.price = pSmall;

    const wrapper = smInput.closest('.inline-dual-price-wrapper');
    if (wrapper) {
      wrapper.style.transition = 'all 0.25s ease';
      wrapper.style.boxShadow = '0 0 12px #4CAF50';
      wrapper.style.borderColor = '#4CAF50';
      setTimeout(() => {
        wrapper.style.boxShadow = '';
        wrapper.style.borderColor = '';
      }, 1500);
    }

    await saveMenuToServer(true, catKey);
    showToast(`✅ Цены «${dish.name}» сохранены: М: ${pSmall} с / Б: ${pBig} с`);
  }
};

/**
 * Toggle Stock / Stop-List
 */
window.toggleDishStock = async function(catKey, dishId) {
  const dish = findDish(catKey, dishId);
  if (!dish) return;

  dish.available = (dish.available === false) ? true : false;
  await saveMenuToServer(true, catKey);

  if (dish.available) {
    showToast(`✅ «${dish.name}» снова в наличии`);
  } else {
    showToast(`⛔ «${dish.name}» отправлено в стоп-лист`);
  }
};

/**
 * Delete Dish
 */
window.deleteDish = async function(catKey, dishId) {
  const dish = findDish(catKey, dishId);
  if (!dish) return;

  if (confirm(`Вы уверены, что хотите удалить блюдо «${dish.name}»?`)) {
    const list = currentMenu[catKey].dishes;
    const idx = list.findIndex(d => (d.id == dishId || d.name == dish.name));
    if (idx !== -1) {
      list.splice(idx, 1);
      await saveMenuToServer(true, catKey);
      showToast(`🗑️ Блюдо «${dish.name}» удалено`);
    }
  }
};

function findDish(catKey, dishId) {
  if (!currentMenu[catKey] || !currentMenu[catKey].dishes) return null;
  return currentMenu[catKey].dishes.find((d, i) => (d.id == dishId || i == dishId));
}

/**
 * ============================================================
 * MODALS (Add / Edit Dish & Settings)
 * ============================================================
 */
function initModals() {
  const modal = document.getElementById('dishModal');
  const closeBtn = document.getElementById('dishModalClose');
  const cancelBtn = document.getElementById('dishModalCancel');
  const form = document.getElementById('dishModalForm');
  const fileInput = document.getElementById('dishPhotoFile');
  const photoPreview = document.getElementById('photoPreviewBox');
  const btnOpenAdd = document.getElementById('btnOpenAddDish');

  // Dual Price helper
  function updateModalPriceMode(isDual) {
    const chk = document.getElementById('dishModalHasDualPrice');
    const groupSingle = document.getElementById('groupSinglePrice');
    const groupDual = document.getElementById('groupDualPriceInputs');
    const priceInput = document.getElementById('dishModalPrice');
    const priceSmInput = document.getElementById('dishModalPriceSmall');
    const priceBgInput = document.getElementById('dishModalPriceBig');

    if (chk) chk.checked = isDual;
    if (groupSingle) groupSingle.style.display = isDual ? 'none' : 'block';
    if (groupDual) groupDual.style.display = isDual ? 'block' : 'none';
    if (priceInput) priceInput.required = !isDual;
    if (priceSmInput) priceSmInput.required = isDual;
    if (priceBgInput) priceBgInput.required = isDual;
  }

  const dualCheck = document.getElementById('dishModalHasDualPrice');
  if (dualCheck) {
    dualCheck.addEventListener('change', function() {
      updateModalPriceMode(this.checked);
      if (this.checked) {
        const singleVal = document.getElementById('dishModalPrice').value;
        const smVal = document.getElementById('dishModalPriceSmall').value;
        if (!smVal && singleVal) {
          document.getElementById('dishModalPriceSmall').value = singleVal;
        }
      } else {
        const smVal = document.getElementById('dishModalPriceSmall').value;
        const singleVal = document.getElementById('dishModalPrice').value;
        if (!singleVal && smVal) {
          document.getElementById('dishModalPrice').value = smVal;
        }
      }
    });
  }

  const catSelect = document.getElementById('dishModalCategory');
  if (catSelect) {
    catSelect.addEventListener('change', function() {
      const isPizza = this.value === 'pizza' || this.value.toLowerCase().includes('pizza') || this.value.toLowerCase().includes('пицца');
      if (isPizza) {
        updateModalPriceMode(true);
      }
    });
  }

  // Open Add Modal
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', function() {
      editingDishId = null;
      editingCategoryKey = null;
      tempPhotoBase64 = null;
      form.reset();
      const posGroup = document.getElementById('dishModalPositionGroup');
      if (posGroup) posGroup.style.display = 'none';

      const isPizza = (currentCategory === 'pizza') || (currentCategory.toLowerCase().includes('pizza')) || (currentCategory.toLowerCase().includes('пицца'));
      updateModalPriceMode(isPizza);

      document.getElementById('dishModalTitle').textContent = '➕ Добавить новое блюдо';
      document.getElementById('dishModalSubmitBtn').textContent = 'Добавить в меню';
      document.getElementById('dishModalPrice').value = '';
      document.getElementById('dishModalPriceSmall').value = '';
      document.getElementById('dishModalPriceBig').value = '';
      photoPreview.style.backgroundImage = '';
      photoPreview.textContent = '📷';
      modal.classList.add('active');
    });
  }

  // Close Modal
  function closeModal() {
    modal.classList.remove('active');
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Handle Photo selection & compression
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        // Resize image to max 800px width/height for fast loading & compact storage
        resizeImage(evt.target.result, 800, 800, function(compressedBase64) {
          tempPhotoBase64 = compressedBase64;
          photoPreview.style.backgroundImage = `url('${tempPhotoBase64}')`;
          photoPreview.textContent = '';
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Save Dish Form
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const catKey = document.getElementById('dishModalCategory').value;
      const name = document.getElementById('dishModalName').value.trim();
      const desc = document.getElementById('dishModalDesc').value.trim();

      const hasDualPrice = Boolean(document.getElementById('dishModalHasDualPrice')?.checked);
      let price = 0;
      let priceSmall = null;
      let priceBig = null;

      if (hasDualPrice) {
        const pSm = parseInt(document.getElementById('dishModalPriceSmall').value, 10);
        const pBg = parseInt(document.getElementById('dishModalPriceBig').value, 10);
        if (isNaN(pSm) && isNaN(pBg)) {
          showToast('⚠️ Укажите хотя бы одну цену для пиццы (Маленькая / Большая)');
          return;
        }
        priceSmall = !isNaN(pSm) ? pSm : pBg;
        priceBig = !isNaN(pBg) ? pBg : pSm;
        price = priceSmall;
      } else {
        price = parseInt(document.getElementById('dishModalPrice').value, 10);
        if (isNaN(price)) {
          showToast('⚠️ Заполните название и цену');
          return;
        }
      }

      if (!name) {
        showToast('⚠️ Заполните название блюда');
        return;
      }

      let imagePath = 'images/salads/dish-1.jpg'; // default placeholder

      // If user uploaded a new photo, send it to the server
      if (tempPhotoBase64) {
        showToast('⏳ Сохранение фотографии...');
        try {
          const upRes = await fetch('/api/upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: `${name}.jpg`,
              base64: tempPhotoBase64
            })
          });
          const upData = await upRes.json();
          if (upRes.ok && upData.filePath) {
            imagePath = upData.filePath;
          }
        } catch (err) {
          console.error(err);
        }
      }

      if (editingDishId !== null && editingCategoryKey !== null) {
        // EDIT EXISTING DISH
        const dish = findDish(editingCategoryKey, editingDishId);
        if (dish) {
          dish.name = name;
          dish.price = price;
          dish.desc = desc;
          if (hasDualPrice) {
            dish.priceSmall = priceSmall;
            dish.priceBig = priceBig;
          } else {
            delete dish.priceSmall;
            delete dish.priceBig;
          }
          if (tempPhotoBase64) dish.image = imagePath;

          let targetList = currentMenu[catKey].dishes;

          // If category changed, move it
          if (editingCategoryKey !== catKey) {
            const oldList = currentMenu[editingCategoryKey].dishes;
            const idx = oldList.findIndex(d => (d.id == editingDishId || d.name == dish.name));
            if (idx !== -1) oldList.splice(idx, 1);
            if (!currentMenu[catKey].dishes) currentMenu[catKey].dishes = [];
            currentMenu[catKey].dishes.push(dish);
            targetList = currentMenu[catKey].dishes;
          }

          // If position within category changed, move it
          const posInput = document.getElementById('dishModalPosition');
          if (posInput && posInput.value && targetList) {
            const targetPos = parseInt(posInput.value, 10);
            if (!isNaN(targetPos) && targetPos >= 1 && targetPos <= targetList.length) {
              const currentIdx = targetList.findIndex(d => (d.id == dish.id || d.name == dish.name));
              if (currentIdx !== -1 && currentIdx !== (targetPos - 1)) {
                const [moved] = targetList.splice(currentIdx, 1);
                targetList.splice(targetPos - 1, 0, moved);
              }
            }
          }

          await saveMenuToServer(false, catKey);
          showToast(`✅ Блюдо «${name}» обновлено!`);
        }
      } else {
        // ADD NEW DISH
        const newId = `${catKey}-${Date.now().toString().slice(-4)}`;
        const newDish = {
          id: newId,
          name: name,
          price: price,
          desc: desc,
          image: imagePath,
          available: true
        };
        if (hasDualPrice) {
          newDish.priceSmall = priceSmall;
          newDish.priceBig = priceBig;
        }

        if (!currentMenu[catKey].dishes) currentMenu[catKey].dishes = [];
        currentMenu[catKey].dishes.push(newDish);

        await saveMenuToServer(false, catKey);
        showToast(`✅ Блюдо «${name}» добавлено в меню!`);
      }

      closeModal();
    });
  }

  // Settings Modal
  initSettingsModal();

  // Categories Modal
  initCategoriesModal();
}

/**
 * Open Edit Dish Modal
 */
window.openEditDishModal = function(catKey, dishId) {
  const dish = findDish(catKey, dishId);
  if (!dish) return;

  editingDishId = dishId;
  editingCategoryKey = catKey;
  tempPhotoBase64 = null;

  document.getElementById('dishModalTitle').textContent = `✏️ Редактировать: ${dish.name}`;
  document.getElementById('dishModalSubmitBtn').textContent = 'Сохранить изменения';
  document.getElementById('dishModalCategory').value = catKey;
  document.getElementById('dishModalName').value = dish.name;
  document.getElementById('dishModalDesc').value = dish.desc || '';

  const hasDual = Boolean((dish.priceSmall && dish.priceBig) || (catKey === 'pizza' && (dish.priceSmall || (dish.name && dish.name.toLowerCase().includes('пицца')))));
  const chk = document.getElementById('dishModalHasDualPrice');
  const groupSingle = document.getElementById('groupSinglePrice');
  const groupDual = document.getElementById('groupDualPriceInputs');
  const priceInput = document.getElementById('dishModalPrice');
  const priceSmInput = document.getElementById('dishModalPriceSmall');
  const priceBgInput = document.getElementById('dishModalPriceBig');

  if (chk) chk.checked = hasDual;
  if (groupSingle) groupSingle.style.display = hasDual ? 'none' : 'block';
  if (groupDual) groupDual.style.display = hasDual ? 'block' : 'none';

  if (hasDual) {
    if (priceSmInput) {
      priceSmInput.required = true;
      priceSmInput.value = dish.priceSmall || dish.price || '';
    }
    if (priceBgInput) {
      priceBgInput.required = true;
      priceBgInput.value = dish.priceBig || dish.price || '';
    }
    if (priceInput) {
      priceInput.required = false;
      priceInput.value = dish.price || dish.priceSmall || '';
    }
  } else {
    if (priceInput) {
      priceInput.required = true;
      priceInput.value = dish.price || '';
    }
    if (priceSmInput) {
      priceSmInput.required = false;
      priceSmInput.value = '';
    }
    if (priceBgInput) {
      priceBgInput.required = false;
      priceBgInput.value = '';
    }
  }

  const posGroup = document.getElementById('dishModalPositionGroup');
  const posInput = document.getElementById('dishModalPosition');
  const posMax = document.getElementById('dishModalPositionMax');
  if (posGroup && posInput && currentMenu[catKey] && currentMenu[catKey].dishes) {
    posGroup.style.display = 'block';
    const totalInCat = currentMenu[catKey].dishes.length;
    const curIdx = currentMenu[catKey].dishes.findIndex((d, i) => (d.id == dishId || i == dishId));
    posInput.value = (curIdx >= 0) ? (curIdx + 1) : 1;
    posInput.max = totalInCat;
    if (posMax) posMax.textContent = `(из ${totalInCat})`;
  }

  const photoPreview = document.getElementById('photoPreviewBox');
  if (dish.image) {
    photoPreview.style.backgroundImage = `url('${dish.image}')`;
    photoPreview.textContent = '';
  } else {
    photoPreview.style.backgroundImage = '';
    photoPreview.textContent = '📷';
  }

  document.getElementById('dishModal').classList.add('active');
};

/**
 * Settings Modal Controller
 */
function initSettingsModal() {
  const settingsModal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('btnOpenSettings');
  const closeBtn = document.getElementById('settingsModalClose');
  const form = document.getElementById('settingsForm');

  if (openBtn) {
    openBtn.addEventListener('click', function() {
      settingsModal.classList.add('active');
    });
  }

  function closeSettings() {
    settingsModal.classList.remove('active');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeSettings);
  if (settingsModal) {
    settingsModal.addEventListener('click', function(e) {
      if (e.target === settingsModal) closeSettings();
    });
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const phone = document.getElementById('cfgPhone').value.trim();
      const address = document.getElementById('cfgAddress').value.trim();
      const instagram = document.getElementById('cfgInstagram').value.trim();
      const adminEmail = document.getElementById('cfgEmail') ? document.getElementById('cfgEmail').value.trim() : '';
      const newPassword = document.getElementById('cfgNewPassword').value.trim();

      const payload = { phone, address, instagram, adminEmail };
      if (newPassword) payload.newPassword = newPassword;

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('✅ Настройки успешно сохранены!');
          if (newPassword) {
            showToast('🔑 Пароль изменён. Войдите с новым паролем.');
            localStorage.removeItem('zaman_admin_token');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            closeSettings();
          }
        } else {
          showToast('❌ Ошибка сохранения настроек');
        }
      } catch (err) {
        showToast('❌ Ошибка сети');
      }
    });
  }
}

/**
 * ============================================================
 * CATEGORIES MANAGEMENT MODAL
 * ============================================================
 */
function initCategoriesModal() {
  const modal = document.getElementById('categoriesModal');
  const openBtn = document.getElementById('btnOpenCategories');
  const closeBtn = document.getElementById('categoriesModalClose');
  const addBtn = document.getElementById('btnAddNewCategory');

  if (openBtn) {
    openBtn.addEventListener('click', function() {
      renderCategoriesList();
      modal.classList.add('active');
    });
  }

  function closeCatModal() {
    modal.classList.remove('active');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeCatModal);
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeCatModal();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', async function() {
      const titleInput = document.getElementById('newCatTitle');
      const titleEnInput = document.getElementById('newCatTitleEn');
      const pageInput = document.getElementById('newCatPage');

      const title = titleInput.value.trim();
      const titleEn = titleEnInput.value.trim();
      const page = pageInput.value.trim();

      if (!title) {
        showToast('⚠️ Введите русское название категории');
        titleInput.focus();
        return;
      }

      // Generate a slug/key for category
      let slug = (titleEn || title)
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Transliterate if Cyrillic
      slug = transliterateToLatin(slug) || 'cat_' + Date.now();

      // Ensure unique slug
      let finalSlug = slug;
      let counter = 1;
      while (currentMenu[finalSlug]) {
        finalSlug = `${slug}-${counter++}`;
      }

      // Compute default page number
      const existingKeys = Object.keys(currentMenu);
      const defaultPage = page || (existingKeys.length * 2 + 2).toString().padStart(2, '0');

      currentMenu[finalSlug] = {
        title: title,
        titleEn: titleEn || title,
        page: defaultPage,
        href: `${finalSlug}.html`,
        thumb: 'images/salads/thumb.jpg',
        dishes: []
      };

      const saved = await saveMenuToServer();
      if (saved) {
        titleInput.value = '';
        titleEnInput.value = '';
        pageInput.value = '';
        renderCategoriesList();
        renderCategoryFilters();
        showToast(`✅ Категория «${title}» успешно создана!`);
      }
    });
  }
}

function transliterateToLatin(text) {
  const ru = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return text.split('').map(char => {
    const lower = char.toLowerCase();
    return ru[lower] !== undefined ? ru[lower] : lower;
  }).join('').replace(/[^a-z0-9-]/g, '');
}

function renderCategoriesList() {
  const container = document.getElementById('categoriesListContainer');
  const countEl = document.getElementById('catListCount');
  if (!container) return;

  const keys = Object.keys(currentMenu);
  if (countEl) countEl.textContent = keys.length;

  container.innerHTML = '';

  keys.forEach((catKey, idx) => {
    const cat = currentMenu[catKey];
    const dishCount = (cat.dishes && Array.isArray(cat.dishes)) ? cat.dishes.length : 0;

    const item = document.createElement('div');
    item.className = 'category-admin-item';
    item.id = `cat-card-${catKey}`;

    item.innerHTML = `
      <div class="cat-item-top" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.8rem;">
        <div style="display:flex; align-items:center; gap:0.55rem;">
          <span class="cat-pos-badge" title="Порядковый номер категории">#${idx + 1}</span>
          <strong style="color:var(--gold-bright); font-size:1rem; font-family:'Playfair Display', serif;">${cat.title}</strong>
          <span class="cat-item-key-badge" style="font-size:0.75rem;">${catKey}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <span class="cat-item-dish-count">🍲 ${dishCount} ${getDishWordForm(dishCount)}</span>
          <div style="display:flex; gap:0.3rem;">
            <button type="button" class="btn-cat-move" onclick="moveCategory('${catKey}', -1)" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="Поднять категорию выше в меню">⬆️ Выше</button>
            <button type="button" class="btn-cat-move" onclick="moveCategory('${catKey}', 1)" ${idx === keys.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="Опустить категорию ниже в меню">⬇️ Ниже</button>
          </div>
        </div>
      </div>
      <div class="cat-item-fields">
        <div style="max-width: 90px;">
          <label class="form-label" style="font-size:0.75rem;">Позиция:</label>
          <input type="number" class="form-input" min="1" max="${keys.length}" value="${idx + 1}" style="font-weight:700; text-align:center; color:var(--gold-bright);" onchange="moveCategoryToPos('${catKey}', this.value)" title="Введите номер позиции, чтобы переместить категорию">
        </div>
        <div style="flex: 2;">
          <label class="form-label" style="font-size:0.75rem;">Название (рус):</label>
          <input type="text" class="form-input" id="cat-title-${catKey}" value="${cat.title || ''}" placeholder="Название...">
        </div>
        <div style="flex: 2;">
          <label class="form-label" style="font-size:0.75rem;">Подзаголовок (eng):</label>
          <input type="text" class="form-input" id="cat-titleen-${catKey}" value="${cat.titleEn || ''}" placeholder="English...">
        </div>
        <div style="max-width: 90px;">
          <label class="form-label" style="font-size:0.75rem;">Номер/Стр:</label>
          <input type="text" class="form-input" id="cat-page-${catKey}" value="${cat.page || ''}" placeholder="02">
        </div>
        <div class="cat-item-actions">
          <button type="button" class="btn-cat-save" onclick="saveCategoryMeta('${catKey}')" title="Сохранить изменения в названии">
            💾 Сохранить
          </button>
          <button type="button" class="btn-cat-delete" onclick="deleteCategory('${catKey}')" title="Удалить категорию">
            🗑️
          </button>
        </div>
      </div>
    `;

    container.appendChild(item);
  });
}

/**
 * Move Category Up / Down
 */
window.moveCategory = async function(catKey, direction) {
  const keys = Object.keys(currentMenu);
  const idx = keys.indexOf(catKey);
  if (idx === -1) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= keys.length) return;

  const temp = keys[idx];
  keys[idx] = keys[targetIdx];
  keys[targetIdx] = temp;

  const newMenu = {};
  keys.forEach(k => {
    newMenu[k] = currentMenu[k];
  });
  currentMenu = newMenu;

  const saved = await saveMenuToServer(true);
  if (saved) {
    renderCategoriesList();
    renderCategoryFilters();
    renderDishes();
    showToast(`✅ Порядок обновлен: «${currentMenu[temp].title}» перемещена!`);
  }
};

/**
 * Move Category to Specific Position Number
 */
window.moveCategoryToPos = async function(catKey, targetPos) {
  const pos = parseInt(targetPos, 10);
  const keys = Object.keys(currentMenu);
  const idx = keys.indexOf(catKey);
  if (idx === -1 || isNaN(pos)) return;

  let targetIdx = pos - 1;
  if (targetIdx < 0) targetIdx = 0;
  if (targetIdx >= keys.length) targetIdx = keys.length - 1;
  if (idx === targetIdx) return;

  const [movedKey] = keys.splice(idx, 1);
  keys.splice(targetIdx, 0, movedKey);

  const newMenu = {};
  keys.forEach(k => {
    newMenu[k] = currentMenu[k];
  });
  currentMenu = newMenu;

  const saved = await saveMenuToServer(true);
  if (saved) {
    renderCategoriesList();
    renderCategoryFilters();
    renderDishes();
    showToast(`✅ Категория «${currentMenu[movedKey].title}» перемещена на позицию #${targetIdx + 1}!`);
  }
};

function getDishWordForm(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'блюд';
  if (mod10 === 1) return 'блюдо';
  if (mod10 >= 2 && mod10 <= 4) return 'блюда';
  return 'блюд';
}

window.saveCategoryMeta = async function(catKey) {
  const titleInput = document.getElementById(`cat-title-${catKey}`);
  const titleEnInput = document.getElementById(`cat-titleen-${catKey}`);
  const pageInput = document.getElementById(`cat-page-${catKey}`);

  if (!titleInput) return;

  const newTitle = titleInput.value.trim();
  const newTitleEn = titleEnInput ? titleEnInput.value.trim() : '';
  const newPage = pageInput ? pageInput.value.trim() : '';

  if (!newTitle) {
    showToast('⚠️ Название категории не может быть пустым');
    return;
  }

  if (currentMenu[catKey]) {
    currentMenu[catKey].title = newTitle;
    currentMenu[catKey].titleEn = newTitleEn;
    currentMenu[catKey].page = newPage;

    await saveMenuToServer();
    renderCategoryFilters();
    renderDishes();
    showToast(`✅ Категория «${newTitle}» обновлена!`);
  }
};

window.deleteCategory = async function(catKey) {
  const cat = currentMenu[catKey];
  if (!cat) return;

  const dishCount = (cat.dishes && Array.isArray(cat.dishes)) ? cat.dishes.length : 0;
  let confirmMsg = `Удалить категорию «${cat.title}»?`;
  if (dishCount > 0) {
    confirmMsg = `⚠️ В категории «${cat.title}» находится ${dishCount} ${getDishWordForm(dishCount)}!\nПри удалении категории эти блюда также будут удалены.\n\nВы уверены, что хотите удалить?`;
  }

  if (confirm(confirmMsg)) {
    delete currentMenu[catKey];
    if (currentCategory === catKey) {
      currentCategory = 'all';
    }
    await saveMenuToServer();
    renderCategoriesList();
    renderCategoryFilters();
    renderDishes();
    showToast(`🗑️ Категория «${cat.title}» удалена`);
  }
};

/**
 * Canvas Image Resizer (ensures fast upload on mobile network)
 */
function resizeImage(base64Str, maxWidth, maxHeight, callback) {
  const img = new Image();
  img.src = base64Str;
  img.onload = function() {
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', 0.85));
  };
}

/**
 * Toast Notification Utility
 */
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * ============================================================
 * GMAIL PASSWORD RECOVERY MODAL
 * ============================================================
 */
function initForgotPasswordModal() {
  const openBtn = document.getElementById('btnOpenForgotModal');
  const modal = document.getElementById('forgotModal');
  const closeBtn = document.getElementById('forgotModalClose');
  const step1 = document.getElementById('forgotStep1');
  const step2 = document.getElementById('forgotStep2');
  const emailInput = document.getElementById('recoveryEmailInput');
  const error1 = document.getElementById('forgotError1');
  const error2 = document.getElementById('forgotError2');
  const sendCodeBtn = document.getElementById('btnSendRecoveryCode');
  const codeInput = document.getElementById('recoveryCodeInput');
  const newPassInput = document.getElementById('recoveryNewPasswordInput');
  const submitNewPassBtn = document.getElementById('btnSubmitNewPassword');
  const displayCode = document.getElementById('displayRecoveryCode');
  const actAlert = document.getElementById('activationAlertBox');
  const actEmail = document.getElementById('activationAlertEmail');
  const btnReveal = document.getElementById('btnRevealFallbackCode');
  const fallbackContainer = document.getElementById('fallbackCodeContainer');
  const toggleRecEye = document.getElementById('btnToggleRecoveryPassword');

  if (!openBtn || !modal) return;

  function closeModal() {
    modal.style.display = 'none';
    step1.style.display = 'block';
    step2.style.display = 'none';
    if (error1) error1.style.display = 'none';
    if (error2) error2.style.display = 'none';
    if (actAlert) actAlert.style.display = 'none';
    if (fallbackContainer) fallbackContainer.style.display = 'none';
  }

  openBtn.addEventListener('click', function() {
    modal.style.display = 'flex';
    step1.style.display = 'block';
    step2.style.display = 'none';
    if (error1) error1.style.display = 'none';
    if (error2) error2.style.display = 'none';
    if (actAlert) actAlert.style.display = 'none';
    if (fallbackContainer) fallbackContainer.style.display = 'none';
    if (emailInput) {
      if (!emailInput.value) emailInput.value = 'zafarpazilov3@gmail.com';
      setTimeout(() => emailInput.focus(), 100);
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Eye toggle for new password in recovery modal
  if (toggleRecEye && newPassInput) {
    toggleRecEye.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (newPassInput.type === 'password') {
        newPassInput.type = 'text';
        toggleRecEye.textContent = '🙈';
        toggleRecEye.title = 'Скрыть пароль';
      } else {
        newPassInput.type = 'password';
        toggleRecEye.textContent = '👁️';
        toggleRecEye.title = 'Показать пароль';
      }
    });
  }

  // Fallback code reveal
  if (btnReveal && fallbackContainer) {
    btnReveal.addEventListener('click', function(e) {
      e.preventDefault();
      const isHidden = fallbackContainer.style.display === 'none' || !fallbackContainer.style.display;
      fallbackContainer.style.display = isHidden ? 'block' : 'none';
    });
  }

  // Click on code box to auto-insert
  if (displayCode && codeInput) {
    displayCode.addEventListener('click', function() {
      codeInput.value = displayCode.textContent.trim();
      showToast('📋 Код вставлен в поле ввода!');
      if (newPassInput) newPassInput.focus();
    });
  }

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', async function() {
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) {
        error1.textContent = 'Пожалуйста, введите корректный адрес Gmail';
        error1.style.display = 'block';
        return;
      }
      error1.style.display = 'none';
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = 'Проверка...';

      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          step1.style.display = 'none';
          step2.style.display = 'block';
          const sentTarget = document.getElementById('sentTargetEmail');
          if (sentTarget) sentTarget.textContent = data.email || email;
          if (displayCode) displayCode.textContent = data.code || '123456';
          if (codeInput) codeInput.value = '';

          if (data.needsActivation && actAlert) {
            actAlert.style.display = 'block';
            if (actEmail) actEmail.textContent = data.email || email;
            showToast('⚠️ Проверьте письмо активации в папке «Спам» Gmail!');
          } else {
            if (actAlert) actAlert.style.display = 'none';
            showToast('✉️ ' + (data.message || 'Запрос отправлен!'));
          }

          if (codeInput) setTimeout(() => codeInput.focus(), 150);
        } else {
          error1.textContent = data.message || 'Ошибка восстановления доступа';
          error1.style.display = 'block';
        }
      } catch (err) {
        error1.textContent = 'Ошибка соединения с сервером';
        error1.style.display = 'block';
      } finally {
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Получить проверочный код ➔';
      }
    });
  }

  if (submitNewPassBtn) {
    submitNewPassBtn.addEventListener('click', async function() {
      const email = emailInput ? emailInput.value.trim() : '';
      const code = codeInput.value.trim();
      const newPassword = newPassInput.value.trim();

      if (!code || code.length !== 6) {
        error2.textContent = 'Введите 6-значный проверочный код';
        error2.style.display = 'block';
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        error2.textContent = 'Пароль должен содержать минимум 4 символа';
        error2.style.display = 'block';
        return;
      }

      error2.style.display = 'none';
      submitNewPassBtn.disabled = true;
      submitNewPassBtn.textContent = 'Сохранение...';

      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('🎉 ' + data.message);
          closeModal();

          if (data.token) {
            localStorage.setItem('zaman_admin_token', data.token);
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';
            loadMenu();
            loadConfig();
          } else {
            const passInput = document.getElementById('adminPasswordInput');
            if (passInput) {
              passInput.value = newPassword;
              passInput.focus();
            }
          }
        } else {
          error2.textContent = data.message || 'Неверный проверочный код';
          error2.style.display = 'block';
        }
      } catch (err) {
        error2.textContent = 'Ошибка сети при сохранении пароля';
        error2.style.display = 'block';
      } finally {
        submitNewPassBtn.disabled = false;
        submitNewPassBtn.textContent = 'Сохранить новый пароль и войти ➔';
      }
    });
  }
}
