import { z } from "zod";
import { PersonSchema } from "./person.js";
import { ClaimSchema } from "./claim.js";
import { AnchorSchema, ChronologyLayerSchema } from "./chronology.js";

/**
 * Shapes of the static JSON artifacts emitted to app/public/data/.
 * persons + claims + the default chronology layer load eagerly;
 * other layers and anchors lazy-load on first use.
 */

export const PersonsArtifactSchema = z.object({
  persons: z.array(PersonSchema),
});
export type PersonsArtifact = z.infer<typeof PersonsArtifactSchema>;

export const ClaimsArtifactSchema = z.object({
  claims: z.array(ClaimSchema),
});
export type ClaimsArtifact = z.infer<typeof ClaimsArtifactSchema>;

export const ChronologyArtifactSchema = ChronologyLayerSchema;
export type ChronologyArtifact = z.infer<typeof ChronologyArtifactSchema>;

export const AnchorsArtifactSchema = z.object({
  anchors: z.array(AnchorSchema),
});
export type AnchorsArtifact = z.infer<typeof AnchorsArtifactSchema>;

export const LineageStepSchema = z.object({
  id: z.string(),
  /** Claim id linking the previous member to this one; null for the head. */
  claim: z.string().nullable(),
});
export const LineageSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  citation: z.string(),
  /** chain = descent line rendered as a spine; group = an unordered set. */
  kind: z.enum(["chain", "group"]).default("chain"),
  people: z.array(LineageStepSchema),
});
export type Lineage = z.infer<typeof LineageSchema>;
export const LineagesArtifactSchema = z.object({ lineages: z.array(LineageSchema) });
export type LineagesArtifact = z.infer<typeof LineagesArtifactSchema>;

export const ManifestSchema = z.object({
  datasetVersion: z.string(),
  generatedAt: z.string(),
  counts: z.object({
    persons: z.number().int(),
    claims: z.number().int(),
    conflictGroups: z.number().int(),
    anchors: z.number().int(),
  }),
  chronologyLayers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      attribution: z.string(),
      file: z.string(),
      coverage: z.number().int(),
    }),
  ),
  /** Default layer id the app loads eagerly. */
  defaultChronologyLayer: z.string(),
  attribution: z.string(),
  license: z.string(),
});
export type Manifest = z.infer<typeof ManifestSchema>;
