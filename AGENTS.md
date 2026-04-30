Outline is a fast, collaborative knowledge base built for teams. It's built with React and TypeScript in both frontend and backend, uses a real-time collaboration engine, and is designed for excellent performance and user experience. The backend is a Koa server with an RPC API and uses PostgreSQL and Redis. The application can be self-hosted or used as a cloud service.

There is a web client which is fully responsive and works on mobile devices.

**Monorepo Structure:**

- **`app/`** - React web application with MobX state management
- **`server/`** - Koa API server with Sequelize ORM and background workers
- **`shared/`** - Shared TypeScript types, utilities, and editor components
- **`plugins/`** - Plugin system for extending functionality
- **`public/`** - Static assets served directly
- **Various config files** - TypeScript, Vite, Jest, Prettier, Oxlint configurations

Refer to /docs/ARCHITECTURE.md for detailed architecture documentation.

## Fork Maintenance

Fork of `outline/outline`. Remotes: `origin` → `reveever/outline`, `upstream` → `outline/outline` (read-only). Long-running custom branch: `cjk-search`. Tag convention: `v<upstream>-cjk.<n>`.

**Custom files (don't lose during rebase):**

- `plugins/search-postgres/server/PostgresSearchProvider.ts` — `preprocessCJK()` + reads from `"searchVectorCJK"` instead of `"searchVector"`.
- `server/migrations/20260429000000-cjk-tokenize-search.js` — adds `searchVectorCJK` column + GIN index, `outline_split_cjk()` helper, rewrites `documents_search_trigger()` to maintain both vectors.
- `app/editor/extensions/PasteHandler.tsx` — adds a Shift+Cmd/Ctrl+V branch right after the in-code-block branch that splits the clipboard text on newlines and dispatches a Slice of one paragraph per line, bypassing markdown / HTML parsers entirely. Cannot use `tr.insertText` here like the code-block branch does: in inline content, `\n` is not a valid text-node character and ProseMirror collapses it on the next transaction (renders OK at first, then any edit eats the line breaks).
- `app/scenes/KeyboardShortcuts.tsx` — documents the Shift+Cmd/Ctrl+V "Paste as plain text" entry at the end of the Formatting section. Upstream edits this file often; expect conflicts on every rebase, re-add the entry.
- `.github/workflows/docker.yml` — single-arch amd64, pushes to `reveever/outline` and `reveever/outline-base`.

**Things to watch:**

- 🔴 **Trigger override trap.** If an upstream migration runs `CREATE OR REPLACE FUNCTION documents_search_trigger()`, it silently overwrites our dual-vector trigger and Chinese search degrades with no error. Every upgrade: `git diff v<OLD> v<NEW> -- server/migrations/` — if anything touches the trigger / `searchVector`, add a new `<date>-restore-cjk-trigger.js` migration after the rebase, timestamped later than upstream's. Verify with `SELECT pg_get_functiondef('documents_search_trigger'::regproc)` — must assign to both vectors.
- Conflict hot zones: `PostgresSearchProvider.ts` (port `preprocessCJK` and `searchVectorCJK` to upstream's new shape; if upstream ships native CJK, `git rebase --skip` and drop the migration); `yarn.lock` (`git checkout --theirs && yarn install`); `.github/workflows/docker.yml` (`git checkout --ours` by default, diff upstream first to spot fixes worth absorbing).

**Upgrade steps:**

```bash
git fetch upstream --tags
git checkout main && git reset --hard upstream/main && git push origin main
git checkout cjk-search && git rebase v<NEW>     # resolve conflicts
yarn install && yarn tsc && yarn lint
yarn test plugins/search-postgres/server/PostgresSearchProvider.test.ts
git push origin cjk-search --force-with-lease
git tag v<NEW>-cjk.1 && git push origin v<NEW>-cjk.1   # triggers docker workflow
```

Post-deploy: confirm `searchVectorCJK` column + `documents_tsv_cjk_idx` index exist, trigger body assigns to both vectors, single-character Chinese search hits.

## Instructions

You're an expert in the following areas:

- TypeScript
- React and React Router
- MobX and MobX-React
- Node.js and Koa
- Sequelize ORM
- PostgreSQL
- Redis
- HTML, CSS and Styled Components
- Prosemirror (rich text editor)
- WebSockets and real-time collaboration

## General Guidelines

- Critical – Do not create new markdown (.md) files.
- Use early returns for readability.
- Emphasize type safety and static analysis.
- Follow consistent Prettier formatting.
- Do not replace smart quotes ("") or ('') with simple quotes ("").
- Do not add translation strings manually; they will be extracted automatically from the codebase.

## Dependencies and Upgrading

- Use yarn for all dependency management.
- After updating dependency versions, install to update lockfiles:

```bash
yarn install
```

## TypeScript Usage

- Use strict mode.
- Avoid "unknown" unless absolutely necessary.
- Never use "any".
- Prefer type definitions; avoid type assertions (as, !).
- Always use curly braces for if statements.
- Avoid # for private properties.
- Prefer interface over type for object shapes.

## Classes & Code Organization

### Class Member Order

1. Public static variables
2. Public static methods
3. Public variables
4. Public methods
5. Protected variables & methods
6. Private variables & methods

### Exports

- Exported members must appear at the top of the file.
- Always use named exports for new components & classes.
- Document ALL public/exported functions with JSDoc.

## React Usage

- Use functional components with hooks.
- Event handlers should be prefixed with "handle", like "handleClick" for onClick.
- Avoid unnecessary re-renders by using React.memo, useMemo, and useCallback appropriately.
- Use descriptive prop types with TypeScript interfaces.
- Do not import React unless it is used directly.
- Use styled-components for component styling.
- Ensure high accessibility (a11y) standards using ARIA roles and semantic HTML.

## MobX State Management

- Use MobX stores for global state management.
- Keep stores in `app/stores/`.
- Use `observable`, `action`, and `computed` decorators appropriately.
- Prefer computed values over manual calculations in render.
- Keep business logic in stores, not components.

## Database & ORM

- Use Sequelize models in `server/models/`.
- Generate migrations with Sequelize CLI:

```bash
yarn sequelize migration:create --name=add-field-to-table
```

- Run migrations with `yarn db:migrate`.
- Use transactions for multi-table operations.
- Add appropriate indexes for query performance.
- Always handle database errors gracefully.

## API Design

- RESTful endpoints under `/api/`.
- Authentication endpoints under `/auth/`.
- Use consistent error responses.
- Validate request data using the validation middleware and schemas
- Use presenters to format API responses.
- Keep API routes thin, use model methods for business logic, or commands if logic spans multiple models.

## Authentication & Authorization

- JWT tokens for authentication.
- Policies in `server/policies/` for authorization.
- Use cancan-style ability checks.
- Use authenticated middleware for protected routes.
- Always verify user permissions before data access.

## Real-time Collaboration

- WebSocket connections for real-time updates.
- Use Y.js for collaborative editing.
- Handle connection state changes gracefully.

## Documentation

- All public/exported functions & classes must have JSDoc.
- Include:
  - Description
  - @param and @return (start lowercase, end with period)
  - @throws if applicable
- Add a newline between the description and the @ block.
- Use correct punctuation.

## Testing

- Run tests with Jest:

```bash
# Run a specific test file (preferred)
yarn test path/to/test.spec.ts

# Run every test (avoid)
yarn test

# Run test suites (avoid)
yarn test:app      # All frontend tests
yarn test:server   # All backend tests
yarn test:shared   # All shared code tests
```

- Write unit tests for utilities and business logic in a collocated .test.ts file.
- Do not create new test directories
- Mock external dependencies appropriately in **mocks** folder.
- Aim for high code coverage but focus on critical paths.

## Code Quality

- Use Oxlint for linting: `yarn lint`
- Format code with Prettier: `yarn format`
- Check types with TypeScript: `yarn tsc`
- Pre-commit hooks run automatically via Husky.
- Fix linting issues before committing.

## Error Handling

- Use custom error classes in `server/errors.ts`.
- Always catch and handle errors appropriately.
- Log errors with appropriate context.
- Return user-friendly error messages.
- Never expose sensitive information in errors.

## Performance

- Use React.memo for expensive components.
- Implement pagination for large lists.
- Use database indexes effectively.
- Cache expensive computations.
- Monitor performance with appropriate tools.
- Lazy load routes and components where appropriate.

## Security

- Sanitize all user input.
- Always use `sanitizeUrl()` when setting `href` or `src` from user-controlled data in ProseMirror `toDOM` methods, regardless of whether it is imported via an alias or a relative path. Unlike React components, `toDOM` writes raw DOM and does not sanitize attribute values.
- Use CSRF protection.
- Use rateLimiter middleware for sensitive endpoints.
- Follow OWASP guidelines.
- Never store sensitive data in plain text.
- Use environment variables for secrets.
