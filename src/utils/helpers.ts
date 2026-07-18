import { randomInt } from 'node:crypto';

/** Alphabet for CSP nonces — alphanumerics only, safe unquoted in a CSP header. */
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a random 32-character alphanumeric nonce for a webview CSP.
 *
 * Uses `node:crypto`'s CSPRNG rather than `Math.random()`: a nonce is the only
 * thing standing between an injected `<script>` and execution, so a predictable
 * sequence would defeat the policy it exists to enforce. A fresh nonce is
 * required per rendered document for the same reason.
 *
 * @returns A 32-character string of `[A-Za-z0-9]`.
 *
 * @example
 * const nonce = getNonce();
 * const csp = `script-src 'nonce-${nonce}';`;
 */
export function getNonce() {
	let text = '';
	for (let i = 0; i < 32; i++) {
		text += NONCE_ALPHABET.charAt(randomInt(NONCE_ALPHABET.length));
	}
	return text;
}
