// features/keys/copy.ts
//
// Freemium UX copy. The disclaimer string is CONTRACT-EXACT (docs/09 Appendix C / Free
// tier) and is shown ONLY to keyless users — it is asserted verbatim by a test so any drift
// fails CI. Centralized here so the banner and any future surface share one source.

/** EXACT contract copy — shown only to keyless users. Do not paraphrase. */
export const FREE_TIER_DISCLAIMER =
  "Demo mode runs on Google's free Gemini tier — please avoid uploading sensitive documents (data may be used per Google's policy). Add your own API key for private, unlimited use.";

/** Title + body for the BYOK upsell dialog raised on a free_tier_exhausted error. */
export const FREE_TIER_EXHAUSTED_TITLE = "You've reached the free-tier limit";
export const FREE_TIER_EXHAUSTED_BODY =
  "The shared free Gemini tier is exhausted for now. Add your own API key for private, unlimited use — your key is stored encrypted and used only for your requests.";
