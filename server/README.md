# MedConnect API server

Kotlin/Ktor replacement for the Vercel serverless functions in `../api`. It serves
the web app and both mobile clients from one backend, so the Kotlin rewrite of the
app does not need a second API contract to maintain.

## What changed, and what deliberately did not

Every route is a port of its `api/*.js` counterpart: same paths, same query-string
switching, same request bodies, same status codes, same response keys. That
matters because the shipped web build and the installed Android APK call this API
without being modified, and both surface the `error` string from a response
directly to the user.

Three deliberate deviations:

- **Schema migrations.** The old code ran `CREATE TABLE IF NOT EXISTS` on the
  request path (`ensureDeckTables`, `ensureSettingsTable`, …). Flyway owns the
  schema now, in `src/main/resources/db/migration/V1__baseline.sql`. Existing
  databases are baselined and every statement is `IF NOT EXISTS`, so the first
  boot against production Neon is a no-op for anything already present.
- **Runtime `ALTER TABLE`.** `PUT /api/profile` used to add `focus`, `gender`,
  `study_styles` and `medical_school` lazily. Those columns are in the baseline,
  so the DDL is gone from the request path.
- **Password reset is an OTP-code flow** (matches the shipped clients, which send
  `{ action: 'confirm', email, code, password }`). Requesting a reset always
  returns `{ ok: true }` without revealing whether the email exists; the code is
  emailed in production and — only with `RESET_CODE_DEV_ECHO=true` — echoed as
  `devCode` for testing. Email delivery itself is still a TODO: wire a provider
  in `routes/Auth.kt` (a Resend-shaped TODO marks the spot).

## Requirements

- JDK 17 (the only JDK this project is built with)
- A PostgreSQL connection string. Neon works as-is.

## Running it

```bash
# copy .env.example to .env and fill in DATABASE_URL + JWT_SECRET, then:
set -a; . ./.env; set +a          # bash/zsh
.\gradlew.bat run                 # Windows

curl localhost:8080/healthz
```

## Tests

```bash
.\gradlew.bat test
```

`src/test/kotlin/app/medconnect/RoutesTest.kt` starts a real PostgreSQL via
`zonky` embedded-postgres, runs the real Flyway migration, mounts the real Ktor
module and drives every route over HTTP. It asserts wire-format details — exact
JSON keys, status codes, `jsonb` round-tripping, `exam_date` sliceable to
`YYYY-MM-DD` — because a renamed response field is a breaking change here even
though the Kotlin code stays happy.

## Build artefacts

```bash
.\gradlew.bat installDist          # -> build/install/medconnect-server/bin/medconnect-server
.\gradlew.bat shadowJar            # not configured; use installDist or the Dockerfile
docker build -t medconnect-server .
```

## Deploying

Any JVM host works — the Dockerfile is a plain HTTP container on `$PORT`.
Fly.io, Railway, Render and Google Cloud Run are the straightforward options;
Vercel is not, since a Kotlin/JVM process is not a supported function runtime.

The web app is pointed at this server by the `/api/:path*` rewrite in
`../vercel.json`, so it stays same-origin and needs no CORS configuration. For a
local frontend build, set `VITE_API_BASE=http://localhost:8080`.

### Cutover checklist

1. Deploy the Ktor server and confirm `GET /healthz` returns `{"ok":true}`.
2. **Carry `JWT_SECRET` over unchanged.** A different value silently invalidates
   every token in the field and logs out every user on web and Android.
3. Point the web rewrite at the new host, or set `VITE_API_BASE`.
4. Smoke-test: sign in, load the partners tab, send a message, mark study done.
5. Only then delete `../api`. While both are live they share one schema, so a
   write from one is visible to the other — which is useful for a staged rollout
   but not a long-term arrangement.

## Layout

```
src/main/kotlin/app/medconnect/
  Application.kt     Netty bootstrap, plugins, /healthz, module definition
  config/AppConfig.kt  environment -> typed config
  db/Db.kt           Hikari + JDBC helpers; rows map to JsonObject generically
  db/Migrator.kt     Flyway, baselined for pre-existing databases
  auth/Tokens.kt     HS256 sign/verify
  http/              request/response helpers shared by the routes
  push/PushService.kt  VAPID web push
  routes/            one file per original Vercel function
```

`db/Db.kt` returns rows as `JsonObject` rather than mapping them to data classes
on purpose: most handlers do `SELECT * FROM users` and return the row minus
`password_hash`, and a hand-written mapper would silently drop any column added
later — which is the bug class the old `schema-full.sql` header warns about.