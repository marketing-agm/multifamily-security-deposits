# Learnings entry — field reference

Entries are appended by `scripts/log.mjs` (do not hand-edit the hidden
`<!-- log-id: ... -->` markers). Fields:

- **area** — one of the slugs in config.json: ui, lib, infra, misc
- **type** — bug | ux | regression | gotcha
- **title** — short, specific
- **key** — the fixing commit's short SHA (idempotency identity)
- **ref** — human-readable provenance shown in the entry (defaults to key)
- **summary** — the one-line lesson that goes in the index
- **symptom** — what was observed
- **rootCause** — why it happened
- **fix** — what changed (files + PR/commit)
- **lesson** — the imperative rule a future session should follow
