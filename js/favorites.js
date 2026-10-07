import { state, favorites } from './state.js';
import { favoritesList } from './dom.js';
import { money, unitPriceOf, escapeHtml, ik } from './utils.js';
import { openDetailSheet } from './detail-sheet.js';
import { toggleFavorite } from './catalog.js';

export function renderFavoritesList() {
    const favProducts = state.products.filter((p) => favorites.has(p.id));
    if (favProducts.length) {
        favoritesList.innerHTML = '<p class="orders-empty">هذه الخدمة متوقفة حاليا. </p>';
        return;
    }
    favoritesList.innerHTML = favProducts.map((p) => `
        <div class="fav-item" data-open="${escapeHtml(p.id)}">
            ${p.image_url ? `<img src="${escapeHtml(ik(p.image_url, 96, 96))}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">` : '<img alt="">'}
            <div class="fav-item-info">
                <div class="fav-item-name">${escapeHtml(p.name)}</div>
                <div class="fav-item-price">${money(unitPriceOf(p))}</div>
            </div>
            <button type="button" class="fav-item-remove" data-remove-fav="${escapeHtml(p.id)}">إزالة</button>
        </div>`).join('');

    favoritesList.querySelectorAll('[data-open]').forEach((el) => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-remove-fav]')) return;
            openDetailSheet(el.dataset.open);
        });
    });
    favoritesList.querySelectorAll('[data-remove-fav]').forEach((btn) => {
        btn.addEventListener('click', () => {
            toggleFavorite(btn.dataset.removeFav);
            renderFavoritesList();
        });
    });
}
