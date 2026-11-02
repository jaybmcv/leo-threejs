# Pinned layout 1 rollback

`v1/` pins the source, assets, server and scripts from a423c25 (including validated 164c57f). This is an explicit legacy implementation, not an active transform layer for layout 2. Do not edit its ship geometry.

From the repository root, set LEO_LAYOUT=1 and run the usual build/check/live commands. scripts/run-legacy.mjs creates local directory junctions to this checkout's output, dist, dist-v2 and node_modules. Those junctions are ignored; the source snapshot is portable and committed as normal files. Public layout 1 remains in dist, layout 2 in dist-v2.

Deliberate infrastructure differences from the pin: workspace-only esbuild resolution for sandboxed builds; the server entry preserves the original absolute default data locations and explicit environment paths; ignored local junctions. No v1 model producer changed. The source manifest is v1/SNAPSHOT.json; the eleven GLB identities are recorded in output/switchover.

Keep the current server state when rolling back. Aquarium retains one shared leaderboard and the original browser best key. Do not replace newer scores with an old backup. Old v1/unversioned links are decoded by v2; v2 coordinates are not converted backward by the v1 client.

The snapshot has its own .gitattributes disabling newline conversion, so committing/checking it out preserves the recorded original file bytes.
