---
'multiai-cli': patch
---

fix(oauth): make managed-MultiAI sign-in reliable through flaky proxies and clock drift

- Bounded all OAuth requests with a 15s timeout and added retries to the idempotent GETs (metadata, userinfo, models) so an unresponsive proxy no longer makes login hang for minutes or fail outright.
- Relaxed the ID-token clock-skew allowance from 60s to 300s; a laptop whose clock is slightly off no longer fails sign-in with an "expired ID token" error.
- Cache the JWKS key set across logins/refreshes instead of re-fetching it on every verify.
- A transient refresh or device-poll network failure no longer deletes your stored session or aborts an in-progress login; only a real server revocation does.
- A once-failed OAuth metadata fetch is retried on the next attempt instead of being cached as broken for the rest of the process.