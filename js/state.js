// Central shared state. Plain `let` exports can't be reassigned from a
// different module (only read) -- ES modules only allow the declaring
// module to rebind its own bindings. Wrapping everything that gets
// reassigned (not just mutated) in one object sidesteps that entirely:
// every file below imports the SAME `state` object and just does
// `state.products = ...`, which is a normal property write, not a
// module-binding reassignment.
export const state = {
    products: [],
    categories: [],
    activeCategory: 'all',
    searchTerm: '',
    productsOffset: 0,
    hasMoreProducts: true,
    loadingProducts: false,
    searchDebounceTimer: null,
    currentUser: null,        // Supabase auth user object, kept in sync via onAuthStateChange
    currentUserProfile: null, // cached profiles row, refreshed on auth change / save
    cachedOrders: [],         // orders/{id} docs from the last loadOrdersList(), reused to open a detail view without refetching
};

// Map/Set are never reassigned as a whole (only .set()/.get()/.add()/
// .delete()/.clear()), so these are safe as plain exports -- every module
// that imports `cart` or `favorites` holds a reference to the exact same
// Map/Set instance.
export const cart = new Map();      // productId -> { product, quantity }
export const favorites = new Set(); // productId, local-only (no backend table for this yet)

// ── Pure constants (never reassigned anywhere) ──────────────────────

// Products load a page at a time via Supabase's .range() (offset-based
// LIMIT/OFFSET pagination -- simple and well-supported; fine at this
// catalog size).
export const PRODUCTS_PAGE_SIZE = 20;

// Fixed catalog section (next to "all") showing products where
// products.is_popular = true.
export const POPULAR_CATEGORY = 'popular';

// Only the columns the storefront actually displays. Asking for these
// (instead of '*') keeps every response smaller and means no other column
// in the products table is ever sent to a customer's browser. If you add a
// new field to the product cards, add its column name here too.
export const PRODUCT_COLUMNS = 'id, name, price, discount, stock, image_url, description, category_id, product_images(image_url, sort_order)';

export const DEFAULT_NAME = 'زبون';

// Flat delivery fee (IQD), all governorates -- display only. It's added to
// the cart/checkout "total with delivery" line purely so the customer sees
// what they'll actually pay, but it is NEVER sent to the database, never
// part of orders.subtotal, and never passed to the create_order() RPC --
// editing this constant (or the DOM) only changes what the customer sees,
// not what gets written. The store owner is responsible for accounting
// for delivery fees themselves, manually or in the admin panel.
export const DELIVERY_FEE_IQD = 5000;

// Generic chip icon reused for every category (per-category custom icons
// aren't part of the product/category data model, so one consistent mark
// is used instead of guessing icons per category name).
export const CATEGORY_ICON = `
    <svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <rect x="10" y="10" width="4" height="4" rx="0.5" />
        <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" stroke-linecap="round" />
    </svg>`;

export const HEART_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2.3 4.5 5.6 4c2-.3 3.9.6 5 2.3.9-1.6 2.9-2.6 5-2.3 3.3.5 5.2 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3Z"
              fill="currentColor" fill-opacity="0" stroke-linejoin="round" />
    </svg>`;

// The universal "share" glyph (box with an arrow pointing up out of it) --
// recognizable across iOS/Android/desktop conventions.
export const SHARE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
    </svg>`;
