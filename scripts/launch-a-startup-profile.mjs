import {startupServer} from './startup-server-v2.mjs';
import {measurePublicStartup} from './startup-probe-v2.mjs';
process.env.LEO_STARTUP_CANDIDATE=process.env.LEO_STARTUP_CANDIDATE||'output/launch-a/public-check';process.env.LEO_STARTUP_BASELINE='C:/Users/henri/code/leo-threejs/.qa/redesign-preview-1027b';
const site=await startupServer();try{await measurePublicStartup({url:site.origin+'/candidate/walk.html',tag:process.env.LEO_STARTUP_TAG||'launch-a-profile',directory:'output/launch-a/startup',profile:process.argv.includes('--profile'),captureTimeout:120000});}finally{site.server.close();}
