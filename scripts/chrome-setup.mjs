// What the scripts that launch headless Chrome take from the PC they run on: how Chrome reaches the graphics card, and
// where Playwright is installed. With neither variable set, every launch is exactly what it was.
//
// LEO_CHROME_ANGLE=vulkan: Direct3D 11 is the default, as before. Vulkan is for a Windows account that runs in the
// background with no desktop of its own (the feedback autopilot under its own account): there Chrome's Direct3D drew
// nothing in most tries, whatever its sandbox setting, and Vulkan drew every time, the ship included (trial of
// 2026-11-12).
// LEO_PLAYWRIGHT_FROM=<a package.json>: the scripts that use Playwright load it from the feedback-inbox checkout's
// build folder, which was named by its full path in Jay's own profile. Another account can't read that folder, so the
// autopilot names its own.
// jaybmcv/feedback-inbox build/place.mjs sets both for everything the autopilot starts.
const asked=process.env.LEO_CHROME_ANGLE||'';
if(asked&&asked!=='vulkan'&&asked!=='d3d11')throw new Error(`LEO_CHROME_ANGLE is "${asked}": it can be vulkan or d3d11`);
const VULKAN=['--use-angle=vulkan','--enable-features=Vulkan'];
// For a launch that named Direct3D 11.
export const ANGLE=asked==='vulkan'?VULKAN:['--use-angle=d3d11'];
// For a launch that named no backend and took Chrome's own choice: nothing, unless Vulkan is asked for.
export const ANGLE_IF_ASKED=asked==='vulkan'?VULKAN:[];
export const PLAYWRIGHT_FROM=process.env.LEO_PLAYWRIGHT_FROM||'C:/Users/henri/code/feedback-inbox-timers/build/package.json';
