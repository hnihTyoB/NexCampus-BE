export const APPLICATION_PREFERRED_DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "Data",
  "QA",
  "HR",
  "Product",
] as const;

export type ApplicationPreferredDepartment =
  (typeof APPLICATION_PREFERRED_DEPARTMENTS)[number];

export const APPLICATION_PREFERRED_POSITIONS: Record<
  ApplicationPreferredDepartment,
  readonly string[]
> = {
  Engineering: [
    "Backend Intern",
    "Frontend Intern",
    "Mobile Intern",
    "DevOps Intern",
  ],
  Design: ["UI/UX Intern", "Graphic Intern"],
  Marketing: ["Marketing Intern"],
  Data: ["Data Intern"],
  QA: ["QA Intern"],
  HR: ["HR Intern"],
  Product: ["Product Intern"],
};

export function isValidApplicationPreference(
  department: string,
  position: string,
) {
  const positions = APPLICATION_PREFERRED_POSITIONS[
    department as ApplicationPreferredDepartment
  ] as readonly string[] | undefined;

  return positions?.includes(position) ?? false;
}
