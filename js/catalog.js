import { supabase } from './supabaseCon.js';
import { state, cart, favorites, PRODUCTS_PAGE_SIZE, PRODUCT_COLUMNS, POPULAR_CATEGORY, CATEGORY_ICON, HEART_ICON } from './state.js';
import { productGrid, shopEmpty, loadMoreBtn, categoryNav, productsHeading, searchInput, clearSearch, detailSheet } from './dom.js';
import { money, unitPriceOf, escapeHtml, ik } from './utils.js';
import { openDetailSheet, updateSheetFavIcon } from './detail-sheet.js';
import { addToCart, decrementCart } from './cart.js';

// ── Load data ────────────────────────────────────────────────

export async function loadData() {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) { console.error('Could not load categories', error); state.categories = []; }
    else state.categories = data;

    renderCategoryNav();
    await loadProductsPage({ reset: true, force: true });
}

// ── Product pagination ("Load more") ─────────────────────────
//
// Products load a page at a time (PRODUCTS_PAGE_SIZE), newest first, via
// Supabase's .range() (offset-based LIMIT/OFFSET pagination -- simple and
// well-supported; fine at this catalog size). Switching categories
// re-queries with that category's own filter from offset 0, rather than
// filtering an already-loaded batch client-side, so a category always
// shows genuinely-complete pages of itself.

// ── In-memory cache ──────────────────────────────────────────
//
// Each category/search view remembers the products already fetched for it
// (including any "Load more" pages). Going Mobiles -> Chargers -> Mobiles
// re-shows the saved list instantly with zero network requests. An entry
// is reused for CACHE_TTL_MS, then refetched so price/stock changes still
// show up. Checkout always re-validates stock on the server regardless.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 20;
const productCache = new Map(); // key -> { products, offset, hasMore, time }
let requestSeq = 0;             // lets a newer request supersede an older one

function cacheKey() {
    return `${state.activeCategory}|${state.searchTerm || ''}`;
}

function saveToCache() {
    const key = cacheKey();
    productCache.delete(key); // re-insert so the Map stays oldest-first
    productCache.set(key, {
        products: state.products,
        offset: state.productsOffset,
        hasMore: state.hasMoreProducts,
        time: Date.now(),
    });
    while (productCache.size > CACHE_MAX_ENTRIES) {
        productCache.delete(productCache.keys().next().value);
    }
}

// Fetches one page of products for the current category + search filter
// (server-side, via .eq('category_id', ...) / .ilike('name', ...) /
// .range()) and either replaces or appends to the loaded list. A reset
// is served from the cache when a fresh entry exists.
export async function loadProductsPage({ reset = false, force = false } = {}) {
    if (!reset && (state.loadingProducts || !state.hasMoreProducts)) return;

    const seq = ++requestSeq;

    if (reset) {
        const cached = !force && productCache.get(cacheKey());
        if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
            state.products = cached.products;
            state.productsOffset = cached.offset;
            state.hasMoreProducts = cached.hasMore;
            state.loadingProducts = false;
            renderProducts();
            updateLoadMoreButton();
            return;
        }
        state.products = [];
        state.productsOffset = 0;
        state.hasMoreProducts = true;
        renderProducts(); // clear the grid immediately so switching categories/search doesn't show stale items
    }

    state.loadingProducts = true;
    updateLoadMoreButton();

    try {
        let q = supabase.from('products').select(PRODUCT_COLUMNS)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(state.productsOffset, state.productsOffset + PRODUCTS_PAGE_SIZE - 1);

        if (state.activeCategory === POPULAR_CATEGORY) q = q.eq('is_popular', true);
        else if (state.activeCategory !== 'all') q = q.eq('category_id', state.activeCategory);
        if (state.searchTerm) q = q.ilike('name', `%${state.searchTerm}%`);

        const { data, error } = await q;
        if (error) throw error;
        if (seq !== requestSeq) return; // user already moved to another category/search

        state.products = reset ? data : [...state.products, ...data];
        state.productsOffset += data.length;
        state.hasMoreProducts = data.length === PRODUCTS_PAGE_SIZE;
        saveToCache();
    } catch (error) {
        if (seq !== requestSeq) return;
        console.error('Could not load products', error);
        if (reset) {
            shopEmpty.hidden = false;
            shopEmpty.textContent = 'تعذّر تحميل المنتجات حاليًا. الرجاء تحديث الصفحة.';
        }
        state.hasMoreProducts = false;
    } finally {
        if (seq === requestSeq) {
            state.loadingProducts = false;
            renderProducts();
            updateLoadMoreButton();
        }
    }
}

function updateLoadMoreButton() {
    if (state.loadingProducts) {
        loadMoreBtn.hidden = false;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'جارٍ التحميل...';
        return;
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'عرض المزيد';
    loadMoreBtn.hidden = !state.hasMoreProducts;
}

loadMoreBtn.addEventListener('click', () => loadProductsPage());

function renderCategoryNav() {
    // 'all' and 'popular' are fixed sections that always sit before the real categories.
    const pills = [{ id: 'all', name: 'الكل', icon: null }, { id: POPULAR_CATEGORY, name: 'الأكثر رواجًا', icon: '🔥' }, ...state.categories];
    categoryNav.innerHTML = pills.map((c) => `
        <button type="button" class="category-pill ${c.id === state.activeCategory ? 'active' : ''}" data-cat="${escapeHtml(c.id)}">
            ${c.icon ? `<span class="cat-icon-emoji">${escapeHtml(c.icon)}</span>` : CATEGORY_ICON}
            <span class="cat-label">${escapeHtml(c.name)}</span>
        </button>`).join('');

    categoryNav.querySelectorAll('[data-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.cat === state.activeCategory) return;
            state.activeCategory = btn.dataset.cat;
            renderCategoryNav();
            loadProductsPage({ reset: true });
        });
    });
}

// The server-side query (category + .ilike search) already returns exactly
// what should be on screen, so no client-side filtering is needed here
// anymore -- kept as a named function for readability at the call sites.
function visibleProducts() {
    return state.products;
}

export function renderProducts() {
    const visible = visibleProducts();

    productsHeading.textContent = state.searchTerm
        ? `نتائج "${searchInput.value.trim()}"`
        : (state.activeCategory === 'all' ? 'أحدث المنتجات' : state.activeCategory === POPULAR_CATEGORY ? 'المنتجات الأكثر رواجًا' : (state.categories.find((c) => c.id === state.activeCategory)?.name || 'المنتجات'));

    shopEmpty.hidden = visible.length > 0;
    shopEmpty.textContent = state.searchTerm ? 'لا توجد منتجات مطابقة لبحثك.' : 'لا توجد منتجات متاحة حاليًا.';
    productGrid.hidden = visible.length === 0;

    productGrid.innerHTML = visible.map((p) => {
        const inCart = cart.get(p.id);
        const hasDiscount = p.discount > 0 && p.discount < p.price;
        const outOfStock = typeof p.stock === 'number' && p.stock <= 0;
        const lowStock = typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5;
        const isFav = favorites.has(p.id);

        return `
        <div class="product-card">
            <button type="button" class="product-media" data-open="${escapeHtml(p.id)}" aria-label="عرض ${escapeHtml(p.name)}">
                ${hasDiscount ? `<span class="discount-badge">-${Math.round((1 - p.discount / p.price) * 100)}%</span>` : ''}
                ${outOfStock ? '<span class="stock-badge">نفدت الكمية</span>' : lowStock ? `<span class="stock-badge">تبقّى ${p.stock}</span>` : ''}
                ${p.image_url ? `<img src="${escapeHtml(ik(p.image_url, 400, 400))}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">` : '<span class="no-image">لا توجد صورة</span>'}
            </button>
            <button type="button" class="fav-btn ${isFav ? 'active' : ''}" data-fav="${escapeHtml(p.id)}" aria-label="المفضلة">${HEART_ICON}</button>
            <div class="product-body">
                <div class="product-name">${escapeHtml(p.name)}</div>
                <div class="product-price-group">
                    <span class="product-price">${money(unitPriceOf(p))}</span>
                    ${hasDiscount ? `<span class="product-price-old">${money(p.price)}</span>` : ''}
                </div>
                ${outOfStock
                    ? '<button type="button" class="btn-add-full" disabled>نفدت الكمية</button>'
                    : inCart
                        ? `<div class="qty-inline qty-inline-full">
                               <button type="button" data-dec="${escapeHtml(p.id)}">&minus;</button>
                               <span>${inCart.quantity}</span>
                               <button type="button" data-inc="${escapeHtml(p.id)}">+</button>
                           </div>`
                        : `<button type="button" class="btn-add-full" data-add="${escapeHtml(p.id)}">أضف إلى السلة</button>`
                }
            </div>
        </div>`;
    }).join('');

    productGrid.querySelectorAll('[data-open]').forEach((btn) => {
        btn.addEventListener('click', () => openDetailSheet(btn.dataset.open));
    });
    productGrid.querySelectorAll('[data-fav]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.fav);
        });
    });
    productGrid.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => addToCart(btn.dataset.add));
    });
    productGrid.querySelectorAll('[data-inc]').forEach((btn) => {
        btn.addEventListener('click', () => addToCart(btn.dataset.inc));
    });
    productGrid.querySelectorAll('[data-dec]').forEach((btn) => {
        btn.addEventListener('click', () => decrementCart(btn.dataset.dec));
    });
}

export function toggleFavorite(productId) {
    if (favorites.has(productId)) favorites.delete(productId);
    else favorites.add(productId);
    renderProducts();
    if (detailSheet.dataset.productId === productId) updateSheetFavIcon(productId);
}

// ── Search ───────────────────────────────────────────────────
//
// Debounced (300ms) so rapid typing doesn't fire a query per keystroke;
// each search re-queries Postgres directly (.ilike()) rather than
// filtering anything client-side.

searchInput.addEventListener('input', () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
        loadProductsPage({ reset: true });
    }, 300);
});

clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.searchTerm = '';
    searchInput.focus();
    clearTimeout(state.searchDebounceTimer);
    loadProductsPage({ reset: true });
});
