import { supabase } from './supabaseCon.js';
import { state, cart, PRODUCT_COLUMNS } from './state.js';
import { authLoginForm, authEmailInput, authPasswordInput, authError, authSubmitBtn, authForgotBtn, navAccountView, shopEmpty } from './dom.js';
import { loadData } from './catalog.js';
import { loadUserProfile, fillAccountForm } from './account.js';
import { syncCartUI, closeCartDrawer } from './cart.js';
import { updateNavUserLine, closeNavDrawer } from './nav.js';
import { openDetailSheet } from './detail-sheet.js';
import { loginCaptcha } from './turnstile.js';

const CAPTCHA_MSG = 'أكمل التحقق الأمني أولًا ثم حاول مرة أخرى.';

// ── Auth: login (inside the account nav view) ───────────────────
//
// Browsing, search, and the cart never require a session -- only
// checkout and viewing "My Orders" do. The product catalog loads
// unconditionally, once, on script start (below).

authLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.hidden = true;

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) return;

    const captchaToken = loginCaptcha.getToken();
    if (!captchaToken) {
        authError.textContent = CAPTCHA_MSG;
        authError.hidden = false;
        loginCaptcha.mount();
        return;
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'جارٍ تسجيل الدخول...';

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
        if (error) throw error;
        // onAuthStateChange below takes it from here.
    } catch (error) {
        console.error(error);
        authError.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        authError.hidden = false;
    } finally {
        loginCaptcha.reset();
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = 'تسجيل الدخول';
    }
});

authForgotBtn.addEventListener('click', async () => {
    authError.hidden = true;
    const email = authEmailInput.value.trim();
    if (!email) {
        authError.textContent = 'اكتب بريدك الإلكتروني أولًا، ثم اضغط "نسيت كلمة المرور؟".';
        authError.hidden = false;
        return;
    }
    const captchaToken = loginCaptcha.getToken();
    if (!captchaToken) {
        authError.textContent = CAPTCHA_MSG;
        authError.hidden = false;
        loginCaptcha.mount();
        return;
    }
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken });
        if (error) throw error;
        authError.textContent = 'أُرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.';
        authError.hidden = false;
    } catch (error) {
        console.error(error);
        authError.textContent = 'تعذّر إرسال رابط إعادة التعيين. تحقق من البريد الإلكتروني وحاول مرة أخرى.';
        authError.hidden = false;
    } finally {
        loginCaptcha.reset();
    }
});

supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user ?? null;
    state.currentUser = user;
    updateNavUserLine();

    if (user) {
        authLoginForm.reset();
        await loadUserProfile();
        // If the account nav view happens to be open mid-login (e.g. just
        // signed up), flip it over to the profile form immediately.
        if (!navAccountView.hidden) fillAccountForm();
    } else {
        state.currentUserProfile = null;
        cart.clear();
        syncCartUI();
        if (event === 'SIGNED_OUT') {
            closeCartDrawer();
            closeNavDrawer();
        }
    }
});

// Load the catalog once, immediately, regardless of login state.
const initialLoadPromise = loadData().catch((error) => {
    console.error(error);
    shopEmpty.hidden = false;
    shopEmpty.textContent = 'تعذّر تحميل المنتجات حاليًا. الرجاء تحديث الصفحة.';
});

// Shared product links (?p=<productId>, see shareProduct() in
// detail-sheet.js) auto-open that product's detail sheet once the first
// page of the catalog is ready -- this is still the same single page
// load, no server route, no navigation, and the person keeps browsing
// normally underneath once they close the sheet. If the shared product
// isn't among whatever page/filter happened to load first, it's fetched
// directly by id instead.
(async () => {
    const sharedProductId = new URLSearchParams(location.search).get('p');
    if (!sharedProductId) return;

    await initialLoadPromise;

    let product = state.products.find((p) => p.id === sharedProductId);
    if (!product) {
        const { data } = await supabase.from('products').select(PRODUCT_COLUMNS).eq('id', sharedProductId).maybeSingle();
        if (data) {
            product = data;
            state.products.unshift(product);
        }
    }
    if (product) openDetailSheet(product.id);
})();
