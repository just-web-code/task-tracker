# The 0.9.x migrations

These are the migrations the 0.9.x build applied. They are kept because they
are what an existing `task_tracker` database was created from, and deleting
them would make that database's history unreadable.

They are **not** applied any more. `1781605087_port_to_1_0` is the baseline:
it creates the whole schema as the 1.0 source declares it, and it carries the
`.snapshot.json` that every later `jwc migrate new` diffs against. The 0.9.x
files predate snapshots, so a `migrate new` run with them in place has nothing
to diff and re-emits the whole schema.

## Moving an existing 0.9.x database across

The 1.0 schema is the 0.9.x one **plus** every constraint and index the 0.9.x
source never declared — the primary keys, the foreign keys with
`on delete cascade`, the two `unique (task_id, …)` pairs on the join tables,
and eight indexes. `ProjectService.deleteDeep` in the 0.9.x source walked
boards → columns → project by hand and said why: "no FK on-delete-cascade
declared". They are declared now, so the database does it.

On a database that already has the tables:

    jwc migrate verify .    # lists exactly what is missing, by name

Add those, then record the baseline as applied without running it:

    INSERT INTO _jwc_migrations (name, checksum, applied_at)
    VALUES ('1781605087_port_to_1_0', '<sha256 of the .up.sql>', now());

On an empty database, `jwc migrate up` does the whole thing.
