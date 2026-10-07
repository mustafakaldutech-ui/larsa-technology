import { loginCaptchaEl, signupCaptchaEl } from './dom.js';

// ── Cloudflare Turnstile (CAPTCHA) ───────────────────────────
//
// The site key is public by design (it is meant to live in front-end code).
// The matching SECRET key must never appear here -- it belongs only in
// Supabase: Authentication -> Attack Protection -> Enable CAPTCHA protection.
// Supabase then verifies every token server-side before it lets a
// sign-up / sign-in / password-reset request through.
const SITE_KEY = '0x4AAAAAAFKf7na2VlMqvOUP';

let scriptPromise = null;
function loadTurnstileScript() {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
        if (window.turnstile) { resolve(window.turnstile); return; }
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => resolve(window.turnstile);
        s.onerror = () => { scriptPromise = null; reject(new Error('Turnstile failed to load')); };
        document.head.appendChild(s);
    });
    return scriptPromise;
}

// One widget per form. Tokens are single-use: call reset() after every
// attempt (success or failure) so the next attempt gets a fresh one.
export function createCaptcha(container) {
    let widgetId = null;
    let token = null;
    let mounting = null;

    async function mount() {
        if (widgetId !== null) return;
        if (mounting) return mounting;
        mounting = (async () => {
            try {
                const turnstile = await loadTurnstileScript();
                widgetId = turnstile.render(container, {
                    sitekey: SITE_KEY,
                    size: 'flexible',
                    language: 'ar',
                    callback: (t) => { token = t; },
                    'expired-callback': () => { token = null; },
                    'error-callback': () => { token = null; },
                });
            } catch (error) {
                console.error(error);
            } finally {
                mounting = null;
            }
        })();
        return mounting;
    }

    return {
        mount,
        getToken: () => token,
        reset() {
            token = null;
            if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
        },
    };
}

export const loginCaptcha = createCaptcha(loginCaptchaEl);
export const signupCaptcha = createCaptcha(signupCaptchaEl);
