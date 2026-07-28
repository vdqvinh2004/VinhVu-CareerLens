# Coding Conventions

## Purpose and precedence

Use these conventions for application code, tests, scripts, and reviews. Follow existing patterns in the affected area unless this document defines a stricter rule.

Precedence: security and correctness, framework requirements, this document, then local style. Use ESLint, TypeScript, and tests as the enforceable source of truth.

## Scope and structure

- Keep changes focused on the requested outcome; do not refactor unrelated code.
- Prefer the existing project layout: `app/`, `components/`, `lib/`, `tests/`, and `scripts/` at the repository root.
- Use kebab-case file names (`login-form.tsx`, `rate-limit.ts`) and PascalCase React component exports.
- Keep UI primitives in `components/ui`, route-specific components beside their route, and shared server/domain code in `lib`.
- Split a function or component when it has more than one responsibility or cannot be understood without scrolling extensively. Do not split solely to meet a line-count target.

## Naming and TypeScript

- Name values by intent: `sessionExpiry`, `isPasswordValid`, and `createAccount`; avoid unclear names such as `data`, `result`, and `flag` when more context is available.
- Use verb-noun names for functions and `is`/`has`/`can` prefixes for booleans.
- Preserve strict TypeScript. Do not introduce `any`, `@ts-ignore`, or unchecked type assertions.
- Define domain types close to their use; extract shared types only when they have more than one consumer.
- Prefer discriminated unions or explicit result types for expected outcomes. Throw errors for exceptional failures, not normal validation branches.

## Data, validation, and errors

- Validate untrusted input at boundaries: Server Actions, Route Handlers, environment configuration, cookies, and external service responses. Use Zod for request/form validation.
- Normalize user-visible error messages. Log actionable server-side context without exposing secrets, tokens, passwords, email reset data, or raw request bodies.
- Do not swallow errors. Either handle them deliberately with a documented fallback or rethrow/return a typed failure.
- Fetch only the database columns required by the use case. Keep PostgreSQL schema changes and generated Drizzle migrations together.
- Use Redis only for ephemeral data such as sessions, rate limits, challenges, and replay prevention. PostgreSQL remains authoritative for persistent account and authorization data.

## Next.js and React

- Default to Server Components. Add `"use client"` only to the smallest interactive component that needs browser APIs, state, effects, or event handlers.
- Keep database, Redis, email, cryptography, and secrets in server-only modules. Never import them into Client Components.
- Treat every Server Action and Route Handler as a public boundary: authenticate the actor, authorize the action, validate input, and return only data the caller may receive.
- Use `next/link`, `next/font`, and framework APIs where applicable. Avoid client-side fetches for data that can be rendered securely on the server.
- Derive display state during render where possible. Use effects only to synchronize with an external system.
- Use functional state updates when the next value depends on the previous value.

## Immutability and performance

- Do not mutate props, React state, or shared module state. Create a new object or array when updating them.
- Local mutation is acceptable when its value does not escape the function and it makes the code materially simpler or faster; add a short comment only when the reason is non-obvious.
- Avoid memoization by default. Add `useMemo`, `useCallback`, dynamic imports, caching, or parallelization only when profiling, a measurable cost, or a framework boundary justifies it.
- Run independent asynchronous work concurrently with `Promise.all` when failure and ordering semantics allow it.

## Authentication and authorization

- Use the existing authentication, session, and RBAC helpers; do not reimplement permission checks in UI code.
- Enforce authorization in the server-side data-access/action layer, not only through hidden UI controls.
- Invalidate or rotate sessions through the established helpers after password, role, or account-status changes.
- Do not log credentials, password hashes, session identifiers, TOTP secrets, reset tokens, or full authorization headers.

## Tests and review

- Add or update a focused test for changed behavior, especially validation, authorization, session, rate-limit, and failure paths.
- Name tests by observable behavior and use Arrange–Act–Assert when it makes the test easier to scan.
- Before handoff, run the relevant checks: `npm run lint`, `npx tsc --noEmit`, and the focused Vitest suite. Run `npm run test:integration` for Redis-dependent changes.
- Review the diff for unused imports, unrelated formatting, duplicated logic, missing authorization, and accidental client exposure of server code.

## Deliberate exceptions

Document an exception in the PR or code comment when it affects security, public behavior, or a repeated pattern. Prefer a narrow exception over broadening a rule prematurely.
