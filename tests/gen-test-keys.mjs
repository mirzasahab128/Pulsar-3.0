// Generates the throwaway RSA keypair used by tests/test-server.ts and
// tests/mint-token.mjs. Test-only material; gitignored (tests/test-keys.json).
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const out = {
  kid: 'phase0-test-kid',
  publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
};
const path = fileURLToPath(new URL('./test-keys.json', import.meta.url));
fs.writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`wrote ${path}`);
