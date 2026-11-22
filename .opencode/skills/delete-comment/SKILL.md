---
name: delete-comment
description: Audit, categorize and remove source comments with a ratchet, ADRs and issue tracking.
---

# Delete Comment

Use this skill when cleaning comments from this repository.

## Scope

Audit tracked source files only:

```text
tuw-admin/src
tuw-website/src
packages/heart/src
db/migrate
scripts
```

Extensions:

```text
.ts .tsx .mjs .cjs .js .sql .css
```

## Inventory

Run:

```bash
pnpm comments:audit
```

This writes:

```text
state-for-agents/admin/comment-audit.csv
```

Each row has:

```text
path,line,text,category,action,issue_or_adr
```

## Categorize every comment

Use exactly one category:

- `Tautology`: repeats what the code already shows.
- `Stale`: refers to code, plans or behaviour that no longer exists.
- `Excuse`: justifies a hack, demo shortcut or deferred implementation.
- `Decision Record`: documents a non-obvious decision with consequences.

## Actions

- `Tautology` or `Stale`: delete the comment.
- `Excuse`: delete the comment and file a tracker issue or GitHub issue for the underlying hack. Put the issue ID in `issue_or_adr`.
- `Decision Record`: move it to `DOC/adr/NNNN-title.md`, delete the code comment, and add the ADR ID to `issue_or_adr`.

Do not leave replacement comments pointing to ADRs or issues.

## Ratchet

After each batch:

```bash
pnpm comments:update
pnpm lint:comments
```

The ratchet file:

```text
comment-ratchet.json
```

must never increase. If it increases, the change is rejected.

## Verification

Always run:

```bash
pnpm typecheck
pnpm test
pnpm --dir tuw-admin build
pnpm lint:comments
```

## Commit

Commit exact paths only. Never use `git add .`.

Include:

- changed source files
- `comment-audit.csv`
- `comment-ratchet.json`
- new ADR files
- tracker updates
