// The measured long view keeps public atrium detail while bounding enclosed interiors.
export const ATRIUM_VIEW = {
 far:450,
 fogNear:120,
 fogFar:1100,
 fullHeight:true,
 roomReach:90,
};

export function isAtriumPublicOwner(id,room){
 return !!(room?.phase6Atrium||room?.showFromBelow||room?.publicFront||room?.kind==='garden'
  ||/^nose-commons-/.test(id)||/^neighborhood-\d+-(dining|cafe)$/.test(id)
  ||['d16-new-1','d16-new-2','d16-voyage-forum-bow','observation-lounge'].includes(id)
  ||/^circulation-(?:[6-9]|1\d|20)$/.test(id));
}
