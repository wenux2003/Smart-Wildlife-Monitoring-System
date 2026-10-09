# Database migrations

| File | Creates |
|---|---|
| `0001_auth.sql` | `auth_users`, `auth_sessions` |
| `0002_parks_and_account_hierarchy.sql` | `parks`; `SUPER_ADMIN` role; `disabled_at`, `must_change_password`, `created_by`; park foreign key; one-Super-Admin and park-scope rules |
| `0009_analytics.sql` | Park boundaries, analysis sectors and grid cells, audited report runs and exports, and additive incident/alert indexes |

`auth-schema.ts`, `reference-schema.ts`, and `analytics-schema.ts` describe the
same tables with Drizzle. These files document the schema; application database
queries continue to use `postgres` tagged templates.

Run `corepack pnpm db:migrate` from the repository root. It applies every
`NNNN_name.sql` file in order, once each, inside one locked transaction, and
records them in `schema_migrations`. Every migration is also idempotent.

Never edit a migration after it has been applied: add a new numbered file
instead. Then run `corepack pnpm db:seed` to create parks and accounts. See
`docs/web-auth.md` and `docs/User_groups.md` at the root.
