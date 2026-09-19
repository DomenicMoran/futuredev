# tools/publish

Noch kein Code, entsteht in Phase 3. Lädt `content/manifest.json` und alle seit
der letzten Veröffentlichung geänderten Dateien aus `content/lessons/` in den
öffentlichen Supabase-Storage-Eimer `content` hoch (lesend öffentlich, RLS ohne
Schreibrechte für Clients, siehe `supabase/migrations/0001_init.sql`).

Audio geht bis zur Freigabe des Cloudflare-R2-Kontos (Entscheidung
`2026-09-19-futuredev-audio-auf-cloudflare-r2`) in den Supabase-Storage-Eimer
`audio`, danach nach R2 in den Eimer `futuredev-audio`. Die App kennt nur die
Basis-URL aus dem Manifest, der Wechsel ist ein Konfigurationswert, kein
Code-Update.

Braucht `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nur für dieses Werkzeug auf
dem Rechner, nie in der App) und, sobald R2 freigegeben ist, `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` aus `.env.local`.
