import './check-public-attributes-v2.mjs';
import {runV2}from'./run-v2.mjs';
for(const task of ['phase6-sanity','phase6-local','phase6-contract','phase6-floor-fixture','phase6-canopy-fit','phase6-fog-fixture','phase6-visibility-fixture','phase6-directory-fixture','phase6-service-deck-fixture','phase6-live-glass-fixture','phase6-prepared','sky-tip-check'])await runV2(task);
