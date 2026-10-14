# Super Productivity real-client container

This runs the **complete production Electron app**, not the synthetic task prototype. Its native Local REST API operates on the app's real task state; the normal app owns account authentication, E2EE, snapshot/history import, reducers, migrations and sync. It uses a persistent desktop profile and needs **one-time GUI setup** through a local noVNC page. It is not a new headless SDK or an unattended credential importer.

**Status:** source delivery, not a verified published image. No Docker engine is available in the development workspace. The proxy and upstream native API tests can be run independently; a full image build and actual two-client encrypted sync/restart check are still required before trusting real tasks. Test first with a disposable account and make a normal app backup. No developer has accessed your real credentials/data.

## Files and topology

- `Dockerfile`: builds exact official source commit `173b3fa35f744bde46222a5bc141986a35bd5fb5`, then runs production Electron (no development API override).
- `compose.yaml`: official SuperSync image + PostgreSQL 16 + this client. Only loopback host ports are published: sync 1900, setup UI 6080, task API 3877.
- `proxy.cjs`: forwards to upstream API at container-loopback 3876. Retains bearer auth, rejects all browser Origin headers and unexpected Host headers. It does not store or inject credentials.
- `start.sh`: Xvfb, window manager, password-protected VNC/noVNC and Electron; kernel lock prevents concurrent profile writers.

The client profile contains decrypted local task data and credentials, just like a normal desktop installation. Protect its Docker volume, backups and host. E2EE protects the sync transport/server, not a compromised client host. Do not publish these ports publicly. The noVNC channel can display your full app and must be accessed only locally or through SSH.

## Build and configure

1. Install Docker Engine and Compose v2 on your own Linux host. Chromium sandbox support is required. This image deliberately does not pass `--no-sandbox`, use privileged mode, or disable Docker's security profile. If Electron reports sandbox/user-namespace permission errors, stop and retain the logs for runtime-specific review rather than adding those bypasses. This remains an unverified host-compatibility constraint.
2. Create `.env` beside Compose. The server is built from the unchanged official Dockerfile at the **same pinned source commit** as the client. This avoids assuming a matching published tag exists. Both builds must pass before use. You can later replace the server build with a verified compatible official image digest.
3. Set `POSTGRES_PASSWORD` (use URL-safe characters for DATABASE_URL), `JWT_SECRET` (strong random server signing secret), and SMTP settings if creating/logging into accounts on this new server. Set `PUBLIC_URL` to your externally reachable **HTTPS** server URL and `WEBAUTHN_RP_ID` to its hostname. Production upstream refuses an HTTP PUBLIC_URL and needs SMTP for email authentication. Arrange your own TLS reverse proxy to loopback port 1900; this bundle does not provision DNS/TLS. These are your own local files; do not send secrets to an assistant or commit them. The upstream server uses its normal email/passkey onboarding; this bundle does not create accounts or bypass verification. Consult the pinned upstream `packages/super-sync-server/env.example` for mail and authentication configuration.
4. Create `secrets/setup-vnc-password.txt` containing a private VNC setup password, restrict it and `.env` to your account. Traditional VNC authentication uses only the first 8 characters; the SSH tunnel is essential on remote hosts. Compose mounts the file read-only as a secret. Keep the setup password different from all app/sync credentials.
5. Run:

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose logs --tail=80 task-client superproductivity-sync
```

Fresh PostgreSQL initializes on first startup; the official server runs its own Prisma migrations via its supported startup option. Use a new volume for a disposable test, not an existing production database. For an existing remote SuperSync account you may run only the client (`docker compose -f compose.client-only.yaml up -d --build`) and configure that account's existing URL in the app. A fresh local server does not contain your existing tasks.

## One-time setup

For a remote host, establish a tunnel from your laptop:

```sh
ssh -L 6080:127.0.0.1:6080 -L 3877:127.0.0.1:3877 -L 1900:127.0.0.1:1900 YOUR_HOST
```

Open `http://127.0.0.1:6080/vnc.html`, connect, and enter your VNC setup password. The desktop is the production Super Productivity app.

1. Configure SuperSync through normal app settings. For the new Compose server, its URL from inside the client is `http://superproductivity-sync:1900`; from another client on the Docker host it is `http://localhost:1900`. For an existing account use its existing HTTPS server URL. Complete normal sign-in and enter the account's actual encryption password directly into the app.
2. If connecting to existing tasks, choose the normal **download/import remote state** flow after checking the dialog carefully. Never choose to overwrite the server with this new profile's empty state. Resolve password, migration, conflict and confirmation dialogs explicitly in the GUI.
3. Wait for a successful normal sync and check expected tasks/projects in the GUI. Verify against your other client. Only then enable **Settings → Misc → Enable local REST API**. Copy its Access Token into a local protected curl header file as below. Tokens are device-local and must not be reused as the sync-server token.
4. Keep noVNC available through your local tunnel for future login/encryption/conflict recovery. No wrapper auto-confirms dialogs.

## API use

Save a 0600 local header file containing `Authorization: Bearer YOUR_LOCAL_API_TOKEN`. Avoid putting the bearer in command arguments or shell history. Then:

```sh
curl --noproxy 127.0.0.1 -H @./api-header.txt http://127.0.0.1:3877/tasks
curl --noproxy 127.0.0.1 -H @./api-header.txt -H 'Content-Type: application/json' \
  -d '{"title":"Disposable integration check","projectId":"INBOX_PROJECT","isIgnoreShortSyntax":true}' \
  http://127.0.0.1:3877/tasks
```

Native paths include `GET /projects`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`. Read the pinned [native API documentation](https://github.com/super-productivity/super-productivity/blob/173b3fa35f744bde46222a5bc141986a35bd5fb5/docs/wiki/3.01-API.md) for semantics (the source commit is also recorded in Dockerfile).

An HTTP success means **accepted locally by the app**, not acknowledged by the sync server or another device. `/health` only proves the native server/renderer is available; `/status` is not a sync-health endpoint. There is no wrapper transaction/retry/idempotency or global revision guarantee. Do not automatically retry POST after an uncertain network result.

## Required disposable-account acceptance check

- Complete initial import from an existing disposable account with encrypted snapshot/history and verify existing tasks/projects in the GUI/API.
- Create via REST, sync normally, verify on a second full app client; edit there and verify back through REST.
- Restart the container, confirm profile/auth/history survived, then PATCH/DELETE the disposable task and verify the second client.
- Confirm missing bearer returns 401; wrong password/conflict dialogs never result in automatic overwrites.
- Record exact client/server image digests and Docker host/runtime used. This check has **not yet run** for this image.

`docker compose down` retains volumes. Do not use `down --volumes` unless deliberately deleting all local profile/server/database data. Back up before upgrades; pin compatible versions and inspect upstream migration/recovery notes.

## Publishing

No GHCR image is implied by these sources. The authorized publisher must build, perform runtime checks, then publish the real-client image and replace the local `image:` name with its actual verified GHCR tag/digest. Do not use the earlier synthetic image for real tasks.

## CI runtime smoke

After building `superproductivity-real-client:local`, run `bash smoke-container.sh`. This creates a disposable profile with no real account, enables container-loopback-only CDP solely for GUI testing, enables the API through the real UI, and checks native REST task creation/reload plus the noVNC page. It publishes no ports and does not disable Chromium sandboxing. Never set `CLIENT_DISPOSABLE_SMOKE` on a real profile. A successful smoke does not establish encrypted account interoperability.

## Chromium namespace sandbox profile

The client uses `seccomp-chromium.json`, derived from the unchanged Moby default at commit `6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef`. The baseline is included as `seccomp-default.json`; the only added rule permits `clone`, `setns`, and `unshare`, following [Playwright’s Docker sandbox guidance](https://playwright.dev/docs/docker). The remaining syscall restrictions, including socket-family protections, are preserved. The profile applies only to the client container. Chromium remains sandboxed and non-root; no privileged mode, SYS_ADMIN capability, unconfined profile, or host sysctl change is used. Host AppArmor/user-namespace policies may independently prevent startup; do not weaken them automatically.

Baseline: https://github.com/moby/profiles/blob/6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef/seccomp/default.json
