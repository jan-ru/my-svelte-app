---
status: Accepted
date: 2026-11-25
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-013: Extend Effect to the FMP and Eulerpool sources, behind their promise interfaces

- **Accepted:** 2026-11-26, in #173. Supersedes [ADR-012](0012-effect-pilot-yahoo.md).
- **Component:** `src/lib/server/fmp.ts`, `fmp-info.ts`, `eulerpool.ts`, `eulerpool-parse.ts`, `http.ts`, the Yahoo
  modules of the pilot, `effect-boundary.test.ts`

## Context

ADR-012 piloted Effect v4 inside the Yahoo source (#171) and asked for a follow-up ADR that extends it to FMP and
Eulerpool or removes it. This is that ADR. The pilot was judged on five criteria:

| Criterion | Result |
|---|---|
| The existing tests pass unchanged, with new tests for the timeout and each error tag | Met. The three contract files are unchanged; `yahoo-effect.test.ts` covers the timeout of each fetcher and each failure kind. |
| `check`, `lint` (40-statement cap), `docs` and the coverage floor pass with no new exceptions | Met. |
| The size of the server function, and its cold start on a preview | 13,732 → 17,444 KiB (+27%), of which `effect` is 3,708 KiB. Loading the five subpaths takes about 102 ms cold, locally on Node 24, against 37 ms for yahoo-finance2. The `effect` index took 175 ms and 6.5 MiB, so the code imports by subpath. **The cold start on a preview is not measured**: `/financials` needs the login. |
| The lines of `yahoo.ts` and `yahoo-parse.ts`; whether the `Schema` parser is shorter and as strict | 324 → 397 lines (+23%). The price parser grew from 11 to 34 lines. It is as strict as the hand-written one, but only after a fix: the first version trimmed date strings, which accepted `' 2026-10-23T08:00:00Z '` and read a padded plain date in another time zone. `yahoo-prices-schema.test.ts`, which compares the two parsers, found it. |
| Whether the maintainer finds the Effect code easier to change | **Replaced, see below.** |

**The last criterion does not fit how this repository is maintained.** A coding agent writes and changes the code, and
the maintainer reviews and approves each pull request. "Easier to change" has no one to answer it. What matters instead
is how many of an agent's mistakes are caught before they reach review, and how early.

**An experiment, 2026-11-25.** Ten mistakes an agent can plausibly make were seeded, one at a time, into the Yahoo
source in both forms: plain TypeScript (`main` at e9a3d9c, before the pilot) and Effect (after #171). Eight are the
same slip in both forms; two exist only in the Effect form. Each mutant ran through `tsc`, ESLint on `yahoo.ts`, and the
three contract test files. The table gives what caught it first. A catch is *incidental* when it came from a side
effect, such as a helper left unused, rather than from a check on the mistake itself: an agent that also deletes the
helper loses it.

| # | Mistake | Plain TypeScript | Effect |
|---|---|---|---|
| M1 | Pass the raw library error on | lint, incidental (`mapError` unused) | **compiler** (TS2322) |
| M2 | Drop "an unknown symbol is an empty answer" | lint, incidental (`isNotFound` unused) | **compiler** (TS2345) |
| M3 | Forget the rate-limit case | lint, incidental (`RATE_LIMITED` unused) | **compiler** (TS2366) |
| M4 | Put the error's text in the log `detail` | tests | tests |
| M5 | Forget to wait for a call (`await` or `yield*`) | **lint** (`return-await`) | tests |
| M6 | Swallow every failure as an empty answer | lint, incidental (`mapError` unused) | lint, incidental (`toSourceError` unused) |
| M7 | The wrong empty value for prices | **compiler** (TS2322) | **compiler** (TS2322) |
| M8 | A failed name lookup fails the news | lint, incidental (`no-useless-assignment`) | **compiler** (TS2322) |
| M9 | A parser called outside `Effect.try` (Effect only) | — | **nothing** |
| M10 | Drop the timeout (Effect only) | — (had none) | `yahoo-effect.test.ts` only |

- **The contract tests caught all eight paired mistakes in both forms.** Neither form leans on the compiler for safety.
- **A check aimed at the mistake caught it before the tests** in two of eight in plain TypeScript (M5, M7) and in five
  of eight with Effect (M1, M2, M3, M7, M8). The three that moved to the compiler are the error-handling mistakes: the
  failure kinds are part of each function's type, so a kind that is not handled, or a raw error passed on, does not
  compile.
- **Effect adds one mistake that nothing catches (M9).** An error thrown inside an Effect body, outside `Effect.try`,
  reaches the caller as it is: a `TypeError` from a parser bug keeps its text, which can carry a URL. The plain form
  turned every throw into "unavailable". Today's code always uses `Effect.try`, so the risk is in later changes.
- **No form catches M4 at compile time.** `detail` is a string either way; only the test of what `detail` holds does.

For agent-maintained code this is the deciding point. A compiler error is the earliest and cheapest feedback an agent
gets. It also holds where a test is missing, and it does not depend on the agent's diligence.

**Since the pilot, the FMP and Eulerpool fetch steps are shared** in `http.ts`, in plain TypeScript (#172):
`fetchWithTimeout`, `readBody` and `statusError`. So the removal of duplicated code is not counted as a gain from
Effect; only the typed failures are.

## Decision

1. **Effect is allowed in the source modules:** `yahoo.ts`, `yahoo-parse.ts`, `fmp.ts`, `fmp-info.ts`, `eulerpool.ts`,
   `eulerpool-parse.ts` and the shared `http.ts`. No other file may import it. `effect-boundary.test.ts` lists each
   file as it moves, and still asserts that every listed file matches its scan. `effect` stays pinned exactly.
2. **The interfaces do not change.** Every exported fetcher keeps its promise signature and its injectable `fetchFn` or
   `client` argument, and runs its Effect with `Effect.runPromise` at its own boundary. `financial-sources.ts`,
   `cache.ts`, `financials.ts`, `valuation.ts`, `insight.ts`, the routes and `SourceError` never see an Effect. **The
   existing tests of each module are its contract** and must pass without changes to what they assert. Their messages
   stay word for word.
3. **One set of failures and one boundary, in `http.ts`.** The tagged failures `NotFound`, `Config`, `Plan`,
   `RateLimited`, `Unavailable` and `Unexpected` carry only a `detail` of class name and status, never upstream text.
   `fetchWithTimeout`, `readBody` and `statusError` become Effects that fail with them, and a single boundary maps them
   to `SourceError`, given the source's name. What is particular to a source stays in it: FMP's key redaction and its
   `Error Message` body, Eulerpool's 404 as no data, Yahoo's `NOT_FOUND` wording.
4. **Rules from the pilot, for every source module:**
   - **Everything that can throw** inside an Effect body (library calls, `JSON.parse`, parsers) **goes through
     `Effect.try` or `Effect.tryPromise`.** Each source gets a test that a parser bug (a `TypeError` carrying a URL)
     reaches the caller as "unavailable" without its text, which catches M9.
   - **Each source keeps a test that `detail` holds no upstream text**, because the compiler cannot check it (M4).
   - **Import by subpath** (`effect/Effect`, `effect/Schema`), never the `effect` index.
   - **`Schema` only where it replaces a hand-written parser**, and only with a test that runs the old parser as a
     reference over the same inputs, as `yahoo-prices-schema.test.ts` does.
   - **Write against the installed version's type definitions** (`node_modules/effect/dist/*.d.ts`). v4 is newer than
     most models' training data, and much of what is online is for v3.
   - **Not used:** retries, layers, Effect's logger, `Config`, `Redacted`, its `Cache` and `@effect/vitest`, as in
     ADR-012. A rule here changes only through a new ADR.
5. **In two pull requests.** FMP first (`http.ts`, `fmp.ts`, `fmp-info.ts`), then Eulerpool. Each one reruns the
   experiment above on its module and reports the paired results, and gives the server function's size and the cold
   import before and after.
6. **The cold start is measured once on a preview,** by the maintainer with a login, before the Eulerpool pull request
   is merged, and recorded in it. If it is worse than the local figure suggests, bundling `effect` into the server chunk
   (`ssr.noExternal`) is the first thing to try. That is a build change outside these files, and gets its own pull
   request.

## Alternatives ruled out

- **Remove Effect, keep the timeout in plain TypeScript.** ADR-012's fallback. It costs nothing and keeps the function
  smaller. But it gives up the result that decided this ADR: the error-handling mistakes moved from incidental lint and
  the tests to the compiler.
- **A hand-written result type** (a discriminated union of failures, with an exhaustive `switch`) in plain TypeScript. It
  would catch M3, and with care M1 and M2. But every timeout, interruption and conversion from a thrown error would be
  plumbing of the repository's own, written and kept up by agents, where Effect provides tested versions.
- **Keep Effect in Yahoo only.** Two styles for three sources indefinitely. And the two sources with a key, and so the
  secret rules, are the ones without typed failures.
- **Effect across the app.** As in ADR-012: most of the code is pure functions over data, and in components Effect would
  reach the browser bundle.
- **Bundle `effect` now.** It may shrink the function, but nothing has been measured on Vercel yet. Decision 6 makes it
  the first lever once the cold start is known.

## Consequences

- **The two sources with a key gain typed failures.** Leaking FMP's or Eulerpool's error text then needs a type change,
  not just a slip.
- **More lines.** The pilot grew Yahoo's modules by 23%, and FMP and Eulerpool will grow too. `effect` is already loaded
  for the `/financials` pages, so they add little load time.
- **Until both pull requests have merged, the sources are in two styles.**
- **On acceptance:**
  - ADR-012's status becomes `Superseded by ADR-013`;
  - `ADR_THEMES` swaps ADR-012 for ADR-013, theme `Code`;
  - the Effect line in CLAUDE.md and AGENTS.md is rewritten to point here.
- **The boundary test's allow list grows** with each pull request. It lists only the files that have moved.
- Dependabot updates of `effect` are reviewed like yahoo-finance2's, and a major is a deliberate pull request.

## Clarification, 2026-11-26: the cold start, measured (decision 6)

The work landed in #174 (FMP) and #176 (Eulerpool, with Yahoo moved onto the shared failures). #176 merged before this
was recorded. The maintainer measured the cold start on #176's preview (`nodejs24.x`, `iad1`), logged in, after 15
minutes idle. The figures are from Vercel's invocation details:

| Request | Start | Cold start | Duration | Active CPU |
|---|---|---|---|---|
| `/companies/__data.json` (public, no Effect) | Cold | 306 ms | 1.11 s | 190 ms |
| `/financials/valuation/__data.json` | Cold | 357 ms | 1.53 s | 450 ms |
| `/financials/__data.json` | Cold | 377 ms | 1.23 s | 310 ms |
| `/financials/__data.json`, 10 s later | Hot | — | 709 ms | 210 ms |

- **The cold start of the `/financials` pages is 50–70 ms above that of a public page without Effect.** That is in line
  with the local cost of loading `effect`, about 102 ms, of which part falls outside the measured start. The durations
  include the calls to the data sources, so they are not compared.
- **So bundling `effect` (`ssr.noExternal`) is not needed now.** It stays the first lever if a later measurement shows
  a worse start.
