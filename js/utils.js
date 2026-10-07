// Iraqi Dinar formatting: "د.ع." suffix (after the number, matching how
// Arabic currency abbreviations normally read) instead of "$", ٫ as a
// thousands separator every 3 digits, no decimal point (IQD prices are
// always whole numbers here), and the digits themselves stay plain English
// 0-9 (not Arabic-Indic numerals) regardless of the page's language.
export const money = (n) => {
    const whole = Math.round(Number(n) || 0);
    const withSeparators = Math.abs(whole).toLocaleString('en-US').replace(/,/g, '٫');
    return `${whole < 0 ? '-' : ''}${withSeparators} د.ع.`;
};

export const unitPriceOf = (p) => (p.discount > 0 && p.discount < p.price ? p.discount : p.price);

// Product descriptions are free text an admin typed in -- rendered as
// plain interpolated text before, so a pasted link just sat there as
// inert text, not a clickable one. escapeHtml() neutralizes any stray
// HTML in the text first (defense in depth, since this project doesn't
// control what the separate admin panel might one day let someone type),
// then linkifyText() turns bare URLs in that already-escaped text into
// real, tappable <a> links.

// ── ImageKit resizing ────────────────────────────────────────
//
// Every image slot on the page is small (a 48px cart thumbnail, a ~200px
// grid card...), but the originals uploaded to ImageKit are usually
// thousands of pixels wide. ik() asks ImageKit to deliver a version sized
// for the slot instead (about 2x the CSS size, so it stays sharp on
// high-density phone screens). Less data per image = faster pages and a
// smaller ImageKit bandwidth bill.
//
// If you serve ImageKit through your own domain, add it to
// IMAGEKIT_HOSTS below. URLs that aren't ImageKit's, or that already carry
// their own ?tr= / /tr: transformation, are returned untouched.
const IMAGEKIT_HOSTS = ['ik.imagekit.io'];

export function ik(url, width, height, mode = 'at_least') {
    if (!url) return url;
    try {
        const u = new URL(url);
        const isImageKit = IMAGEKIT_HOSTS.includes(u.hostname) || u.hostname.endsWith('.imagekit.io');
        if (!isImageKit) return url;
        if (u.searchParams.has('tr') || u.pathname.includes('/tr:')) return url;
        if (/\.svg$/i.test(u.pathname)) return url;
        const parts = [`w-${width}`];
        if (height) parts.push(`h-${height}`);
        parts.push(`c-${mode}`, 'q-80', 'f-auto');
        return `${url}${url.includes('?') ? '&' : '?'}tr=${parts.join(',')}`;
    } catch {
        return url;
    }
}

// Customer-facing order number: the last 6 characters of the order id,
// upper-cased. Same format the verification screen and the WhatsApp
// verification message already use, so everything matches.
export function orderNumber(id) {
    return `#${String(id).slice(-6).toUpperCase()}`;
}

// ── Phone numbers (Iraq) ─────────────────────────────────────
// Local format: 11 digits, starting with 0 (e.g. 07701234567).
export function toLatinDigits(value) {
    return String(value ?? '')
        .replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x0660)
        .replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 0x06F0);
}

export function isValidIraqPhone(value) {
    return /^0\d{10}$/.test(toLatinDigits(value).replace(/\s/g, ''));
}

// Turns older stored formats (+9647701234567, 9647701234567, 7701234567)
// into the local 11-digit form for display in the forms. Anything it
// doesn't recognise is returned as plain digits, unchanged.
export function toLocalPhone(raw) {
    let d = toLatinDigits(raw).replace(/\D/g, '');
    if (d.startsWith('00964')) d = d.slice(5);
    else if (d.startsWith('964')) d = d.slice(3);
    if (d.length === 10 && d[0] === '7') d = `0${d}`;
    return d;
}

export const LOCK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="مثبّت" role="img"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function linkifyText(str) {
    const escaped = escapeHtml(str);
    return escaped.replace(/((?:https?:\/\/|www\.)[^\s<]+)/gi, (match) => {
        // Trim trailing punctuation that's likely part of the sentence,
        // not the URL (e.g. "see example.com." or "(example.com)").
        const trailing = /[).,!?؟،]+$/.exec(match)?.[0] || '';
        const url = trailing ? match.slice(0, -trailing.length) : match;
        if (!url) return match;
        const href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
    });
}

// ── Body scroll lock (cart drawer / nav drawer / detail sheet) ──
//
// Without this, a touch/scroll gesture that starts inside an open overlay
// but reaches the top/bottom of that overlay's own scrollable area falls
// through and scrolls the page underneath instead (scroll chaining) --
// most noticeable on iOS Safari, which doesn't reliably respect
// `overflow: hidden` on <body> alone to stop background scrolling/bounce.
// Locking with `position: fixed` (recording and restoring scrollY) is the
// standard, dependency-free technique that works consistently there.
// Reference-counted so that if two overlays are ever open at once, the
// body only unlocks once the last one closes.
let bodyScrollLockCount = 0;
let bodyScrollLockY = 0;

export function lockBodyScroll() {
    if (bodyScrollLockCount === 0) {
        bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${bodyScrollLockY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    }
    bodyScrollLockCount += 1;
}

export function unlockBodyScroll() {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, bodyScrollLockY);
    }
}
