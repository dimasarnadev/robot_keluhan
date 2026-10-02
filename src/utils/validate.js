class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

const isBlank = (value) =>
    value === undefined || value === null || value === '';

function parseInteger(value) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) ? value : null;
    }

    if (typeof value === 'string' && /^-?\d{1,15}$/.test(value.trim())) {
        return Number(value.trim());
    }

    return null;
}

function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const date = new Date(`${value}T00:00:00Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        return null;
    }

    return value;
}

function requireInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
    if (isBlank(body[field])) {
        throw new ValidationError(`${field} wajib dikirim.`);
    }

    const number = parseInteger(body[field]);

    if (number === null) {
        throw new ValidationError(`${field} harus berupa integer.`);
    }

    if (number < min) {
        throw new ValidationError(`${field} minimal ${min}.`);
    }

    if (number > max) {
        throw new ValidationError(`${field} maksimal ${max}.`);
    }

    return number;
}

function requireDate(body, field) {
    if (isBlank(body[field])) {
        throw new ValidationError(`${field} wajib dikirim.`);
    }

    const date = parseDate(body[field]);

    if (!date) {
        throw new ValidationError(`${field} harus berformat YYYY-MM-DD.`);
    }

    return date;
}

function optionalString(body, field, maxLength = 100) {
    const value = body[field];

    if (isBlank(value)) {
        return null;
    }

    if (typeof value !== 'string' || value.trim().length > maxLength) {
        throw new ValidationError(
            `${field} harus berupa string maksimal ${maxLength} karakter.`
        );
    }

    return value.trim();
}

module.exports = {
    ValidationError,
    parseInteger,
    parseDate,
    requireInteger,
    requireDate,
    optionalString
};
