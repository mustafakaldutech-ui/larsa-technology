import { state, cart, favorites, HEART_ICON, SHARE_ICON } from './state.js';
import { detailSheet, sheetScrim, sheetHandle, sheetContent } from './dom.js';
import { money, unitPriceOf, linkifyText, lockBodyScroll, unlockBodyScroll, escapeHtml, ik } from './utils.js';
import { addToCart, decrementCart, openCartDrawer } from './cart.js';
import { toggleFavorite } from './catalog.js';

const SHEET_PEEK = 0.02; // fraction of sheet height hidden below the fold when "peeked"
let sheetState = 'closed'; // 'closed' | 'peek' | 'full'

function sheetHeight() {
    return detailSheet.getBoundingClientRect().height;
}

function setSheetTransform(px) {
    detailSheet.style.transform = `translateY(${px}px)`;
}

// Builds a plain, bookmarkable/shareable link to this product (?p=<id>)
// that the auto-open logic near the bottom of app.js picks up on load --
// no server route or new page involved, just a query param read by this
// same single-page app.
function buildProductShareUrl(productId) {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('p', productId);
    return url.toString();
}

async function shareProduct(product) {
    const url = buildProductShareUrl(product.id);
    const shareBtn = sheetContent.querySelector('[data-sheet-share]');

    if (navigator.share) {
        try {
            await navigator.share({ title: product.name, text: product.name, url });
        } catch (error) {
            // AbortError just means the user closed the native share sheet
            // without picking anything -- not a real failure.
            if (error.name !== 'AbortError') console.error('Share failed', error);
        }
        return;
    }

    // No native share sheet (most desktop browsers) -- copy the link and
    // give a brief inline confirmation right on the button itself.
    try {
        await navigator.clipboard.writeText(url);
        if (shareBtn) {
            const original = shareBtn.innerHTML;
            shareBtn.innerHTML = '&#10003;';
            shareBtn.classList.add('copied');
            setTimeout(() => {
                shareBtn.innerHTML = original;
                shareBtn.classList.remove('copied');
            }, 1500);
        }
    } catch (error) {
        console.error('Could not copy share link', error);
    }
}

export function openDetailSheet(productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    detailSheet.dataset.productId = productId;

    const hasDiscount = product.discount > 0 && product.discount < product.price;
    const outOfStock = typeof product.stock === 'number' && product.stock <= 0;
    const lowStock = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5;
    const isFav = favorites.has(productId);
    const existing = cart.get(productId);
    const qty = existing ? existing.quantity : 0;

    let stockLabel = '';
    if (outOfStock) stockLabel = '<span class="sheet-stock out">نفدت الكمية</span>';
    else if (lowStock) stockLabel = `<span class="sheet-stock low">تبقّى ${product.stock} فقط</span>`;
    else if (typeof product.stock === 'number') stockLabel = `<span class="sheet-stock">متوفر</span>`;

    // Main image + any extra gallery photos from product_images, in order.
    const gallery = [
        product.image_url,
        ...((product.product_images || [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((g) => g.image_url)),
    ].filter(Boolean);

    const galleryHtml = gallery.length
        ? `<img data-sheet-main-img src="${escapeHtml(ik(gallery[0], 800, 600))}" alt="${escapeHtml(product.name)}">`
        : '<span class="no-image">لا توجد صورة</span>';

    const thumbsHtml = gallery.length > 1
        ? `<div class="sheet-thumbs">
               ${gallery.map((url, i) => `<button type="button" class="sheet-thumb ${i === 0 ? 'active' : ''}" data-sheet-thumb="${escapeHtml(url)}"><img src="${escapeHtml(ik(url, 120, 120))}" alt="" loading="lazy" decoding="async"></button>`).join('')}
           </div>`
        : '';

    sheetContent.innerHTML = `
        <div class="sheet-media">
            ${galleryHtml}
            <button type="button" class="sheet-fav ${isFav ? 'active' : ''}" data-sheet-fav aria-label="المفضلة">${HEART_ICON}</button>
            <button type="button" class="sheet-share" data-sheet-share aria-label="مشاركة">${SHARE_ICON}</button>
        </div>
        ${thumbsHtml}
        <h3 class="sheet-name">${escapeHtml(product.name)}</h3>
        <div class="sheet-price-row">
            <span class="sheet-price">${money(unitPriceOf(product))}</span>
            ${hasDiscount ? `<span class="sheet-price-old">${money(product.price)}</span>` : ''}
        </div>
        ${stockLabel}
        <div class="sheet-actions">
            ${outOfStock
            ? '<button type="button" class="sheet-add-btn" disabled>نفدت الكمية</button>'
            : `<div class="sheet-qty">
                       <button type="button" data-sheet-dec>&minus;</button>
                       <span data-sheet-qty>${qty}</span>
                       <button type="button" data-sheet-inc>+</button>
                   </div>
                   <button type="button" class="sheet-add-btn" data-sheet-add>${qty > 0 ? 'تحديث السلة' : 'أضف إلى السلة'}</button>`
        }
        </div>
        <p class="sheet-desc">${product.description ? linkifyText(product.description) : 'لا يوجد وصف لهذا المنتج بعد.'}</p>`;

    sheetContent.querySelectorAll('[data-sheet-thumb]').forEach((thumb) => {
        thumb.addEventListener('click', () => {
            sheetContent.querySelector('[data-sheet-main-img]').src = ik(thumb.dataset.sheetThumb, 800, 600);
            sheetContent.querySelectorAll('.sheet-thumb').forEach((t) => t.classList.toggle('active', t === thumb));
        });
    });

    sheetContent.querySelector('[data-sheet-fav]')?.addEventListener('click', () => toggleFavorite(productId));
    sheetContent.querySelector('[data-sheet-share]')?.addEventListener('click', () => shareProduct(product));
    sheetContent.querySelector('[data-sheet-inc]')?.addEventListener('click', () => { addToCart(productId); });
    sheetContent.querySelector('[data-sheet-dec]')?.addEventListener('click', () => { decrementCart(productId); });
    sheetContent.querySelector('[data-sheet-add]')?.addEventListener('click', () => {
        if (!cart.has(productId)) addToCart(productId);
        openCartDrawer();
        closeDetailSheet();
    });

    sheetScrim.classList.add('open');
    detailSheet.style.transition = 'none';
    detailSheet.hidden = false;
    detailSheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        detailSheet.style.transition = '';
        snapTo('peek');
    });
    lockBodyScroll();
}

export function syncSheetQty(productId) {
    if (detailSheet.dataset.productId !== productId) return;
    const existing = cart.get(productId);
    const qty = existing ? existing.quantity : 0;
    const qtyEl = sheetContent.querySelector('[data-sheet-qty]');
    if (qtyEl) qtyEl.textContent = qty;
    const addBtn = sheetContent.querySelector('[data-sheet-add]');
    if (addBtn) addBtn.textContent = qty > 0 ? 'تحديث السلة' : 'أضف إلى السلة';
}

export function updateSheetFavIcon(productId) {
    const favBtn = sheetContent.querySelector('[data-sheet-fav]');
    if (favBtn) favBtn.classList.toggle('active', favorites.has(productId));
}

function snapTo(target) {
    sheetState = target;
    const h = sheetHeight();
    if (target === 'closed') {
        setSheetTransform(h);
    } else if (target === 'peek') {
        setSheetTransform(h * SHEET_PEEK);
    } else {
        setSheetTransform(0);
    }
}

export function closeDetailSheet() {
    sheetScrim.classList.remove('open');
    detailSheet.setAttribute('aria-hidden', 'true');
    setSheetTransform(sheetHeight());
    unlockBodyScroll();
    setTimeout(() => {
        if (sheetState === 'closed') {
            detailSheet.hidden = true;
            delete detailSheet.dataset.productId;
        }
    }, 300);
    sheetState = 'closed';
}

sheetScrim.addEventListener('click', closeDetailSheet);

// ── Drag-to-close / drag-to-expand ───────────────────────────

let dragStartY = 0;
let dragStartTranslate = 0;
let dragging = false;

function currentTranslateY() {
    const style = window.getComputedStyle(detailSheet);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return matrix.m42;
}

function onDragStart(clientY) {
    dragging = true;
    dragStartY = clientY;
    dragStartTranslate = currentTranslateY();
    detailSheet.style.transition = 'none';
}

function onDragMove(clientY) {
    if (!dragging) return;
    const delta = clientY - dragStartY;
    const next = Math.max(0, dragStartTranslate + delta);
    setSheetTransform(next);
}

function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    detailSheet.style.transition = '';

    const h = sheetHeight();
    const current = currentTranslateY();

    if (current > h * 0.6) {
        closeDetailSheet();
    } else if (current > h * SHEET_PEEK * 0.5) {
        snapTo('peek');
    } else {
        snapTo('full');
    }
}

sheetHandle.addEventListener('mousedown', (e) => onDragStart(e.clientY));
window.addEventListener('mousemove', (e) => onDragMove(e.clientY));
window.addEventListener('mouseup', onDragEnd);

sheetHandle.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientY), { passive: true });
sheetHandle.addEventListener('touchmove', (e) => onDragMove(e.touches[0].clientY), { passive: true });
sheetHandle.addEventListener('touchend', onDragEnd);
