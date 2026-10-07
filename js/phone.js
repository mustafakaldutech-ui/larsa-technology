import { toLatinDigits } from './utils.js';

// Every phone field (marked data-phone) accepts digits only, converts
// Arabic-Indic digits to normal ones, and stops at 11 characters.
document.querySelectorAll('input[data-phone]').forEach((input) => {
    input.addEventListener('input', () => {
        const cleaned = toLatinDigits(input.value).replace(/\D/g, '').slice(0, 11);
        if (cleaned !== input.value) input.value = cleaned;
    });
});
