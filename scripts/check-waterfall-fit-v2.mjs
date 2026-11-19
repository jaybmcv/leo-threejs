import{assertWaterfallPlacement}from'./lounge-falls-placement.mjs';
import{runV2}from'./run-v2.mjs';assertWaterfallPlacement();process.env.LEO_REQUIRE_WATERFALL_FIT='1';await runV2('waterfall-target');
