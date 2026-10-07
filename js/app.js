// Every feature module wires up its own DOM listeners as soon as it's
// imported (this mirrors exactly how the single-file version worked --
// splitting into files changed nothing about *when* each piece of code
// runs, only *where* it lives). auth.js is imported last because it's
// the one that actually kicks off loadData() and the rest of app init,
// so everything else should already be wired up by the time that happens.
import './catalog.js';
import './cart.js';
import './checkout.js';
import './nav.js';
import './account.js';
import './orders.js';
import './favorites.js';
import './detail-sheet.js';
import './branding.js';
import './phone.js';
import './keyboard.js';
import './auth.js';
