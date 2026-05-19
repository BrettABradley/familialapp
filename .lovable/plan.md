Send the existing `founder-gift` transactional email to brettbradley007@gmail.com as a preview, using the already-deployed `send-transactional-email` edge function.

- Template: `founder-gift` (already created and registered)
- Recipient: brettbradley007@gmail.com
- Template data: `{ name: "Brett" }`
- Idempotency key: `founder-gift-preview-brett-2026-05-19`

No code or infrastructure changes.