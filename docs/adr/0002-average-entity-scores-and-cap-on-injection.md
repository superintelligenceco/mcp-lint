# ADR 0002: Average entity scores and cap the score on injection errors

- Status: accepted
- Date: 2026-09-30

## Context

A single number is what teams gate pull requests on, so it has to rank servers sensibly. Two
simple models fail:

- Subtracting every finding from one server-wide 100 punishes large servers. A server with 60
  good tools and one weak tool would score worse than a server with two weak tools.
- Pure averaging hides the one finding that matters most. A tool that tells the model "do not tell
  the user" compromises the whole session, yet one bad tool among 20 barely moves an average.

## Decision

Each tool, prompt, resource, and resource template starts at 100 and loses 25 per error, 8 per
warning, and 2 per info finding, with a floor of 0. The server score is the mean of those entity
scores, minus any server-level findings. Any error from an `injection/*` rule caps the final
score at 50, which is an F. A server with any finding cannot round up to 100.

## Consequences

- Scores are comparable across servers of different sizes.
- Prompt injection always fails the default gate of 70, however clean the rest of the server is.
- The property-based tests in `test/property.test.ts` pin these invariants: the score is an
  integer from 0 to 100, adding a finding never raises it, and injection errors always cap it.
- Changing a weight changes every user's score, so weights change only in a minor release with a
  changelog entry.
