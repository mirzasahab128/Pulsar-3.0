// Mints a real RS256 Firebase-shaped ID token signed with the throwaway
// test key. Usage: node tests/mint-token.mjs '{"email":"x@y.z","sub":"u1"}'
// Run from the project root (reads firebase-applet-config.json for aud/iss).
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const keys = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./test-keys.json', import.meta.url)), 'utf8'));
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const overrides = JSON.parse(process.argv[2] || '{}');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'RS256', kid: keys.kid, typ: 'JWT' };
const payload = {
  sub: 'user-123',
  aud: config.projectId,
  iss: `https://securetoken.google.com/${config.projectId}`,
  iat: now,
  exp: now + 3600,
  email: 'owner-test@example.com',
  email_verified: true,
  ...overrides
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const data = `${b64u(header)}.${b64u(payload)}`;
const sig = crypto.createSign('RSA-SHA256').update(data).sign(keys.privatePem).toString('base64url');
console.log(`${data}.${sig}`);
