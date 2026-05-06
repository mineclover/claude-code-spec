/**
 * Re-exported from @context-action/session-core/fingerprint. Lives off the
 * package's main barrel because it transitively depends on node:crypto via
 * the prefix-hashing helpers.
 */

export { detectDrift, extractObservedFingerprint } from '@context-action/session-core/fingerprint';
