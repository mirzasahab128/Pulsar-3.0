import React from 'react';
import { ShieldCheck, ServerOff, Lock } from 'lucide-react';

/**
 * Phase 2 — honest placeholder for the Admin Command Center route.
 *
 * This panel NEVER renders admin data and NEVER grants a role: it is the
 * visible, truthful state for a signed-in user who is not a server-verified
 * master admin. The real AdminCommandCenter still renders only when
 * access.isMasterAdmin is true (server-derived), and /api/admin/* enforces
 * the same gate server-side. There is no master password and no bypass:
 * master access is the OWNER_EMAILS account, recognized by the server on
 * sign-in once the server is deployed.
 */
export const AdminUnavailablePanel: React.FC<{
  serverReachable: boolean;
  signedInEmail?: string | null;
}> = ({ serverReachable, signedInEmail }) => {
  return (
    <div className="space-y-5">
      <div className="pv-card p-6">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[var(--pv-mint)] text-[var(--pv-green)] flex items-center justify-center shrink-0">
            {serverReachable ? <Lock className="w-5 h-5" /> : <ServerOff className="w-5 h-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--pv-ink)] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--pv-green)]" />
              Admin Command Center — unavailable for this sign-in
            </h2>
            {signedInEmail && (
              <p className="text-xs text-[var(--pv-muted)] mt-1 truncate">
                Signed in as <span className="font-semibold text-[var(--pv-ink)]">{signedInEmail}</span>
              </p>
            )}
            {!serverReachable ? (
              <p className="text-sm text-[var(--pv-muted)] leading-relaxed mt-3">
                The live server is not reachable from this deployment — the site is currently
                served as a static page, so no server-side access check can run. The Admin
                Command Center unlocks automatically once the Pulsar server is deployed: sign
                in with the owner account and the server recognizes it as master admin on
                first sign-in. Nothing on this page can grant admin access, and there is no
                master password to enter — admin is the owner email, verified server-side.
              </p>
            ) : (
              <p className="text-sm text-[var(--pv-muted)] leading-relaxed mt-3">
                The server is reachable, but this account is not a master admin. Ask the
                workspace owner to approve your account and assign master access, or sign in
                with the owner account. Admin actions are enforced server-side and audit-logged;
                this page cannot change your role.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
