import { state, cart, DELIVERY_FEE_IQD } from './state.js';
import {
    detailSheet, cartCount, cartTotal, checkoutTotal, cartDeliveryFee, checkoutDeliveryFee,
    cartGrandTotal, checkoutGrandTotal, cartFooter, cartEmpty, cartLines,
    cartToggle, cartClose, cartScrim, cartDrawer } from './dom.js';
import { money, unitPriceOf, lockBodyScroll, unlockBodyScroll, escapeHtml, ik } from './utils.js';
import { renderProducts } from './catalog.js';
import { syncSheetQty } from './detail-sheet.js';

export function addToCart(productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    const existing = cart.get(productId);
    const currentQty = existing ? existing.quantity : 0;

    if (typeof product.stock === 'number' && currentQty + 1 > product.stock) return;

    cart.set(productId, { product, quantity: currentQty + 1 });
    syncCartUI();
}

export function decrementCart(productId) {
    const existing = cart.get(productId);
    if (!existing) return;

    if (existing.quantity <= 1) cart.delete(productId);
    else existing.quantity -= 1;
    syncCartUI();
}

export function removeFromCart(productId) {
    cart.delete(productId);
    syncCartUI();
}

export function cartTotalValue() {
    let total = 0;
    for (const { product, quantity } of cart.values()) total += unitPriceOf(product) * quantity;
    return total;
}

export function syncCartUI() {
    renderProducts();
    renderCartLines();
    if (!detailSheet.hidden && detailSheet.dataset.productId) syncSheetQty(detailSheet.dataset.productId);

    const count = [...cart.values()].reduce((sum, l) => sum + l.quantity, 0);
    cartCount.hidden = count === 0;
    cartCount.textContent = count;

    const total = cartTotalValue();
    cartTotal.textContent = money(total);
    checkoutTotal.textContent = money(total);
    cartDeliveryFee.textContent = money(DELIVERY_FEE_IQD);
    checkoutDeliveryFee.textContent = money(DELIVERY_FEE_IQD);
    cartGrandTotal.textContent = money(total + DELIVERY_FEE_IQD);
    checkoutGrandTotal.textContent = money(total + DELIVERY_FEE_IQD);
    cartFooter.hidden = cart.size === 0;
    cartEmpty.hidden = cart.size > 0;
}

function renderCartLines() {
    cartLines.innerHTML = [...cart.entries()].map(([id, { product, quantity }]) => {
        const atLimit = typeof product.stock === 'number' && quantity >= product.stock;
        return `
        <div class="cart-line">
            ${product.image_url ? `<img src="${escapeHtml(ik(product.image_url, 112, 112))}" alt="" loading="lazy" decoding="async">` : '<img alt="">'}
            <div class="cart-line-info">
                <div class="cart-line-name">${escapeHtml(product.name)}</div>
                <div class="cart-line-bottom">
                    <div class="cart-line-stepper">
                        <button type="button" data-dec="${escapeHtml(id)}" aria-label="إنقاص الكمية">&minus;</button>
                        <span>${quantity}</span>
                        <button type="button" data-inc="${escapeHtml(id)}" aria-label="زيادة الكمية" ${atLimit ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="cart-line-total">${money(unitPriceOf(product) * quantity)}</div>
                </div>
            </div>
            <button type="button" class="cart-line-remove" data-remove="${escapeHtml(id)}" aria-label="إزالة من السلة">&times;</button>
        </div>`;
    }).join('');

    cartLines.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
    });
    cartLines.querySelectorAll('[data-inc]').forEach((btn) => {
        btn.addEventListener('click', () => addToCart(btn.dataset.inc));
    });
    cartLines.querySelectorAll('[data-dec]').forEach((btn) => {
        btn.addEventListener('click', () => decrementCart(btn.dataset.dec));
    });
}

export function openCartDrawer() {
    cartDrawer.classList.add('open');
    cartScrim.classList.add('open');
    lockBodyScroll();
}

export function closeCartDrawer() {
    cartDrawer.classList.remove('open');
    cartScrim.classList.remove('open');
    unlockBodyScroll();
}

cartToggle.addEventListener('click', openCartDrawer);
cartClose.addEventListener('click', closeCartDrawer);
cartScrim.addEventListener('click', closeCartDrawer);
