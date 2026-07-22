import { z } from "zod";
import { PersonIdSchema, VerseRefSchema } from "./person.js";

/**
 * Everything relational is a Claim. A plain fact is a claim with no
 * competitors; competing genealogies are claims sharing a `conflictGroup`.
 * Direction semantics by type (from → to):
 *   parent_of:      parent → child
 *   spouse_of:      symmetric (stored once, canonical order = lexicographic id)
 *   concubine_of:   concubine → partner
 *   adopted_by:     adoptee → adopter
 *   succeeded_by:   predecessor → successor
 *   mentored_by:    mentee → mentor
 *   contemporary_of: symmetric
 *   ancestor_of:    ancestor → descendant (explicitly non-immediate)
 *   sibling_of:     symmetric
 */
export const ClaimTypeSchema = z.enum([
  "parent_of",
  "spouse_of",
  "concubine_of",
  "adopted_by",
  "succeeded_by",
  "mentored_by",
  "contemporary_of",
  "ancestor_of",
  "sibling_of",
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const ConfidenceSchema = z.enum([
  /** The text states it directly. */
  "explicit",
  /** Derived, e.g. sibling from shared parent, or contracted lineage chains. */
  "inferred",
  /** Extra-biblical tradition; must carry attribution in `source`. */
  "traditional",
  /** Scholars disagree even about the reading. */
  "disputed",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const TraditionSchema = z.enum(["MT", "LXX", "NT", "theographic", "curated"]);
export type Tradition = z.infer<typeof TraditionSchema>;

export const SourceAttributionSchema = z.object({
  tradition: TraditionSchema,
  /** e.g. "Matthean genealogy", "Genesis 11 (MT)", "Josephus, Ant. 1.6.4" */
  document: z.string().optional(),
});
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

export const ClaimSchema = z
  .object({
    /** Stable slug, e.g. "clm_joseph-father-heli" or "thg_parent_x_y". */
    id: z.string().min(1),
    type: ClaimTypeSchema,
    from: PersonIdSchema,
    to: PersonIdSchema,
    citations: z.array(VerseRefSchema).default([]),
    source: SourceAttributionSchema,
    confidence: ConfidenceSchema,
    /** Claims sharing a group are mutually exclusive attested alternatives. */
    conflictGroup: z.string().optional(),
    /** parent_of that may actually be ancestor_of ("son of" = descendant). */
    telescoped: z.boolean().optional(),
    /** Human-readable gloss shown in the detail panel. */
    note: z.string().optional(),
  })
  .superRefine((claim, ctx) => {
    if (claim.citations.length === 0 && claim.confidence !== "traditional" && claim.confidence !== "inferred") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `claim ${claim.id}: citations required unless confidence is "traditional" or "inferred"`,
      });
    }
    if (claim.from === claim.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `claim ${claim.id}: from and to must differ`,
      });
    }
  });
export type Claim = z.infer<typeof ClaimSchema>;
