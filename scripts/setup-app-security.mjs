import { randomBytes, scryptSync } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const envFile = '.env.local';
const existing = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
if (/^APP_ADMIN_PASSWORD_HASH=.+/m.test(existing)) {
  console.log('Admin credentials already configured; existing credentials were preserved.');
} else {
  const username = /^APP_ADMIN_USERNAME=(.+)$/m.exec(existing)?.[1].trim() || 'security-admin';
  if (username === 'admin') throw new Error('Admin username must differ from the demo account.');
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
  writeFileSync('.env.security-admin.local', `TENDLY ADMIN — LOCAL ONLY\nUsername: ${username}\nPassword: ${password}\n`, { flag: 'wx', mode: 0o600 });
  // Next dotenv expands dollar signs, so escape the hash separators in the env file.
  appendFileSync(envFile, `\nAPP_ADMIN_USERNAME=${username}\nAPP_ADMIN_PASSWORD_HASH=${passwordHash.replaceAll('$', '\\$')}\n`);
  console.log('Admin credentials created in .env.security-admin.local. Do not commit or share this file.');
}
