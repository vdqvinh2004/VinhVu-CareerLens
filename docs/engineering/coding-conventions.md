# Coding Conventions

## Purpose and precedence

Use these conventions for application code, tests, scripts, and reviews. Follow existing patterns in the affected area unless this document defines a stricter rule.

Precedence: security and correctness, framework requirements, this document, then local style. Use ESLint, TypeScript, and tests as the enforceable source of truth.

## Scope and structure

- Keep changes focused on the requested outcome; do not refactor unrelated code.
- Prefer the existing project layout: `app/`, `components/`, `lib/`, `tests/` at the repository root.
- Use kebab-case file names (`login-form.tsx`, `rate-limit.ts`) and PascalCase React component exports.
- Keep UI primitives in `components/ui`, route-specific components beside their route, and shared browser/domain code in `lib`.
- Split a function or component when it has more than one responsibility or cannot be understood without scrolling extensively. Do not split solely to meet a line-count target.

## Naming and TypeScript

- Name values by intent: `sessionExpiry`, `isPasswordValid`, and `createAccount`; avoid unclear names such as `data`, `result`, and `flag` when more context is available.
- Use verb-noun names for functions and `is`/`has`/`can` prefixes for booleans.
- Preserve strict TypeScript. Do not introduce `any`, `@ts-ignore`, or unchecked type assertions.
- Define domain types close to their use; extract shared types only when they have more than one consumer.
- Prefer discriminated unions or explicit result types for expected outcomes. Throw errors for exceptional failures, not normal validation branches.

## Data, validation, and errors

- Validate untrusted input at boundaries: forms, imported files, localStorage, AI configuration, and external service responses. Use Zod for request/form validation.
- Normalize user-visible error messages. Never log API keys, raw CV text, or private profile data.
- Do not swallow errors. Either handle them deliberately with a documented fallback or rethrow/return a typed failure.
- Persist browser data through `lib/browser-storage.ts`. Save to localStorage before publishing updated state; storage failures must leave the previous workspace intact.

## Next.js and React

- Build a static export. Interactive routes use Client Components and browser storage; static content may render at build time.
- Do not add authentication, databases, API routes, Server Actions, environment secrets, or deployment workflows.
- AI requests go directly to the user-configured provider. Validate provider URLs, inputs, and outputs, and surface CORS/network failures.
- Use `next/link`, `next/font`, and framework APIs compatible with static export.
- Derive display state during render where possible. Use effects only to synchronize with an external system.
- Use functional state updates when the next value depends on the previous value.

## Immutability and performance

- Do not mutate props, React state, or shared module state. Create a new object or array when updating them.
- Local mutation is acceptable when its value does not escape the function and it makes the code materially simpler or faster; add a short comment only when the reason is non-obvious.
- Avoid memoization by default. Add `useMemo`, `useCallback`, dynamic imports, caching, or parallelization only when profiling, a measurable cost, or a framework boundary justifies it.
- Run independent asynchronous work concurrently with `Promise.all` when failure and ordering semantics allow it.

## Browser privacy

- Store user API keys only in localStorage. Mask key fields; never include keys in data exports.
- Explain that localStorage is readable by scripts on the origin and people with browser access.
- Send profile/CV data to the configured provider only for requested AI features.

## Tests and review

- Add or update a focused test for changed behavior, especially validation, browser persistence, imports, and failure paths.
- Name tests by observable behavior and use Arrange–Act–Assert when it makes the test easier to scan.
- Before handoff, run the relevant checks: `npm run lint`, `npx tsc --noEmit`, and the focused Vitest suite. Run `npm run build` to confirm static export.
- Review the diff for unused imports, unrelated formatting, duplicated logic, unsafe URLs, leaked API keys, and stale backend references.

## Deliberate exceptions

Document an exception in the PR or code comment when it affects security, public behavior, or a repeated pattern. Prefer a narrow exception over broadening a rule prematurely.
