# Attic - retired, do not import or deploy from here

## api-legacy/ (archived from `api/`)
The old Vercel serverless functions (13 endpoints) plus the two duplicate
schema files (`schema.sql`, `schema-full.sql`).

**Canonical backend is `server/` (Kotlin/Ktor), live at api.medconnect.app**
(`vercel.json` rewrites `/api/*` there). Edit backend code only in
`server/src/main/kotlin/app/medconnect/routes/`. Schema truth is Flyway
`server/src/main/resources/db/migration/V1__baseline.sql`.

## BLOCKERS - read before touching anything here
1. **Ktor has no `/logbook` route and V1 has no `logbook_entries` /
   `logbook_targets` tables** (the only tables in `schema-full.sql` missing
   from V1). If production traffic reaches Ktor, Logbook persistence is
   broken; if it still reaches these functions, deleting this directory
   breaks it. Verify Vercel routing precedence + function logs, then port
   `logbook.js` to Ktor (route + V2 migration) before removing this attic.
2. Do not re-add these files to any build or import them - they exist only
   as a readable record of the old contract (wire format reference for
   keeping Ktor responses identical).
