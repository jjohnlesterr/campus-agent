// Department → Program dependency, shared by client forms and tests (no server-only imports).

/** Programs offered by one department — never another department's. Empty when none is chosen. */
export function programsForDepartment<P extends { department_id: string }>(programs: P[], departmentId: string | null | undefined): P[] {
  if (!departmentId) return []
  return programs.filter((p) => p.department_id === departmentId)
}
