// Test bootstrap for the Phase 0 HTTP battery (tests-phase0.py).
//
// Sets a throwaway OWNER_EMAILS (unless the caller provided one) and stubs
// ONLY the certificate source used by verifyFirebaseIdToken, pointing it at
// the locally generated test keypair. Signature verification, aud/iss
// checks, and the owner gate all run for real — this is the injectable
// verifier pattern from the master prompt §0.2, not an auth bypass.
process.env.OWNER_EMAILS = process.env.OWNER_EMAILS || 'owner-test@example.com';

import fs from 'fs';

const keys = JSON.parse(
  fs.readFileSync(new URL('./test-keys.json', import.meta.url), 'utf8')
);

const sec: any = await import('../server/security.js');
sec.__setCertFetcherForTests(async () => ({ [keys.kid]: keys.publicPem }));

await import('../server.ts');
