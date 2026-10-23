/**
 * Explicit university designations, keyed by immutable Knowledge Library source ID.
 * A designation applies only to questions the source actually answers. Upload date,
 * file name, title, and card order never grant authority. Renaming a source is safe;
 * replacing it with a new source ID requires a reviewed change here.
 */
export const SOURCE_UPDATES = [
  {
    sourceId: "4628df71-c802-46bf-8747-77e8a81a5d7b",
    reason: "CECT Agent FAQ: designated university update to older guidance on the topics it covers.",
  },
] as const
