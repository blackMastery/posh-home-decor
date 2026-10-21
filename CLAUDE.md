@AGENTS.md

# Supabase database commands: read-only

You may ONLY run read-only Supabase database commands. Anything that changes a database's schema, data, migration history, or running state is reserved for the human developer alone.

Allowed (read-only):

- `supabase status`, `supabase migration list`, `supabase projects list`
- `supabase inspect db ...` reports
- `supabase db lint`, `supabase db dump` (to stdout or a local file only)
- `SELECT` queries and schema/catalog introspection (e.g. `list_tables`, `list_migrations`, `execute_sql` with a `SELECT` only)

NEVER run (human-only):

- `supabase db push`, `supabase db reset`, `supabase db pull`, `supabase db diff`
- `supabase migration up`, `supabase migration repair`, `supabase migration squash`, or `supabase migration new`
- `supabase link`, `supabase start`, `supabase stop`, `supabase seed`
- Any SQL that writes or changes anything (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, etc.), and `apply_migration`, whether via `psql`, the Supabase MCP server, or any other tool

If unsure whether a command is read-only, treat it as human-only. You may write or edit migration and SQL files, but when a write command needs to be run, stop and tell the human the exact command to run instead of running it yourself.
