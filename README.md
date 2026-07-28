This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

The host-run application can connect with these default URLs:

```text
postgresql://meshmind:password@localhost:5432/meshmind
redis://localhost:6379
```

The database name, username, password, and published ports can be overridden with
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and
`REDIS_PORT`.

Apply the database migrations before starting the application:

```bash
npm run db:migrate
```

Configure `DATABASE_URL`, `REDIS_URL`, the authentication keys, and SMTP values
listed in `.env.example`. Authentication keys must be independent random values.
For local development they can be generated with `openssl rand -base64 32`.

Then run the development server on the host:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database

The lazy PostgreSQL connection is returned by `getDb()` from `lib/db/index.ts`. The schema
and generated SQL migrations are managed with Drizzle.

```bash
npm run db:generate # Generate a migration after changing the schema
npm run db:migrate  # Apply pending migrations
npm run db:studio   # Open Drizzle Studio
```

## Email

SMTP configuration is listed in `.env.example`. The email service validates it
when an email is first sent, so SMTP credentials are not required during builds.

Use the service from server-side code only:

```ts
import { sendEmail } from "@/lib/email";

await sendEmail({
  to: "recipient@example.com",
  subject: "Hello",
  text: "Hello from MeshMind.",
  html: "<p>Hello from MeshMind.</p>",
});
```

`verifyEmailConnection()` can be used to check the SMTP connection without
sending a message.

## Redis

Redis stores opaque sessions, authentication rate limits, short-lived MFA
challenges, and replay-prevention state. PostgreSQL remains authoritative for
accounts, password hashes, account status, password reset tokens, roles, and
permissions.

The application uses one lazy `node-redis` client per Node.js process. Redis
errors fail authentication closed rather than falling back to process-local
state. Production should use a dedicated managed Redis primary with TLS, ACL
credentials, persistence, high availability, and a `noeviction` policy. Supply
the provider URL through `REDIS_URL` using the `rediss://` scheme.

Set `AUTH_TRUST_PROXY_HEADERS=true` only when the application is behind a trusted
ingress that removes client-supplied forwarding headers. When it is false, IP
rate-limit dimensions are deliberately disabled instead of putting every user in
one global bucket; account and challenge limits remain active.

Run Redis integration tests against the local Compose service:

```bash
npm run test:integration
```

## CareerLens AI service

The server-only CareerLens AI service validates and sanitizes profile and labor-market data,
applies the guidance system prompt, calls the configured FPT Cloud model, and validates the
model's JSON response before returning it. If `FPT_AI_API_KEY` is empty, it returns a
deterministic local POC response instead.

```ts
import { generateCareerGuidance } from "@/lib/careerlens";

const guidance = await generateCareerGuidance({
  student_profile: profile,
  labor_market_signals: marketSignals,
  user_request: request,
});
```

The exported `CAREERLENS_SYSTEM_PROMPT` is the runtime prompt derived from
`docs/ai/careerlens-ai-system-rule.html`. Inputs and outputs use that document's snake-case
JSON contract. Unknown profile fields are stripped before the LLM call, so sensitive identity
fields such as gender, hometown, ethnicity, and religion are not sent to the provider.

Authenticated students can use the integrated form at `/dashboard/careerlens`. The route builds
the validated AI input from the submitted profile and the local market seed, then displays three
explainable paths with skill gaps, roadmap modules, and related sample jobs.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the external PostgreSQL/Redis, systemd,
and Nginx production setup.

## Authentication

Public signup always assigns the protected `USER` role and signs the new account
in. Passwords use Argon2id. Sessions expire after 30 minutes of inactivity and
after seven days absolutely. Password changes and role changes increment the
account session version so old Redis sessions are rejected immediately.

The built-in superadmin is a virtual identity and never has a PostgreSQL account
or role row. Generate its password hash and TOTP secret without persisting them:

```bash
npm run auth:provision-superadmin -- meshmind-operations
```

Store the generated identifier, password hash, and TOTP secret in the deployment
secret manager. The generated password is the login credential and should not be
placed in application environment variables. Superadmin access is available at
`/superadmin/login`, requires TOTP, has a shorter session, and has all permissions
through the server-side actor type.

RBAC permissions are enforced in the data-access layer and again by every
privileged Server Action. The initial migration seeds only the `USER` role with
`dashboard.access`; superadmin-protected backend actions can create future roles,
assign existing permissions, and assign roles to accounts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
