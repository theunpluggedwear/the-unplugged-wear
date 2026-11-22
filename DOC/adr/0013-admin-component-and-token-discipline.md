# 0013 — Admin component and token discipline

Status: Accepted

## Context

Earlier admin screens introduced raw controls, hard-coded colours and one-off styling. The V2 design system already defines semantic tokens and reusable primitives.

## Decision

Admin UI uses `tuw-admin/src/components/ui` primitives and `--tuw-*` tokens. New one-off components are avoided unless an existing primitive cannot express the interaction.

## Consequences

- Theme changes propagate from tokens instead of per-screen edits.
- Focus states and accessibility live in shared components.
- Raw `<input>`, `<select>`, `<textarea>`, `<table>` and hard-coded brand colours are rejected in reviews.
