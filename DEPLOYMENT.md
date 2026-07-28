# Production Deployment

This guide deploys one MeshMind web process on a Linux host behind Nginx. PostgreSQL
and Redis are external services and are not started with Docker Compose in production.

## Prerequisites

- Node.js 24 and npm.
- Git, Nginx 1.25.1 or newer, and systemd.
- A PostgreSQL database reachable from the application host.
- A Redis 6.2 or newer primary reachable from the application host.
- A DNS record for the application host and a trusted TLS certificate.

Only ports 80 and 443 should serve application traffic. SSH must also be reachable
from GitHub-hosted runners for deployment. Restrict PostgreSQL and Redis to private
networks or provider allowlists, and bind the Next.js process to `127.0.0.1`.

## External Services

Create the PostgreSQL database and credentials before deployment. The account used
by `npm run db:migrate` must be allowed to create tables, indexes, and Drizzle's
migration metadata. The included workflow uses the `DATABASE_URL` from
`.env` for migrations and runtime access. For stricter deployments, adapt
the migration step to export a separate account's URL only for that command.

Redis stores sessions, authentication challenges, replay-prevention state, and rate
limits. Configure TLS, ACL credentials, persistence, high availability, and a
`noeviction` policy. Use a stable primary endpoint with Lua/`EVAL` support; the
application does not accept a Redis Cluster or Sentinel URL. Authentication fails
closed when Redis is unavailable.

Enable TLS for both services whenever traffic leaves the application host. Typical
connection URLs are:

```text
postgresql://APP_USER:URL_ENCODED_PASSWORD@db.internal.example.com:5432/meshmind?sslmode=verify-full
rediss://APP_USER:URL_ENCODED_PASSWORD@redis.internal.example.com:6379/0
```

URL-encode usernames and passwords before placing them in connection URLs. Configure
automated PostgreSQL backups and regularly test restoration. Install the provider's
CA on the host, or configure `NODE_EXTRA_CA_CERTS`, when it uses a private CA.

## Secrets And Environment

Keep production secrets outside version control in `/opt/meshmind-ai/.env`, owned by
root and readable by the `meshmindai` group. Generate three independent 32-byte HMAC
keys with `openssl rand -base64 32`.

The initial host setup provisions the built-in superadmin. Store its generated login
password and time-based one-time password (TOTP) URI in the appropriate password
manager. Set only the generated identifier, password hash, and TOTP secret in the
application environment. Never set the plaintext `SUPERADMIN_PASSWORD` there.

```env
NODE_ENV=production

DATABASE_URL="postgresql://APP_USER:URL_ENCODED_PASSWORD@db.internal.example.com:5432/meshmind?sslmode=verify-full"

APP_URL=https://app.example.com
# Safe only because the provided Nginx config overwrites client forwarding headers.
AUTH_TRUST_PROXY_HEADERS=true

REDIS_URL="rediss://APP_USER:URL_ENCODED_PASSWORD@redis.internal.example.com:6379/0"
REDIS_KEY_PREFIX=mm:production:v1

# The first session key is active. Keep old keys after it during a rotation.
SESSION_HMAC_KEYS="k1:REPLACE_WITH_BASE64_KEY"
RATE_LIMIT_HMAC_KEY="REPLACE_WITH_INDEPENDENT_BASE64_KEY"
RESET_TOKEN_HMAC_KEY="REPLACE_WITH_INDEPENDENT_BASE64_KEY"

SUPERADMIN_IDENTIFIER=meshmind-operations
SUPERADMIN_PASSWORD_HASH="REPLACE_WITH_GENERATED_ARGON2_HASH"
SUPERADMIN_TOTP_SECRET="REPLACE_WITH_GENERATED_BASE32_SECRET"
SUPERADMIN_CREDENTIAL_VERSION=1

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=replace-me
SMTP_PASSWORD=replace-me
SMTP_FROM="MeshMind <no-reply@example.com>"
```

Use the same environment when building and running the application. Values prefixed
with `NEXT_PUBLIC_` are embedded during `npm run build`; server-only variables are
read at runtime. Both the build and migration commands and `systemd.service` load
`.env`. The server port and hostname are passed directly to `next start` because
Next.js does not load `PORT` from an env file during server startup.

Restrict the environment file after creating it:

```bash
sudo chown root:meshmindai /opt/meshmind-ai/.env
sudo chmod 640 /opt/meshmind-ai/.env
```

## Initial Host Setup

The deployment workflow updates an existing checkout in place. Create the checkout
as the deployment user:

```bash
sudo install -d -o meshmindai -g meshmindai /opt/meshmind-ai
sudo -u meshmindai -H git clone --branch main https://github.com/your-org/meshmind-ai.git /opt/meshmind-ai
sudo -u meshmindai -H sh -c 'cd /opt/meshmind-ai && npm ci'
sudo -u meshmindai -H sh -c 'cd /opt/meshmind-ai && npm run auth:provision-superadmin -- meshmind-operations'
```

The host must be able to pull the repository non-interactively. For a private
repository, configure an SSH deploy key or another Git credential for the
`meshmindai` user, and verify that the checkout's `origin` points to the repository.

Create `/opt/meshmind-ai/.env` with the values above, then set its permissions:

```bash
sudo cp /opt/meshmind-ai/.env.example /opt/meshmind-ai/.env
sudoedit /opt/meshmind-ai/.env
sudo chown root:meshmindai /opt/meshmind-ai/.env
sudo chmod 640 /opt/meshmind-ai/.env
sudo -u meshmindai -H sh -c 'cd /opt/meshmind-ai && npm test && npm run build && npm run db:migrate'
```

The automated deployment repeats `git pull --ff-only origin main`, `npm ci`,
`npm run build`, and `npm run db:migrate` after the `Tests` workflow succeeds on
`main`. It does not start an inactive service; start the service during initial
setup as described below.

## GitHub Actions Deployment

Add these secrets to the repository or its `production` environment:

- `DEPLOY_HOST`: the SSH hostname or address.
- `DEPLOY_SSH_PRIVATE_KEY`: the private key whose public key is authorized for
  `meshmindai`.

The workflow does not use a known-hosts secret. SSH host-key checking is disabled,
so use a deployment-only key restricted to this host and account.

Install the public key on the host:

```bash
sudo install -d -m 700 -o meshmindai -g meshmindai /home/meshmindai/.ssh
sudo touch /home/meshmindai/.ssh/authorized_keys
sudo chown meshmindai:meshmindai /home/meshmindai/.ssh/authorized_keys
sudo chmod 600 /home/meshmindai/.ssh/authorized_keys
sudo tee -a /home/meshmindai/.ssh/authorized_keys < deploy-key.pub >/dev/null
```

Grant only the systemd commands used by the workflow. Create the sudoers file with
`visudo` and verify the path from `command -v systemctl` on the host:

```bash
sudo visudo -f /etc/sudoers.d/meshmind-ai-deploy
```

```sudoers
meshmindai ALL=(root) NOPASSWD: \
    /usr/bin/systemctl is-active --quiet meshmind-ai.service, \
    /usr/bin/systemctl restart meshmind-ai.service
```

`npm run db:migrate` applies the versioned SQL files in `drizzle/`. Keep migrations
forward-compatible with the currently running application. The workflow restarts
`meshmind-ai.service` only when it is already active.

## Systemd

The repository contains the unit at `systemd.service`. It runs from
`/opt/meshmind-ai` as `meshmindai` and loads `/opt/meshmind-ai/.env`.
Symlink it into systemd so updates to the tracked unit remain visible:

```bash
test -f /opt/meshmind-ai/systemd.service
sudo ln -sfn /opt/meshmind-ai/systemd.service /etc/systemd/system/meshmind-ai.service
sudo systemctl daemon-reload
sudo systemctl cat meshmind-ai.service
sudo systemctl enable --now meshmind-ai.service
sudo systemctl status meshmind-ai.service
```

Run `sudo systemctl daemon-reload` whenever `systemd.service` changes. The symlink
lets a repository update change systemd configuration, so review unit changes before
reloading systemd or rebooting the host. A root-owned copy provides a stronger
privilege boundary if automatic unit updates are unnecessary.

Next.js handles `SIGTERM` gracefully. The unit's 30-second stop timeout leaves room
for pending work to complete.

## Nginx

Install `nginx.conf` as an HTTP-context site configuration at
`/etc/nginx/conf.d/meshmind-ai.conf`. Replace the hostname and certificate paths
before enabling the HTTPS server block:

```bash
sudo cp /opt/meshmind-ai/nginx.conf /etc/nginx/conf.d/meshmind-ai.conf
sudoedit /etc/nginx/conf.d/meshmind-ai.conf
```

Confirm that `/etc/nginx/nginx.conf` includes `/etc/nginx/conf.d/*.conf` inside its
`http` block. Provision the certificate before enabling the HTTPS server block.

The example overwrites incoming forwarding headers before they reach the trusted
application, preserves the public host and protocol for Server Actions, supports
connection upgrades, and disables response buffering for Next.js streaming. If the
installed Nginx is older than 1.25.1, replace `http2 on;` with the legacy
`listen 443 ssl http2;` syntax.

The example assumes clients connect directly to Nginx. If another load balancer or
CDN is in front, configure Nginx's real-IP module with only that proxy's trusted CIDR
ranges before enabling `AUTH_TRUST_PROXY_HEADERS`.

Validate and reload Nginx:

```bash
sudo nginx -t
sudo nginx -T 2>&1 | grep -F '/etc/nginx/conf.d/meshmind-ai.conf'
sudo systemctl reload nginx
```

## Verify

Check the application directly before testing through Nginx:

```bash
curl --fail --show-error http://127.0.0.1:3000/
curl --fail --show-error https://app.example.com/
sudo journalctl -u meshmind-ai --since "10 minutes ago"
```

Also verify signup, login, logout, password recovery, superadmin TOTP, database writes,
session persistence, rate limiting, outbound email, TLS renewal, and PostgreSQL
restoration before accepting production traffic.

## Updates And Rollback

Push changes to `main` after the tests pass. The deployment workflow pulls the new
commit and performs the build, migration, and conditional service restart. A manual
deployment can also be started from the Actions tab with `workflow_dispatch`.

```bash
cd /opt/meshmind-ai
git log --oneline -5
sudo systemctl status meshmind-ai.service
```

This deployment updates the active checkout in place. It has no automatic application
rollback. To roll back application code, revert the bad commit on `main` and deploy
again. Database migrations are not automatically rolled back; prefer additive
migrations and perform destructive cleanup only after older application versions are
retired.

For multiple Next.js instances, use the same build and Server Action encryption key
on every instance, add a shared Next.js cache implementation, and coordinate cache
tag invalidation through Redis.
