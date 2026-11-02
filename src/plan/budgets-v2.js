// Jay's approved V2 limits. V1 producers and gates do not import this module.
export const V2_BUDGETS=Object.freeze({publicBytes:250_000_000,phoneTriangles:750_000,rawRatio:1.20,transportBytes:16*1024*1024});
export function assertPublicBudget(payload,disk=payload){for(const [name,value]of [['public download',payload],['public model disk',disk]])if(!Number.isSafeInteger(value)||value<0||value>V2_BUDGETS.publicBytes)throw Error(name+' exceeds '+V2_BUDGETS.publicBytes+' bytes: '+value);}
export function assertPhoneBudget(triangles){if(!Number.isSafeInteger(triangles)||triangles<0||triangles>V2_BUDGETS.phoneTriangles)throw Error('Phone hull exceeds '+V2_BUDGETS.phoneTriangles+' triangles: '+triangles);}
