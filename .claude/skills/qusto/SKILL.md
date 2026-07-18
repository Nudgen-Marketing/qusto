```markdown
# qusto Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns, coding conventions, and workflow automation used in the `qusto` TypeScript monorepo. You'll learn how to implement new features, expand the database schema, add API endpoints, enhance dashboard functionality, and write comprehensive tests, all following the project's established conventions and workflows.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected (React used for dashboard components)
- **File Naming:** camelCase for files (e.g., `userRepository.ts`, `getUser.ts`)
- **Import Style:** Relative imports  
  ```ts
  import { getUser } from './getUser'
  ```
- **Export Style:** Mixed (default and named exports)
  ```ts
  // Named export
  export function getUser(id: string) { ... }

  // Default export
  export default UserRepository
  ```
- **Commit Messages:** Conventional commits with prefixes like `feat` and `test`  
  Example:  
  ```
  feat: add user repository for account management
  test: add tests for user repository
  ```

## Workflows

### Feature Implementation with Tests
**Trigger:** When adding a new feature, service, or module  
**Command:** `/new-feature`

1. Create or update implementation files in `src/`  
   Example: `packages/auth/src/sessionManager.ts`
2. Create or update corresponding test files in `test/`  
   Example: `packages/auth/test/sessionManager.test.ts`
3. Update `package.json` or `tsconfig.json` if needed

---

### Database Schema and Repository Expansion
**Trigger:** When adding new database tables or changing the schema  
**Command:** `/new-table`

1. Create or update migration SQL files in `migrations/`  
   Example: `packages/database/migrations/20240601_add_sessions.sql`
2. Add or update repository files in `src/`  
   Example: `packages/database/src/sessionRepository.ts`
3. Update `schema.ts` or related `index.ts` files  
   Example: `packages/database/src/schema.ts`
4. Add or update test files for repositories  
   Example: `packages/database/test/sessionRepository.test.ts`

---

### API Endpoint Addition with Tests
**Trigger:** When exposing new API functionality  
**Command:** `/new-endpoint`

1. Create new route handler files in the appropriate API directory  
   Example: `apps/web/src/app/api/sessions/route.ts`
2. Update or create server logic files as needed  
   Example: `apps/web/src/server/sessionService.ts`
3. Add or update test files for the new endpoints  
   Example: `apps/web/test/sessions.test.ts`

---

### Dashboard Feature Development
**Trigger:** When adding or enhancing dashboard functionality  
**Command:** `/dashboard-feature`

1. Create or update React components in `src/components/dashboard/`  
   Example: `apps/web/src/components/dashboard/SessionList.tsx`
2. Add or update server-side dashboard logic in `src/server/`  
   Example: `apps/web/src/server/dashboard-sessions.ts`
3. Update or create test files for dashboard features  
   Example: `apps/web/test/dashboardSessions.test.tsx`

---

### Test Specification and Expansion
**Trigger:** When adding or improving test coverage  
**Command:** `/add-tests`

1. Create or update test files in `test/` directories for relevant packages  
   Example: `packages/auth/test/sessionManager.test.ts`
2. Update test helpers or fixtures as needed  
   Example: `packages/auth/test/helpers.ts`

## Testing Patterns

- **Framework:** [vitest](https://vitest.dev/)
- **Test File Pattern:** `*.test.ts` (or `*.test.tsx` for React components)
- **Location:**  
  - `packages/*/test/*.test.ts`  
  - `apps/*/test/*.test.ts`  
- **Example:**
  ```ts
  // packages/auth/test/sessionManager.test.ts
  import { describe, it, expect } from 'vitest'
  import { createSession } from '../src/sessionManager'

  describe('createSession', () => {
    it('should create a valid session', () => {
      const session = createSession('user123')
      expect(session.userId).toBe('user123')
    })
  })
  ```

## Commands

| Command           | Purpose                                               |
|-------------------|-------------------------------------------------------|
| /new-feature      | Start a new feature or service with tests             |
| /new-table        | Add new database tables or schema changes             |
| /new-endpoint     | Add a new API endpoint with tests                     |
| /dashboard-feature| Implement or enhance dashboard features               |
| /add-tests        | Add or expand test coverage for features or modules   |
```