---
name: feature-implementation-with-tests
description: Workflow command scaffold for feature-implementation-with-tests in qusto.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-implementation-with-tests

Use this workflow when working on **feature-implementation-with-tests** in `qusto`.

## Goal

Implements a new feature or service, including source code and corresponding tests.

## Common Files

- `packages/*/src/*.ts`
- `packages/*/test/*.test.ts`
- `apps/*/src/*.ts`
- `apps/*/test/*.test.ts`
- `package.json`
- `packages/*/package.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update implementation files in src/ (e.g., src/feature.ts)
- Create or update corresponding test files in test/ (e.g., test/feature.test.ts)
- Update package.json or tsconfig if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.