const TIMEZONE = 'Asia/Jakarta';

// Karakter kontrol dan karakter pembalik arah teks (bidi override).
const CONTROL_CHARS =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;

// Karakter markup WhatsApp: *tebal* _miring_ ~coret~ `kode`
const WHATSAPP_MARKUP = /[*_~`]/g;

function formatDateTime(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('id-ID', {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format YYYY-MM-DD
function formatDateOnly(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// Membersihkan teks dari sumber luar sebelum dikirim ke WhatsApp.
function sanitizeText(value, maxLength = 500) {
    if (value === null || value === undefined) {
        return '-';
    }

    const text = String(value)
        .replace(CONTROL_CHARS, '')
        .replace(WHATSAPP_MARKUP, '')
        .trim();

    if (!text) {
        return '-';
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

module.exports = {
    formatDateTime,
    formatDateOnly,
    sanitizeText
};
