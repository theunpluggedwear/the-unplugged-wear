# 0008 — Dashboard status pills use the shared Badge treatment

Status: Accepted

## Context

The dashboard needed 26px status pills without introducing a second badge size variant used only by one screen.

## Decision

The shared `Badge` primitive carries tokenized typography and padding. Dashboard-specific metrics pass through as badge content; no new size variant is added.

## Consequences

- Status pills remain visually consistent with the rest of the admin.
- The design system stays small.
- Dashboard-specific styling is limited to layout around the badge.
