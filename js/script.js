// ZAMAN Chaihana - Client Menu Script
let ACTIVE_MENU = null;
let CURRENT_ACTIVE_CATEGORY = 'combos';

document.addEventListener('DOMContentLoaded', function() {
  initCoverActions();
  initCategoryPills();
  initPWA();
  syncMenuData();
});

/**
 * Handle Cover Poster "Открыть меню блюд" button
 */
function initCoverActions() {
  const btn = document.getElementById('btnOpenMenu');
  if (btn) {
    btn.addEventListener('click', function(e) {
      const target = document.getElementById('categoryPillsBar');
      if (target) {
        e.preventDefault();
        const headerOffset = 64;
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
      // If no categoryPillsBar on current page, allow standard navigation to href="menu.html"
    });
  }
}

/**
 * Switch active category: shows ONLY dishes of that category!
 */
function selectCategory(catKey) {
  if (!catKey) return;
  CURRENT_ACTIVE_CATEGORY = catKey;

  // 1. Highlight active pill & auto-scroll pill bar
  const pills = document.querySelectorAll('.cat-pill');
  pills.forEach(pill => {
    const pCat = pill.dataset.cat || pill.getAttribute('href')?.replace('#sec-', '');
    if (pCat === catKey) {
      pill.classList.add('active');
      pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } else {
      pill.classList.remove('active');
    }
  });

  // 2. Hide all category sections, show ONLY selected one
  const sections = document.querySelectorAll('.menu-sheet-section');
  sections.forEach(sec => {
    if (sec.id === `sec-${catKey}` || catKey === 'all') {
      sec.style.display = 'block';
    } else {
      sec.style.display = 'none';
    }
  });

  // 3. Smooth scroll to top of catalog area if page is scrolled lower
  const bar = document.getElementById('categoryPillsBar');
  if (bar) {
    const barRect = bar.getBoundingClientRect();
    if (barRect.top < 0) {
      window.scrollTo({
        top: window.pageYOffset + barRect.top - 65,
        behavior: 'smooth'
      });
    }
  }
}

/**
 * Initialize category pills click listeners
 */
function initCategoryPills() {
  const pills = document.querySelectorAll('.cat-pill');
  if (!pills.length) return;

  pills.forEach(pill => {
    if (pill.dataset.bound) return;
    pill.dataset.bound = 'true';
    pill.addEventListener('click', function(e) {
      e.preventDefault();
      const catKey = this.dataset.cat || this.getAttribute('href')?.replace('#sec-', '');
      if (catKey) {
        selectCategory(catKey);
      }
    });
  });

  // Activate initial category
  const activePill = document.querySelector('.cat-pill.active') || pills[0];
  if (activePill) {
    const initialCat = activePill.dataset.cat || activePill.getAttribute('href')?.replace('#sec-', '');
    if (initialCat) {
      selectCategory(initialCat);
    }
  }
}

/**
 * Sync menu dynamically from backend API / data/menu.json / offline cache
 */
async function syncMenuData() {
  // 0. Instantly apply localStorage cache if present
  try {
    const cached = localStorage.getItem('zaman_menu_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        ACTIVE_MENU = parsed;
        renderCategoryPills(parsed);
        renderCatalogDishes(parsed);
      }
    }
  } catch (e) {}

  let loadedData = null;

  // 1. Try local server API
  try {
    const res = await fetch('/api/menu?t=' + Date.now());
    if (res.ok) {
      loadedData = await res.json();
    }
  } catch (e) {}

  // 2. Fallback to static data/menu.json
  if (!loadedData || typeof loadedData !== 'object' || Object.keys(loadedData).length === 0) {
    try {
      const res = await fetch('data/menu.json?t=' + Date.now());
      if (res.ok) {
        loadedData = await res.json();
      }
    } catch (e) {}
  }

  // 3. Fallback to GitHub Raw CDN (super-fast, 100% uptime, immune to Render sleep)
  if (!loadedData || typeof loadedData !== 'object' || Object.keys(loadedData).length === 0) {
    try {
      const res = await fetch('https://raw.githubusercontent.com/zafarpazilov3-spec/zaman/main/data/menu.json?t=' + Date.now());
      if (res.ok) {
        loadedData = await res.json();
      }
    } catch (e) {}
  }

  // 4. Apply data if loaded
  if (loadedData && typeof loadedData === 'object' && Object.keys(loadedData).length > 0) {
    ACTIVE_MENU = loadedData;
    const catKeys = Object.keys(loadedData);
    if (!CURRENT_ACTIVE_CATEGORY || !loadedData[CURRENT_ACTIVE_CATEGORY]) {
      CURRENT_ACTIVE_CATEGORY = catKeys[0];
    }
    try { localStorage.setItem('zaman_menu_cache', JSON.stringify(loadedData)); } catch(e) {}
    renderCategoryPills(loadedData);
    renderCatalogDishes(loadedData);
  }
}

function renderCategoryPills(data) {
  const container = document.getElementById('categoryPills');
  if (!container) return;

  container.innerHTML = '';
  const catKeys = Object.keys(data);
  catKeys.forEach((catKey, idx) => {
    const cat = data[catKey];
    if (!cat) return;

    const isActive = (catKey === CURRENT_ACTIVE_CATEGORY) || (!CURRENT_ACTIVE_CATEGORY && idx === 0);
    const a = document.createElement('a');
    a.href = `#sec-${catKey}`;
    a.className = `cat-pill ${isActive ? 'active' : ''}`;
    a.dataset.cat = catKey;
    a.innerHTML = `
      <img src="${cat.thumb || 'images/salads/thumb.jpg'}" alt="${cat.title}"> <span>${cat.title}</span>
    `;
    container.appendChild(a);
  });

  initCategoryPills();
}

function renderCatalogDishes(data) {
  const container = document.getElementById('sheetCatalogList');
  if (!container) return;

  container.innerHTML = '';

  const selectedCat = CURRENT_ACTIVE_CATEGORY || Object.keys(data)[0] || 'combos';

  Object.keys(data).forEach(catKey => {
    const cat = data[catKey];
    if (!cat) return;

    const sec = document.createElement('section');
    sec.className = 'menu-sheet-section';
    sec.id = `sec-${catKey}`;
    sec.style.display = (catKey === selectedCat) ? 'block' : 'none';

    let dishesHtml = '';
    if (cat.dishes && Array.isArray(cat.dishes)) {
      cat.dishes.forEach(dish => {
        const isAvailable = dish.available !== false;
        const hasDualPrice = Boolean(dish.priceSmall && dish.priceBig);

        let priceBadgeHtml = '';
        if (isAvailable) {
          if (hasDualPrice) {
            priceBadgeHtml = `
              <div class="sheet-dish-price sheet-dish-price-dual">
                <span><span class="price-lbl">М:</span> ${dish.priceSmall}</span>
                <span class="price-sep">•</span>
                <span><span class="price-lbl">Б:</span> ${dish.priceBig} с</span>
              </div>
            `;
          } else {
            priceBadgeHtml = `<span class="sheet-dish-price">${dish.price} сом</span>`;
          }
        } else {
          priceBadgeHtml = `<span class="dish-badge-stop">Временно нет</span>`;
        }

        const dualTagsHtml = hasDualPrice ? `
          <div class="dual-price-tags">
            <span class="price-tag-pill">Маленькая: <strong>${dish.priceSmall} сом</strong></span>
            <span class="price-tag-pill">Большая: <strong>${dish.priceBig} сом</strong></span>
          </div>
        ` : '';

        dishesHtml += `
          <article class="sheet-dish-card ${isAvailable ? '' : 'dish-stop-listed'}">
            <div class="sheet-dish-img-box" style="background-image:url('${dish.image || 'images/salads/dish-1.jpg'}')">
              ${priceBadgeHtml}
            </div>
            <div class="sheet-dish-info">
              <h3 class="sheet-dish-title">${dish.name}</h3>
              <p class="sheet-dish-desc">${dish.desc || ''}</p>
              ${dualTagsHtml}
            </div>
          </article>
        `;
      });
    }

    const count = cat.dishes ? cat.dishes.length : 0;
    sec.innerHTML = `
      <div class="sheet-section-header">
        <div class="sheet-section-thumb" style="background-image:url('${cat.thumb || 'images/salads/thumb.jpg'}')"></div>
        <div class="sheet-section-titles">
          <h2 class="sheet-section-name">${cat.title}</h2>
          <span class="sheet-section-sub">${cat.titleEn || ''} &bull; ${count} позиций</span>
        </div>
        <span class="sheet-section-badge">${count} блюд</span>
      </div>
      <div class="sheet-dish-grid">
        ${dishesHtml}
      </div>
    `;

    container.appendChild(sec);
  });
}

/**
 * PWA Service Worker Registration & Mobile Install Prompt
 */
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js?v=17').catch(() => {});
    });
  }

  let deferredPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('btnPwaInstall');
  const closeBtn = document.getElementById('btnPwaClose');

  if (!banner) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isDismissed = localStorage.getItem('zaman_pwa_dismissed');

  if (isStandalone) {
    banner.style.display = 'none';
    return;
  }

  if (isDismissed && (Date.now() - parseInt(isDismissed, 10) < 3 * 24 * 3600 * 1000)) {
    return;
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    banner.style.display = 'block';
  });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isMobile = window.innerWidth <= 768;
  if (isIOS && isMobile && !isStandalone) {
    banner.style.display = 'block';
  }

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          banner.style.display = 'none';
        }
        deferredPrompt = null;
      } else if (isIOS) {
        alert('📲 Чтобы добавить меню ZAMAN на экран телефона:\n\n1. Нажмите кнопку «Поделиться» ⎋ (внизу в Safari)\n2. Прокрутите вниз и выберите «На экран „Домой“» ➕\n3. Нажмите «Добавить» в правом верхнем углу.');
      } else {
        alert('📲 Откройте меню браузера (три точки ⋮) и выберите «Установить приложение» или «Добавить на главный экран».');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.style.display = 'none';
      localStorage.setItem('zaman_pwa_dismissed', Date.now().toString());
    });
  }
}