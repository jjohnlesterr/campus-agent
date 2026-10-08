// Freshman / visitor is a profile field, not an auth role. Shared by client forms,
// server actions and tests (no server-only imports).

export const USER_TYPES = [
  { value: "freshman", label: "Incoming Freshman" },
  { value: "visitor", label: "Visitor" },
] as const

export type UserType = (typeof USER_TYPES)[number]["value"]

export const USER_TYPE_VALUES = USER_TYPES.map((t) => t.value) as [UserType, ...UserType[]]

/** "Incoming Freshman", "Visitor", or null when the profile has none (admins, legacy accounts). */
export function userTypeLabel(value: string | null | undefined) {
  return USER_TYPES.find((t) => t.value === value)?.label ?? null
}

/**
 * How an account is described in the product. The database keeps the legacy
 * internal role value "student" for every non-admin account; it is shown as "User".
 */
export function roleLabel(role: string) {
  return role === "admin" ? "Administrator" : "User"
}
