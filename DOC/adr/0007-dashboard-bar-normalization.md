# 0007 — Dashboard bar heights normalize against the data maximum

Status: Accepted

## Context

The dashboard chart must keep its designed proportions for the default feed while still rendering arbitrary live feeds.

## Decision

Bar heights are normalized against the maximum value in the current feed. The divisor has a floor of 100 so the default feed keeps the Figma percentage heights exactly.

## Consequences

- Live feeds with small values remain visible and proportionally accurate.
- The default feed matches the approved design.
- A zero feed renders empty slots without division errors.
