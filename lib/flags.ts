import { env } from "@/lib/env";

/**
 * Feature flags gate forward-compatible surfaces so unfinished backend phases
 * ship dark. Each flag is consumed by exactly one later milestone:
 *
 *   streaming        -> M2 (seam); M9 flips ON by default (backend P6 SSE is live)
 *   auth             -> M6 (backend P3 JWT auth + login/register)
 *   byok             -> M7 flips true (backend P4 multi-provider BYOK + model picker)
 *   presignedUpload  -> M8 (backend P5 presigned S3 uploads + status polling)
 *   richComponents   -> M10 (backend P6 rich-output component event); flips ON by default
 */
export const flags = {
  streaming: env.NEXT_PUBLIC_FEATURE_STREAMING,
  auth: env.NEXT_PUBLIC_FEATURE_AUTH,
  byok: env.NEXT_PUBLIC_FEATURE_BYOK,
  presignedUpload: env.NEXT_PUBLIC_FEATURE_PRESIGNED_UPLOAD,
  richComponents: env.NEXT_PUBLIC_FEATURE_RICH_COMPONENTS,
} as const;

export type Flags = typeof flags;
