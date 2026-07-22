import { z } from "zod";

/**
 * PersonId is a stable human-readable slug: the Theographic `personLookup`
 * ("david_994") for imported people, or a curated slug ("heli_luke3") for
 * people added or split out by the curation overlay.
 */
export const PersonIdSchema = z.string().min(1);
export type PersonId = z.infer<typeof PersonIdSchema>;

/**
 * Compact canonical verse reference, e.g. "Gen 5:3", "1Chr 3:19", "Luke 3:23".
 * Book codes are validated against the canon list in `verseRef.ts`.
 */
export const VerseRefSchema = z.string().regex(
  /^(?:[1-3])?[A-Z][a-z]+ \d+(?::\d+(?:-\d+)?)?$/,
  "expected a reference like 'Gen 5:3', '1Chr 3:19' or 'Ps 23'",
);
export type VerseRef = z.infer<typeof VerseRefSchema>;

export const NameVariantKindSchema = z.enum([
  "birth",
  "renamed",
  "regnal",
  "greek",
  "hebrew",
  "alt-spelling",
  "title",
]);
export type NameVariantKind = z.infer<typeof NameVariantKindSchema>;

export const NameVariantSchema = z.object({
  name: z.string().min(1),
  kind: NameVariantKindSchema,
  citations: z.array(VerseRefSchema).default([]),
  note: z.string().optional(),
});
export type NameVariant = z.infer<typeof NameVariantSchema>;

export const PersonSchema = z.object({
  id: PersonIdSchema,
  primaryName: z.string().min(1),
  variants: z.array(NameVariantSchema).default([]),
  gender: z.enum(["male", "female"]).optional(),
  /** True for narratively significant unnamed figures ("Pharaoh's daughter"). */
  unnamed: z.boolean().optional(),
  /** Short human label distinguishing same-named people: "mother of Jesus". */
  disambiguator: z.string().optional(),
  /** First mention plus a capped set of key references. */
  citations: z.array(VerseRefSchema).default([]),
  /** Total verses mentioning this person — the notability metric. */
  verseCount: z.number().int().nonnegative(),
  /** People-group memberships ("Kings of Judah", "Twelve Apostles") — used
   *  for timeline lane grouping. */
  groups: z.array(z.string()).default([]),
  /** Provenance back-links into source datasets. */
  sourceIds: z
    .object({ theographic: z.string().optional() })
    .default({}),
  /** Optional 1–2 sentence curated blurb. */
  bio: z.string().optional(),
});
export type Person = z.infer<typeof PersonSchema>;
