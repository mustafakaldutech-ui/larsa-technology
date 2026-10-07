import { supabase } from './supabaseCon.js';
import { state, cart, DEFAULT_NAME } from './state.js';
import {
    checkoutView, checkoutSummary, checkoutError, placeOrderBtn,
    checkoutPhoneDisplay, checkoutPhoneRow, custPhone, firstOrderNotice,
    orderSuccess, orderSuccessNumber, successClose, verificationPending, verifyOrderNumber, verifyCode,
    verifyWhatsappBtn, verifySmsBtn, verificationCloseBtn,
    cartView, goToCheckout, checkoutBack, custGovernorate,
} from './dom.js';
import { money, unitPriceOf, escapeHtml, orderNumber, isValidIraqPhone, toLocalPhone, LOCK_ICON } from './utils.js';
import { buildAddress, splitAddress } from './address.js';
import { syncCartUI, closeCartDrawer } from './cart.js';
import { openNavDrawer, showNavView } from './nav.js';
import { loadUserProfile } from './account.js';

export function showCartView() {
    cartView.hidden = false;
    checkoutView.hidden = true;
    orderSuccess.hidden = true;
    verificationPending.hidden = true;
}

export async function showCheckoutView() {
    if (cart.size === 0) return;
    if (!state.currentUser) {
        openNavDrawer();
        showNavView('account');
        return;
    }
    cartView.hidden = true;
    checkoutView.hidden = false;
    orderSuccess.hidden = true;
    verificationPending.hidden = true;
    checkoutError.hidden = true;

    checkoutSummary.innerHTML = [...cart.values()].map(({ product, quantity }) =>
        `<div><span>${escapeHtml(product.name)} &times; ${quantity}</span><span>${money(unitPriceOf(product) * quantity)}</span></div>`
    ).join('');

    if (!state.currentUserProfile) await loadUserProfile();
    document.getElementById('custName').value = state.currentUserProfile?.name || '';
    document.getElementById('custAltPhone').value = toLocalPhone(state.currentUserProfile?.alternate_phone);
    const savedAddress = splitAddress(state.currentUserProfile?.address);
    custGovernorate.value = savedAddress.governorate;
    document.getElementById('custAddress').value = savedAddress.details;
    document.getElementById('custNotes').value = state.currentUserProfile?.note || '';

    // Verified accounts: phone is fixed, read straight from the profile,
    // never an editable field here. Unverified accounts: this order IS
    // the phone verification attempt, so it has to be typed in.
    if (state.currentUserProfile?.verified) {
        firstOrderNotice.hidden = true;
        checkoutPhoneDisplay.hidden = false;
        checkoutPhoneRow.hidden = true;
        custPhone.required = false;
        checkoutPhoneDisplay.innerHTML = `<span dir="ltr">${escapeHtml(toLocalPhone(state.currentUserProfile?.primary_phone) || '—')}</span>${LOCK_ICON}`;
    } else {
        firstOrderNotice.className = 'field-note field-note-warn';
        firstOrderNotice.textContent = '⚠️ انتبه: هذه أول عملية شراء لك، وبعدها لن تتمكن من تغيير رقم هاتفك الأساسي، فتأكد من صحته. سنطلب تأكيده مرة واحدة فقط عبر واتساب أو SMS.';
        firstOrderNotice.hidden = false;
        checkoutPhoneDisplay.hidden = true;
        checkoutPhoneRow.hidden = false;
        custPhone.required = true;
        custPhone.value = toLocalPhone(state.currentUserProfile?.primary_phone);
    }
}

goToCheckout.addEventListener('click', showCheckoutView);
checkoutBack.addEventListener('click', showCartView);

class OutOfStockError extends Error {
    constructor(productName) {
        super(`Out of stock: ${productName}`);
        this.name = 'OutOfStockError';
        this.productName = productName;
    }
}

// Postgres error messages raised by create_order() (see 01_schema.sql)
// come through as a plain string on error.message -- this pulls out the
// two cases that deserve their own customer-facing wording (insufficient
// stock for a named product, or a product that no longer exists at all)
// into the dedicated error class above. Anything else falls through to
// the generic error path in the submit handler below.
function parseOrderError(message) {
    const stockMatch = /insufficient stock for (.+)$/i.exec(message || '');
    if (stockMatch) return new OutOfStockError(stockMatch[1]);
    if (/no longer exists/i.test(message || '')) return new OutOfStockError('أحد المنتجات');
    return null;
}

async function placeOrder({ customerName, customerPhone, customerAltPhone, customerAddress, notes }) {
    const items = [...cart.values()].map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
    }));

    // create_order() now returns jsonb: { order_id, needs_verification,
    // verification_code? } -- it branches server-side on whether this
    // account is verified yet. Never send today's cached profile phone
    // for a verified account; the function ignores it anyway and always
    // uses the account's own locked-in primary_phone.
    const { data, error } = await supabase.rpc('create_order', {
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_customer_alt_phone: customerAltPhone || null,
        p_customer_address: customerAddress,
        p_notes: notes,
        p_items: items,
    });

    if (error) {
        const parsed = parseOrderError(error.message);
        throw parsed || error;
    }
    return data;
}

checkoutView.addEventListener('submit', async (e) => {
    e.preventDefault();
    checkoutError.hidden = true;

    const customerName = document.getElementById('custName').value.trim();
    const governorate = custGovernorate.value;
    const addressDetails = document.getElementById('custAddress').value.trim();
    const customerAltPhone = document.getElementById('custAltPhone').value.trim();
    const notes = document.getElementById('custNotes').value.trim();
    const customerPhone = state.currentUserProfile?.verified
        ? state.currentUserProfile.primary_phone
        : custPhone.value.trim();

    if (customerName.length < 2) return showCheckoutError('الرجاء إدخال اسمك الكامل.');
    // A verified account's phone is fixed server-side, so only a typed one is checked.
    if (!state.currentUserProfile?.verified && !isValidIraqPhone(customerPhone)) {
        return showCheckoutError('رقم الهاتف يجب أن يتكوّن من 11 رقمًا ويبدأ بالصفر، مثال: 07701234567');
    }
    if (customerAltPhone && !isValidIraqPhone(customerAltPhone)) {
        return showCheckoutError('رقم الهاتف البديل يجب أن يتكوّن من 11 رقمًا ويبدأ بالصفر، أو اتركه فارغًا.');
    }
    if (!governorate) return showCheckoutError('الرجاء اختيار المحافظة.');
    if (!addressDetails) return showCheckoutError('الرجاء كتابة تكملة العنوان (المنطقة، الشارع، أقرب نقطة دالة).');
    const customerAddress = buildAddress(governorate, addressDetails);
    if (cart.size === 0) return showCheckoutError('سلتك فارغة.');

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'جارٍ إتمام الطلب...';

    try {
        const result = await placeOrder({
            customerName,
            customerPhone,
            customerAltPhone,
            customerAddress,
            notes,
        });

        // Keep the account profile in sync with whatever they just used to
        // check out -- name/address/note/alt phone only. primary_phone is
        // NEVER written from here: create_order() already handled it
        // server-side for an unverified account's first attempt, and for
        // a verified account it must never change from checkout at all
        // (the database enforces this too, but this code doesn't even try).
        try {
            await supabase.from('profiles').update({
                name: state.currentUserProfile?.name || customerName || DEFAULT_NAME,
                alternate_phone: customerAltPhone,
                address: customerAddress,
                note: notes,
                updated_at: new Date().toISOString(),
            }).eq('id', state.currentUser.id);
            await loadUserProfile();
        } catch (error) {
            console.error('Could not update account profile after order', error);
        }

        cart.clear();
        syncCartUI();
        checkoutView.reset();
        checkoutView.hidden = true;

        if (result.needs_verification) {
            await showVerificationPending(result.order_id, result.verification_code, customerPhone);
        } else {
            orderSuccessNumber.textContent = orderNumber(result.order_id);
            orderSuccess.hidden = false;
        }
    } catch (error) {
        console.error(error);
        if (error.name === 'OutOfStockError') {
            showCheckoutError(`"${error.productName}" لم يعد متوفرًا بالكمية المطلوبة. الرجاء تعديل سلتك.`);
        } else if (error.message?.includes('already have an order awaiting verification')) {
            showCheckoutError('لديك طلب سابق بانتظار التوثيق بالفعل — راجع "طلباتي" لإتمام تلك الخطوة أولاً.');
        } else if (error.message?.includes('already registered to a different account')) {
            showCheckoutError('رقم الهاتف هذا مسجّل بالفعل لحساب آخر. تأكد من الرقم أو تواصل معنا إذا كنت تعتقد أن هذا خطأ.');
        } else {
            showCheckoutError('حدث خطأ ما أثناء إتمام طلبك. الرجاء المحاولة مرة أخرى.');
        }
    } finally {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'تأكيد الطلب';
    }
});

// Builds the ready-made WhatsApp/SMS message and shows the "confirm your
// phone" screen instead of the plain order-success one.
async function showVerificationPending(orderId, code, phone) {
    const shortId = orderNumber(orderId);
    verifyOrderNumber.textContent = shortId;
    verifyCode.textContent = code;

    const { data: settings } = await supabase.from('site_settings').select('whatsapp_number').eq('id', 1).maybeSingle();
    const storeNumber = (settings?.whatsapp_number || '').replace(/[^\d]/g, '');

    const message = `مرحباً،\n\nأرغب في توثيق حسابي.\n\nرقم الطلب: ${shortId}\nرمز التحقق: ${code}\nرقم الهاتف المسجل في المتجر: ${phone}\n\nشكراً.`;
    const encoded = encodeURIComponent(message);

    if (storeNumber) {
        verifyWhatsappBtn.href = `https://wa.me/${storeNumber}?text=${encoded}`;
        verifyWhatsappBtn.hidden = false;
        verifySmsBtn.href = `sms:${storeNumber}?body=${encoded}`;
        verifySmsBtn.hidden = false;
    } else {
        verifyWhatsappBtn.hidden = true;
        verifySmsBtn.hidden = true;
    }

    verificationPending.hidden = false;
}

verificationCloseBtn.addEventListener('click', () => {
    showCartView();
    closeCartDrawer();
});

function showCheckoutError(message) {
    checkoutError.textContent = message;
    checkoutError.hidden = false;
}

successClose.addEventListener('click', () => {
    showCartView();
    closeCartDrawer();
});
