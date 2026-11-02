// Resume the normal check sequence at its failed Node GLB audit; all preceding checks passed in normal-check-retry.log.
import {runV2} from './run-v2.mjs';await runV2('check');await import('./check-startup-assets-v2.mjs');await (await import('./validation-idle-v2.mjs')).waitForValidationIdle();await import('./check-startup-v2.mjs');process.exit(process.exitCode||0);
