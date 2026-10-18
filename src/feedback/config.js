// Where reports go. Both values are public: the capture service's address and the Turnstile site key (its secret
// stays with the service). With either missing, Send saves the report as a file instead. A test page may set
// window.LEO_FEEDBACK_CONFIG before the script loads to point at a local service.
export const FEEDBACK_CONFIG={
 endpoint:'https://mcv-feedback.mcv-feedback.workers.dev',
 turnstileSiteKey:'0x4AAAAAAFaMFTXXxfAd5Aqg',
 ...globalThis.LEO_FEEDBACK_CONFIG,
};
