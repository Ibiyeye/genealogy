/**
 * Stages 4–6: overlay merge → validate → emit. Implemented in M3.
 */
import type { Claim, Person, PersonId, VerseRef } from "@genealogy/schema";
import type { TheoRawExtras } from "./ingest.js";

export interface Stage456Input {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  included: Set<PersonId>;
  raw: Map<PersonId, TheoRawExtras>;
  fullRefs: Map<PersonId, VerseRef[]>;
  validateOnly: boolean;
}

export async function runOverlayValidateEmit(_input: Stage456Input): Promise<void> {
  console.log("stages 4–6: overlay/validate/emit not implemented yet (M3)");
}
