# Database migrations

| File | Creates |
|---|---|
| `0001_auth.sql` | `auth_users`, `auth_sessions` |
| `0002_parks_and_account_hierarchy.sql` | `parks`; `SUPER_ADMIN` role; `disabled_at`, `must_change_password`, `created_by`; park foreign key; one-Super-Admin and park-scope rules |

`auth-schema.ts` and `reference-schema.ts` describe the same tables with Drizzle.

Run `corepack pnpm db:migrate` from the repository root. It applies every
`NNNN_name.sql` file in order, once each, inside one locked transaction, and
records them in `schema_migrations`. Every migration is also idempotent.

Never edit a migration after it has been applied: add a new numbered file
instead. Then run `corepack pnpm db:seed` to create parks and accounts. See
`docs/web-auth.md` and `docs/User_groups.md` at the root.
