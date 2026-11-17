// Отпечаток пароля демо-режима для сервера (ADMIN_PASSWORD_HASH) и для режима без сервера (LOCAL_HASH в src/records.js).
//   node server/hash-password.mjs '<пароль>'
// Пароль нигде не сохраняется: в настройки кладётся только отпечаток.
import crypto from 'node:crypto';
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error('Использование: node server/hash-password.mjs \'<пароль не короче 12 символов>\''); process.exit(1); }
const N = 2 ** 15, r = 8, p = 1, salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pw.normalize('NFC'), salt, 32, {N, r, p, maxmem: 256 * 1024 * 1024});
console.log('ADMIN_PASSWORD_HASH=' + ['scrypt', N, r, p, salt.toString('hex'), hash.toString('hex')].join(':'));
console.log('LOCAL_HASH (src/records.js) = ' + crypto.createHash('sha256').update('pe-stand-2026:' + pw.normalize('NFC')).digest('hex'));
