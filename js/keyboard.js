import { closeCartDrawer } from './cart.js';
import { closeNavDrawer } from './nav.js';
import { closeDetailSheet } from './detail-sheet.js';

// Escape closes whichever panel is on top: product sheet first, then the
// cart, then the side menu.
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.getElementById('detailSheet')?.getAttribute('aria-hidden') === 'false') closeDetailSheet();
    else if (document.getElementById('cartDrawer')?.classList.contains('open')) closeCartDrawer();
    else if (document.getElementById('navDrawer')?.classList.contains('open')) closeNavDrawer();
});
