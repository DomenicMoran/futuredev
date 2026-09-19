# supabase

Migrationen für das FutureDev-Projekt. Das Supabase-Projekt selbst wird erst in
Phase 3 angelegt, in der Organisation "MenuCloud Berlin"
(`lpbkgppvudutviegowog`), Region `eu-central-1` (Frankfurt), geprüfter Preis 0
EUR/Monat (siehe Entscheidung
`2026-09-19-futuredev-supabase-organisation-menucloud-berlin` im Vault).

## Anwenden (Phase 3)

Kein globales `supabase`-CLI auf dem Rechner installiert, deshalb über `npx`:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`0001_init.sql` legt die drei Tabellen aus Entscheidung 6 des Zusatzauftrags
Phase 2 an (`content_releases`, `app_events`, `feedback`), jede mit Row Level
Security und benannten Ausnahmen, dazu die Storage-Eimer `content` und `audio`
mit öffentlichem Lesen und ohne Client-Schreibrechte.
