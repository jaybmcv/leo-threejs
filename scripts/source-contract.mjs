// Compatibility for source-inspection fixtures, never a transformation step.
import fs from 'node:fs/promises';
import {checkV2Adapters as historicalAudit} from '../legacy/v1/scripts/v2-adapters.mjs';
export const sourceText=(file,source)=>source.replaceAll('\r\n','\n');
export const applyV2Adapters=sourceText;
export const publicPreparedAdapters=sourceText;
export async function checkV2Adapters(){return historicalAudit('legacy/v1');}
