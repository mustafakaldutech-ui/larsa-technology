import { state } from './state.js';
import { supabase } from './supabaseCon.js';
import {
    menuToggle, navScrim, navDrawer, navClose, navUserLine,
    navMainView, navAccountView, navOrdersView, navOrderDetailView, navFavoritesView, navSupportView, navStoreInfoView,
    navLogoutBtn, navLogoutConfirmView, navLogoutConfirmBtn, navLogoutCancelBtn,
} from './dom.js';
import { lockBodyScroll, unlockBodyScroll } from './utils.js';
import { fillAccountForm, showLoginBox, loadUserProfile } from './account.js';
import { loadOrdersList } from './orders.js';
import { renderFavoritesList } from './favorites.js';

const NAV_VIEWS = {
    main: navMainView,
    account: navAccountView,
    orders: navOrdersView,
    orderDetail: navOrderDetailView,
    favorites: navFavoritesView,
    support: navSupportView,
    storeinfo: navStoreInfoView,
    logoutConfirm: navLogoutConfirmView,
};

export function showNavView(name) {
    Object.values(NAV_VIEWS).forEach((view) => { view.hidden = true; });
    NAV_VIEWS[name].hidden = false;
}

export function openNavDrawer() {
    navDrawer.classList.add('open');
    navScrim.classList.add('open');
    navDrawer.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
}

export function closeNavDrawer() {
    navDrawer.classList.remove('open');
    navScrim.classList.remove('open');
    navDrawer.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
}

menuToggle.addEventListener('click', () => {
    showNavView('main');
    openNavDrawer();
});
navClose.addEventListener('click', closeNavDrawer);
navScrim.addEventListener('click', closeNavDrawer);

navDrawer.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => showNavView('main'));
});

export function updateNavUserLine() {
    navUserLine.textContent = state.currentUser?.email
        ? `تم تسجيل الدخول بـ ${state.currentUser.email}`
        : 'لم يتم تسجيل الدخول';
}

// Account and Orders need their own "are you logged in?" branch --
// browsing/cart no longer requires a session, so this drawer can be
// opened while signed out.
export async function openNavSection(name) {
    if (name === 'account') {
        if (state.currentUser) {
            if (!state.currentUserProfile) await loadUserProfile();
            fillAccountForm();
        } else {
            showLoginBox();
        }
        showNavView('account');
    } else if (name === 'orders') {
        if (!state.currentUser) { showNavView('account'); showLoginBox(); return; }
        showNavView('orders');
        loadOrdersList();
    }
}

navDrawer.querySelectorAll('.nav-item[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'account' || target === 'orders') {
            openNavSection(target);
        } else if (target === 'favorites') {
            renderFavoritesList();
            showNavView('favorites');
        } else {
            showNavView(target);
        }
    });
});

navLogoutBtn.addEventListener('click', () => {
    if (!state.currentUser) return;
    showNavView('logoutConfirm');
});

navLogoutCancelBtn.addEventListener('click', () => showNavView('main'));

navLogoutConfirmBtn.addEventListener('click', async () => {
    if (!state.currentUser) { showNavView('main'); return; }
    navLogoutConfirmBtn.disabled = true;
    navLogoutConfirmBtn.textContent = 'جارٍ تسجيل الخروج...';
    try {
        await supabase.auth.signOut();
        state.currentUserProfile = null;
        closeNavDrawer();
        showNavView('main');
        // onAuthStateChange (in auth.js) clears cart state etc.
    } catch (error) {
        console.error('Sign out failed', error);
    } finally {
        navLogoutConfirmBtn.disabled = false;
        navLogoutConfirmBtn.textContent = 'نعم، تسجيل الخروج';
    }
});
