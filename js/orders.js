import { supabase } from './supabaseCon.js';
import { state } from './state.js';
import { ordersList, navOrderDetailView, orderDetailContent, orderDetailBackBtn } from './dom.js';
import { money, escapeHtml, ik, orderNumber } from './utils.js';
import { showNavView } from './nav.js';

const ORDER_STATUS_LABELS = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغى',
};

function statusLabel(status) {
    return ORDER_STATUS_LABELS[status] || ORDER_STATUS_LABELS.pending;
}

// Only ever emit a known status as a CSS class name.
function statusKey(status) {
    return ORDER_STATUS_LABELS[status] ? status : 'pending';
}

const TRACK_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];

function orderThumbs(order) {
    const items = order.order_items || [];
    const shown = items.slice(0, 3).map((item) => item.image_url
        ? `<img src="${escapeHtml(ik(item.image_url, 96, 96))}" alt="" loading="lazy" decoding="async">`
        : '<span class="order-thumb-empty"></span>').join('');
    const extra = items.length > 3 ? `<span class="order-thumb-more">+${items.length - 3}</span>` : '';
    return shown + extra;
}

function itemsCount(order) {
    return (order.order_items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function trackerHtml(status) {
    if (status === 'cancelled') {
        return '<div class="order-cancelled-banner">تم إلغاء هذا الطلب</div>';
    }
    const current = TRACK_STEPS.indexOf(statusKey(status));
    return `<div class="order-track">${TRACK_STEPS.map((step, i) => `
        <div class="order-track-step ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}">
            <span class="order-track-dot"></span>
            <span class="order-track-label">${ORDER_STATUS_LABELS[step]}</span>
        </div>`).join('')}</div>`;
}

export async function loadOrdersList() {
    ordersList.innerHTML = '<p class="orders-loading">جارٍ التحميل...</p>';
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;

        state.cachedOrders = data;

        if (data.length === 0) {
            ordersList.innerHTML = '<p class="orders-empty">لا توجد طلبات سابقة بعد.</p>';
            return;
        }

        ordersList.innerHTML = data.map((order) => {
            const count = itemsCount(order);
            return `
            <button type="button" class="order-row" data-order="${escapeHtml(order.id)}">
                <div class="order-row-top">
                    <span class="order-row-number" dir="ltr">${orderNumber(order.id)}</span>
                    <span class="order-row-status status-${statusKey(order.status)}">${statusLabel(order.status)}</span>
                </div>
                <div class="order-row-date">${new Date(order.created_at).toLocaleDateString('ar-IQ')}</div>
                <div class="order-row-mid">
                    <div class="order-row-thumbs">${orderThumbs(order)}</div>
                    <span class="order-row-count">${count} ${count === 1 ? 'منتج' : 'منتجات'}</span>
                </div>
                <div class="order-row-bottom">
                    <span class="order-row-total">${money(order.subtotal)}</span>
                    <span class="order-row-chevron" aria-hidden="true">&lsaquo;</span>
                </div>
            </button>`;
        }).join('');

        ordersList.querySelectorAll('[data-order]').forEach((btn) => {
            btn.addEventListener('click', () => openOrderDetail(btn.dataset.order));
        });
    } catch (error) {
        console.error('Could not load orders', error);
        ordersList.innerHTML = '<p class="orders-empty">تعذّر تحميل طلباتك. حاول مرة أخرى.</p>';
    }
}

function openOrderDetail(orderId) {
    const order = state.cachedOrders.find((o) => o.id === orderId);
    if (!order) return;

    const itemsHtml = (order.order_items || []).map((item) => `
        <div class="order-detail-line">
            ${item.image_url ? `<img src="${escapeHtml(ik(item.image_url, 96, 96))}" alt="${escapeHtml(item.product_name)}" loading="lazy" decoding="async">` : '<img alt="">'}
            <div class="order-detail-line-info">
                <div class="order-detail-line-name">${escapeHtml(item.product_name)}</div>
                <div class="order-detail-line-qty">${money(item.unit_price)} &times; ${item.quantity}</div>
            </div>
            <div class="order-detail-line-total">${money(item.unit_price * item.quantity)}</div>
        </div>`).join('');

    orderDetailContent.innerHTML = `
        <div class="order-detail-header">
            <span class="order-detail-id" dir="ltr">رقم الطلب ${orderNumber(order.id)}</span>
            <span class="order-row-status status-${statusKey(order.status)}">${statusLabel(order.status)}</span>
        </div>
        <div class="order-detail-date order-detail-date-line">${new Date(order.created_at).toLocaleString('ar-IQ')}</div>
        ${trackerHtml(order.status)}
        <section class="order-card">
            <h4 class="order-card-title">المنتجات</h4>
            <div class="order-detail-items">${itemsHtml}</div>
            <div class="order-detail-total-row"><span>الإجمالي</span><span>${money(order.subtotal)}</span></div>
        </section>
        <section class="order-card">
            <h4 class="order-card-title">معلومات التوصيل</h4>
            <div class="order-detail-customer">
                <div class="order-detail-field"><span>الاسم</span><span>${escapeHtml(order.customer_name)}</span></div>
                <div class="order-detail-field"><span>الهاتف</span><span dir="ltr">${escapeHtml(order.customer_phone)}</span></div>
                ${order.customer_alt_phone ? `<div class="order-detail-field"><span>هاتف بديل</span><span dir="ltr">${escapeHtml(order.customer_alt_phone)}</span></div>` : ''}
                <div class="order-detail-field"><span>العنوان</span><span>${escapeHtml(order.customer_address)}</span></div>
                ${order.notes ? `<div class="order-detail-field"><span>ملاحظات</span><span>${escapeHtml(order.notes)}</span></div>` : ''}
            </div>
        </section>`;

    showNavView('orderDetail');
}

orderDetailBackBtn.addEventListener('click', () => showNavView('orders'));
