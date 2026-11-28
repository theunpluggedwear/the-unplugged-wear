# 0006 — Dashboard chart uses a fixed slot pool

Status: Accepted

## Context

Dashboard range changes can add or remove bars. Remounting bar nodes breaks CSS height transitions and causes layout jumps.

## Decision

Every feed is normalized to a fixed maximum number of index-keyed slots. Empty slots render zero-height bars, blank labels and no tooltip.

## Consequences

- Range changes animate through stable DOM nodes.
- Transitions to and from zero work without remounting.
- Feeds with fewer points still keep the chart's layout rhythm.
