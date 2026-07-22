import { z } from "zod";
import { PersonIdSchema, VerseRefSchema } from "./person.js";

/**
 * Relative anchors are the chronological ground truth: statements the text
 * actually makes. Absolute dates live in ChronologyLayer and are derived or
 * hand-entered per dating system. Years use astronomical-style signed
 * integers where negative = BC (no year 0 handling lives in the app's
 * year module; the data layer just stores what each system publishes).
 */
export const AnchorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lifespan"),
    person: PersonIdSchema,
    years: z.number().int().positive(),
    citations: z.array(VerseRefSchema).min(1),
  }),
  z.object({
    kind: z.literal("age_at_fatherhood"),
    parent: PersonIdSchema,
    child: PersonIdSchema,
    age: z.number().int().positive(),
    citations: z.array(VerseRefSchema).min(1),
  }),
  z.object({
    kind: z.literal("regnal_length"),
    person: PersonIdSchema,
    years: z.number().positive(),
    realm: z.enum(["united", "israel", "judah", "other"]),
    citations: z.array(VerseRefSchema).min(1),
  }),
  z.object({
    kind: z.literal("synchronism"),
    person: PersonIdSchema,
    event: z.string().min(1),
    inYearOfReignOf: PersonIdSchema,
    year: z.number().int().positive(),
    citations: z.array(VerseRefSchema).min(1),
  }),
  z.object({
    kind: z.literal("event_offset"),
    person: PersonIdSchema,
    event: z.string().min(1),
    offsetYears: z.number().int(),
    relativeTo: z.string().min(1),
    citations: z.array(VerseRefSchema).min(1),
  }),
]);
export type Anchor = z.infer<typeof AnchorSchema>;

export const ChronologySpanSchema = z
  .object({
    birth: z.number().int().optional(),
    death: z.number().int().optional(),
    /** Floruit range when birth/death are unknown — [min, max]. */
    active: z.tuple([z.number().int(), z.number().int()]).optional(),
    approx: z.boolean().default(false),
  })
  .refine(
    (s) => s.birth !== undefined || s.death !== undefined || s.active !== undefined,
    "a span needs at least one of birth, death, active",
  );
export type ChronologySpan = z.infer<typeof ChronologySpanSchema>;

export const ChronologyLayerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Shown in the UI; required for scholarly and CC-BY-SA hygiene. */
  attribution: z.string().min(1),
  spans: z.record(PersonIdSchema, ChronologySpanSchema),
});
export type ChronologyLayer = z.infer<typeof ChronologyLayerSchema>;
