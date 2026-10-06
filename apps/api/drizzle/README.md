# Database migrations

`0001_auth.sql` creates the account and session tables; `auth-schema.ts` describes
them with Drizzle. Run `corepack pnpm db:migrate` from the repository root.
The migration is idempotent and transaction-protected. Business-domain schemas
and migrations are still to be implemented. See `docs/web-auth.md` at the root.
