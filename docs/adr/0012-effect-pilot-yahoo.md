---
status: Superseded by ADR-013
date: 2026-11-24
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-012: Pilot Effect v4 inside the Yahoo source, behind its existing promise interface

- **Accepted:** 2026-11-24, in #168.
- **Superseded:** 2026-11-26 by [ADR-013](0013-effect-in-every-source.md): Effect extends to the FMP and Eulerpool sources.
- **Component:** `src/lib/server/yahoo.ts`, `src/lib/server/yahoo-parse.ts`, `package.json`, a new boundary test

## Context

[Effect](https://effect.website) is a TypeScript library for programs that do I/O: failures as typed values instead of
exceptions, declared timeouts and retries, and `Schema` for checking data at the boundary. Version 4 is stable: `4.0.0`
was published on 2026-10-01 and `4.1.5` is npm's `latest` (2026-11-20), with `@effect/vitest` and the platform packages
released in step. It has no peer dependencies and no `engines` limit, so it fits Node 24 and TypeScript 6.0.

The app already keeps I/O thin and the rest pure (CLAUDE.md, ADR-005, ADR-007). Most of `src/lib` is data in, data out,
and would gain nothing from Effect. The question is whether it pays at the edges, the source modules. Yahoo is the
smallest of them (`yahoo.ts`, 184 lines, and `yahoo-parse.ts`, 140) and the one with the clearest gaps:

- **No timeout.** yahoo-finance2 leaves its queue timeout unset (it is commented out in its defaults) and `yahoo.ts`
  sets none, so a hung Yahoo request waits until the serverless function is killed. FMP and Eulerpool stop at
  `FETCH_TIMEOUT_MS` (10 s, `http.ts`).
- **Errors are sorted after the fact.** `tolerant` catches everything, then sorts by the error's class and two regular
  expressions over its text (`NOT_FOUND`, `RATE_LIMITED`). Whether every kind is handled is not something the compiler
  checks.
- **Parsing is hand-written** over `unknown` with `coerce.ts`. It is careful and fully tested, which makes it a fair
  baseline to compare `Schema` against.
- **No key and no other source imports it** (`source-boundary.test.ts`), so the pilot touches no secret and no shared
  code. The library is already labelled as one that "can break without notice" (`docs/financials.md`).

## Decision

1. **Effect inside `yahoo.ts` and `yahoo-parse.ts` only, for a pilot.** `effect` is added as a runtime dependency,
   pinned exactly like `yahoo-finance2` (`4.1.5`). No other file may import it, and a test like
   `source-boundary.test.ts` enforces that. It never reaches the browser bundle: these modules are server-only and
   already load yahoo-finance2 with a dynamic import.
2. **The module's interface does not change.** `fetchYahooPrices`, `fetchYahooProfile`, `fetchYahooNews` and
   `fetchYahooStatement` keep their promise signatures and their `client?: YahooClient` argument. Each builds an
   Effect and runs it with `Effect.runPromise` at its own boundary. `financial-sources.ts`, `cache.ts`, the routes, the
   TypeDoc reference and `SourceError` are untouched. **The existing tests are the contract:** `yahoo.test.ts`,
   `yahoo-parse.test.ts` and `financials-yahoo-cache.test.ts` must pass without changes to what they assert.
3. **Inside, the pilot uses three things and nothing more:**
   - **Typed errors.** Each library call becomes `Effect.tryPromise`, which sorts its failure once into tagged errors
     (`NotFound`, `RateLimited`, `Unavailable`, `Unexpected`). The empty result for an unknown symbol is a
     `catchTag("NotFound", …)`, and the boundary maps every remaining tag to the same fixed `SourceError` as today, so
     the rule "never show Yahoo's error text" is checked by the types. `NOT_FOUND` keeps its wording and its date.
   - **A timeout**, `FETCH_TIMEOUT_MS` per library call, as for the other sources. A timeout is `Unavailable`. **No
     retry:** the cache already keeps a failure for a minute (`FAILURE_MS`), and a retry against a rate limit makes it
     worse.
   - **`Schema` for one parser,** `parseYahooPrices` (the chart's quotes), so that the two styles can be compared on the
     same response. The other parsers stay hand-written during the pilot.
4. **Not in the pilot:** services and layers (the injectable `client` already does that job), Effect's logger, tracing,
   `Config` and `Redacted` (Yahoo has no key), Effect's `Cache` (the shared one serves all three sources), and
   `@effect/vitest` (the tests call the promise interface).
5. **Judged on these, then decided in a follow-up ADR:**
   - the existing tests pass unchanged, with new tests for the timeout and each error tag;
   - `npm run check`, `npm run lint` (with its 40-statement cap), `npm run docs` and the coverage floor pass with no new
     exceptions;
   - the size of the server function, and its cold start on a preview deployment, before and after;
   - the lines of `yahoo.ts` and `yahoo-parse.ts`, and whether the `Schema` parser is shorter and as strict as the
     hand-written one (the same inputs rejected);
   - whether the maintainer finds the Effect code easier to change than the code it replaced.

   The follow-up either extends Effect to FMP and Eulerpool (and then to their shared code), or removes it. If it is
   removed, the timeout stays, in plain TypeScript.

## Alternatives ruled out

- **Adopt Effect across the app.** Most of the code is pure functions over data; Effect would add ceremony there and
  nothing else. In components it would add to the client bundle, which Lighthouse measures at every release.
- **Pilot on FMP.** It has a key, its own fetch with `readCapped`, more endpoints and more callers. A pilot there touches
  the secret rules and more code before anything has been learned.
- **Only close the gaps in plain TypeScript** (an `AbortSignal` or `Promise.race` timeout, a typed result union). That is
  the cheapest fix for the timeout and stays the fallback, but it does not answer the question this ADR asks: whether
  Effect is worth adopting at the edges.
- **zod or valibot for the parsing only.** That would test validation alone, not typed errors and timeouts, and add a
  library that Effect's `Schema` would make redundant.
- **Effect v3.** v4 has been `latest` since 2026-10-01; starting on v3 would mean a migration later.

## Consequences

- A seventh runtime dependency, server-only, with Dependabot updates to review. Its majors are deliberate PRs, like
  yahoo-finance2's.
- For as long as the pilot lasts, the source modules are written in two styles. CLAUDE.md gains one line: Effect is
  allowed only in the Yahoo modules, pending the follow-up ADR.
- Yahoo requests stop after 10 s instead of hanging until the function's limit. Visitors get "Yahoo Finance is
  unavailable" sooner, and the cache keeps that failure for a minute as it does now.
- Most documentation and answers online are still for v3. Write v4 code against its own reference.
- Its theme in `ADR_THEMES` is `Code`.
