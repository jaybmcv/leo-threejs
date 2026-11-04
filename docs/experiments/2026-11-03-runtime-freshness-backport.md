# Runtime-only prepared-asset reuse on the design branch

The November 3 atrium boundary change required a 56-minute prepared refresh even
though all 30 geometry transport files remained byte-identical. This isolated
checkout still used an all-source fingerprint. Main already uses a dependency
graph for geometry-producing code.

This backport copies `fast-dependencies-v2.mjs` exactly from upstream `25c29a4`.
It traces the same model/authoring roots and transitive imports, includes baked
image bytes and package versions, and checks the four immutable v1 hull assets
against their existing pins. Runtime entry points and settings do not enter that
graph. It does not import the room-patch pipeline, merge main, or change geometry.

The branch's prepared artifact predates that contract. The upstream migration
table cannot authenticate this branch's design changes and checkout line endings.
`fast-prepared-design-migration.json` therefore records an exact, branch-specific
migration pinned to:

- Verified source revision: `7ddfea437bbf01454942e3b55941569f86144af6`.
- Prepared artifact: `51f2878d0e5da865c38f7622ed48f5ec07f3f373f358d39701fe9638612a18d7`.
- Legacy source hash: `aeccdcd360540f991ee64246740ad642a4071a24b71e546ab4bbb2e559136807`.
- The exact 315 dependency paths in the migrated graph.

The audit checked all 291 previously covered producer inputs against their saved
raw hashes and against normalized source at the verified revision. Of these, 279
need only a CRLF-to-LF hash pair. Eighteen newly covered files match that revision
exactly after text normalization; the four new binary input entries match its
immutable asset pins. The remaining two entries are the dependency tracer and
freshness policy themselves, recorded as explicit output-neutral policy changes.

No prepared bytes, integrity record, source provenance, layout, or raw model were
rewritten. A changed producer, new or removed dependency, different artifact,
forged source record, or incompatible later schema fails the migration. Future
prepared builds record the geometry-only identity directly; the legacy exception
is only for the artifact and source record above.

Validation: `node scripts/check-prepared-runtime-migration.mjs` passes 27 checks,
including normal `requirePreparedFresh()`, producer rejection using virtual
changed-input records, runtime-path exclusion and unchanged artifact metadata.
The tests do not temporarily edit live producer files. `git diff --check` passes.

The local build command is now:

```powershell
$env:LEO_LAYOUT='2'
npm run build:public
```

The ordinary public transport-integrity and budget checks still run separately.
No `build-fast-v2.mjs` command or release action is needed for this local runtime
work. Geometry LOD/batching imports must remain in runtime entry points; importing
them into an authoring producer correctly changes the dependency graph and
requires fresh authoring. A later merge of upstream fast-state helpers must pass
`{artifactSha256: integrity.sha256}` to the legacy compatibility call; the exact
new-schema hash comparison retains the upstream two-argument behavior.
