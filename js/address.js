// Delivery address = governorate (one of Iraq's 18) + the rest of the
// address. It is stored as ONE text value, "المحافظة - التفاصيل", so the
// database, create_order() and the admin side need no changes.
export const GOVERNORATES = [
    'بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك',
    'كركوك', 'الأنبار', 'بابل', 'كربلاء', 'النجف', 'واسط',
    'ذي قار', 'ميسان', 'المثنى', 'القادسية', 'صلاح الدين', 'ديالى',
];

const SEPARATOR = ' - ';

export function buildAddress(governorate, details) {
    return `${governorate}${SEPARATOR}${details}`;
}

// Reverses buildAddress(); older addresses typed as free text just come
// back with an empty governorate and the whole text as the details.
export function splitAddress(address) {
    const text = String(address || '');
    const i = text.indexOf(SEPARATOR);
    if (i > 0) {
        const governorate = text.slice(0, i);
        if (GOVERNORATES.includes(governorate)) {
            return { governorate, details: text.slice(i + SEPARATOR.length) };
        }
    }
    return { governorate: '', details: text };
}

['custGovernorate', 'accGovernorate'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">اختر المحافظة</option>'
        + GOVERNORATES.map((g) => `<option value="${g}">${g}</option>`).join('');
});
