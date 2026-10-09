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

/** Authorization role (profiles.role) as shown in the admin: "Admin" or "User". Never a user category. */
export function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "User"
}
