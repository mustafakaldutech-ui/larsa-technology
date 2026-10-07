import { supabase } from './supabaseCon.js';
import { state, DEFAULT_NAME } from './state.js';
import {
    accLoginBox, accSignupBox, accProfileBox, showSignupBtn, showLoginBtn,
    authSignupForm, accGovernorate, signupName, signupEmail, signupPassword, signupError, signupSuccess, signupSubmitBtn,
    accName, accPhone, accPhoneLock, accPhoneField, accPhoneHint, accAltPhone, accAddress, accNotes,
    accountError, accountSuccess, accountSaveBtn, verifiedChip,
    newPasswordInput, confirmPasswordInput, passwordError, passwordSuccess, changePasswordBtn,
} from './dom.js';
import { loginCaptcha, signupCaptcha } from './turnstile.js';
import { isValidIraqPhone, toLocalPhone } from './utils.js';
import { buildAddress, splitAddress } from './address.js';

export async function loadUserProfile() {
    if (!state.currentUser) { state.currentUserProfile = null; return null; }
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', state.currentUser.id)
            .maybeSingle();
        if (error) throw error;
        state.currentUserProfile = data;
    } catch (error) {
        console.error('Could not load account profile', error);
        state.currentUserProfile = null;
    }
    return state.currentUserProfile;
}

// ── Account: login / signup / profile ─────────────────────────

// The Turnstile widgets are mounted only once their box is actually visible
// (a widget rendered inside a hidden container can fail to initialise).
export function showLoginBox() { accLoginBox.hidden = false; accSignupBox.hidden = true; accProfileBox.hidden = true; loginCaptcha.mount(); }
export function showSignupBox() { accLoginBox.hidden = true; accSignupBox.hidden = false; accProfileBox.hidden = true; signupCaptcha.mount(); }
export function showProfileBox() { accLoginBox.hidden = true; accSignupBox.hidden = true; accProfileBox.hidden = false; }

showSignupBtn.addEventListener('click', showSignupBox);
showLoginBtn.addEventListener('click', showLoginBox);

// ── Signup (self-service -- accounts start unverified) ─────────

authSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.hidden = true;
    signupSuccess.hidden = true;

    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;

    const captchaToken = signupCaptcha.getToken();
    if (!captchaToken) {
        signupError.textContent = 'أكمل التحقق الأمني أولًا ثم حاول مرة أخرى.';
        signupError.hidden = false;
        signupCaptcha.mount();
        return;
    }

    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = 'جارٍ الإنشاء...';
    try {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { captchaToken } });
        if (error) {
            signupError.textContent = error.message.includes('already registered')
                ? 'هذا البريد مسجّل مسبقاً — سجّل الدخول بدلاً من ذلك.'
                : 'تعذّر إنشاء الحساب. حاول مرة أخرى.';
            signupError.hidden = false;
            return;
        }

        // A profile row already exists (auto-created by the on_auth_user_created
        // trigger the moment the account was created) -- just add the name.
        if (data.user) await supabase.from('profiles').update({ name }).eq('id', data.user.id);

        if (data.session) {
            authSignupForm.reset();
            // onAuthStateChange (in auth.js) takes it from here.
        } else {
            signupSuccess.textContent = 'تم إنشاء حسابك! تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول.';
            signupSuccess.hidden = false;
            authSignupForm.reset();
        }
    } finally {
        signupCaptcha.reset();
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = 'إنشاء الحساب';
    }
});

// ── Profile ──────────────────────────────────────────────────

// True while this account has a first order awaiting the admin's
// WhatsApp/SMS check -- primary_phone is locked during that window too
// (mirrors protect_profile_phone in the database), so the field is shown
// read-only rather than letting the customer attempt an edit that the
// database will refuse anyway.
let hasPendingVerificationOrder = false;

async function checkPendingVerification() {
    if (!state.currentUser) return false;
    const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', state.currentUser.id)
        .eq('status', 'pending_verification');
    return (count || 0) > 0;
}

function setPhoneHint(kind, text) {
    // The lock icon shows only for a verified account (empty text = verified).
    accPhoneLock.hidden = kind !== 'info' || text !== '';
    accPhone.closest('.phone-row').classList.toggle('is-locked', !accPhoneLock.hidden);
    accPhoneHint.className = `field-note field-note-${kind}`;
    accPhoneHint.textContent = text;
}

export async function fillAccountForm() {
    showProfileBox();
    accName.value = state.currentUserProfile?.name || '';
    accAltPhone.value = toLocalPhone(state.currentUserProfile?.alternate_phone);
    const savedAddress = splitAddress(state.currentUserProfile?.address);
    accGovernorate.value = savedAddress.governorate;
    accAddress.value = savedAddress.details;
    accNotes.value = state.currentUserProfile?.note || '';
    accountError.hidden = true;
    accountSuccess.hidden = true;
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    passwordError.hidden = true;
    passwordSuccess.hidden = true;

    hasPendingVerificationOrder = await checkPendingVerification();

    if (state.currentUserProfile?.verified) {
        verifiedChip.textContent = '✓ موثّق';
        verifiedChip.className = 'status-chip verified';
        accPhone.value = toLocalPhone(state.currentUserProfile?.primary_phone);
        accPhone.disabled = true;
        setPhoneHint('info', ''); // verified: just the greyed-out field + lock icon, no extra text
    } else if (hasPendingVerificationOrder) {
        verifiedChip.textContent = 'بانتظار التوثيق';
        verifiedChip.className = 'status-chip unverified';
        accPhone.value = toLocalPhone(state.currentUserProfile?.primary_phone);
        accPhone.disabled = true;
        setPhoneHint('info', '🔒 رقمك الأساسي قيد المراجعة بعد طلبك الأول، ولا يمكن تغييره الآن. الهاتف البديل يمكنك تغييره متى شئت.');
    } else {
        verifiedChip.textContent = 'غير موثّق بعد';
        verifiedChip.className = 'status-chip unverified';
        accPhone.value = toLocalPhone(state.currentUserProfile?.primary_phone);
        accPhone.disabled = false;
        setPhoneHint('warn', '⚠️ انتبه: بعد أول طلب لن تتمكن من تغيير رقم هاتفك الأساسي، فتأكد من صحته. (الهاتف البديل يمكن تغييره دائمًا). سيُطلب تأكيده مرة واحدة فقط عبر واتساب أو SMS.');
    }
}

accountSaveBtn.addEventListener('click', async () => {
    if (!state.currentUser) return;
    accountError.hidden = true;
    accountSuccess.hidden = true;

    const fail = (message) => { accountError.textContent = message; accountError.hidden = false; };

    if (!accPhone.disabled && accPhone.value.trim() && !isValidIraqPhone(accPhone.value)) {
        return fail('رقم الهاتف يجب أن يتكوّن من 11 رقمًا ويبدأ بالصفر، مثال: 07701234567');
    }
    if (accAltPhone.value.trim() && !isValidIraqPhone(accAltPhone.value)) {
        return fail('رقم الهاتف البديل يجب أن يتكوّن من 11 رقمًا ويبدأ بالصفر، أو اتركه فارغًا.');
    }
    if (!accGovernorate.value) return fail('الرجاء اختيار المحافظة.');
    if (!accAddress.value.trim()) return fail('الرجاء كتابة تكملة العنوان (القضاء اوالناحية - أقرب نقطة دالة).');
    const address = buildAddress(accGovernorate.value, accAddress.value.trim());

    const name = accName.value.trim() || DEFAULT_NAME;
    accName.value = name;

    accountSaveBtn.disabled = true;
    accountSaveBtn.textContent = 'جارٍ الحفظ...';

    try {
        const profile = {
            name,
            alternate_phone: accAltPhone.value.trim(),
            address,
            note: accNotes.value.trim(),
            updated_at: new Date().toISOString(),
        };
        // primary_phone is only ever included here while the field is
        // actually enabled (i.e. genuinely unverified with no pending
        // verification order) -- the database trigger enforces this
        // regardless, this just avoids sending a stale value from a
        // disabled field.
        if (!accPhone.disabled) profile.primary_phone = accPhone.value.trim() || null;

        const { error } = await supabase.from('profiles').update(profile).eq('id', state.currentUser.id);
        if (error) throw error;
        state.currentUserProfile = { ...state.currentUserProfile, ...profile };
        accountSuccess.hidden = false;
    } catch (error) {
        console.error('Could not save account', error);
        if (error.message?.includes('locked')) {
            accountError.textContent = 'رقمك مقفل مؤقتاً لحين مراجعة طلبك الأول -- لا يمكن تغييره الآن.';
        } else if (error.code === '23505' || error.message?.includes('duplicate key')) {
            accountError.textContent = 'رقم الهاتف هذا مسجّل بالفعل لحساب آخر. تحقق من الرقم وحاول مرة أخرى.';
        } else {
            accountError.textContent = 'تعذّر حفظ التغييرات. تحقق من اتصالك وحاول مرة أخرى.';
        }
        accountError.hidden = false;
    } finally {
        accountSaveBtn.disabled = false;
        accountSaveBtn.textContent = 'حفظ التغييرات';
    }
});

// ── Change password ─────────────────────────────────────────────
// Supabase Auth handles this directly (no table write, no RLS involved)
// -- it just needs the customer's current session to already be valid.

changePasswordBtn.addEventListener('click', async () => {
    if (!state.currentUser) return;
    passwordError.hidden = true;
    passwordSuccess.hidden = true;

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 6) {
        passwordError.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
        passwordError.hidden = false;
        return;
    }
    if (newPassword !== confirmPassword) {
        passwordError.textContent = 'كلمتا المرور غير متطابقتين.';
        passwordError.hidden = false;
        return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'جارٍ التحديث...';

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordSuccess.hidden = false;
    } catch (error) {
        console.error('Could not change password', error);
        passwordError.textContent = 'تعذّر تحديث كلمة المرور. حاول مرة أخرى.';
        passwordError.hidden = false;
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.textContent = 'تحديث كلمة المرور';
    }
});
