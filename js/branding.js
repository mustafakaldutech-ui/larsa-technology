import { supabase } from './supabaseCon.js';
import { ik } from './utils.js';

// ── Branding: logo is a plain URL stored in the database
// (site_settings), changeable any time from SQL Editor without touching
// any code. Falls back to the built-in mark if none is set.
(async () => {
    const { data } = await supabase.from('site_settings').select('store_name, logo_url').eq('id', 1).maybeSingle();
    if (!data) return;
    if (data.store_name) document.title = data.store_name;
    if (data.logo_url) {
        document.querySelectorAll('.logo-mark').forEach((el) => {
            const img = document.createElement('img');
            img.src = ik(data.logo_url, 140, 140, 'at_max');
            img.alt = data.store_name || 'Logo';
            img.className = el.className;
            // Belt-and-suspenders: constrain size inline too, independent
            // of the stylesheet (covers any caching lag on style/shop.css
            // and makes this robust regardless of the source image's own
            // pixel dimensions or aspect ratio).
            img.style.cssText = 'display:block; width:auto; height:auto; max-width:140px; max-height:140px; object-fit:contain;';
            el.replaceWith(img);
        });
        // The uploaded logo image already has the store name drawn into
        // it -- the separate "LARSA" text label next to the built-in mark
        // would just be a redundant duplicate once a custom logo is set.
        // Browser-tab icon: reuse the store logo.
        const icon = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
        icon.href = ik(data.logo_url, 140, 140, 'at_max');

        document.querySelectorAll('.logo-word').forEach((el) => { el.hidden = true; });
    }
})();
