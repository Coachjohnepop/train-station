/** Train Station officers — money desk, books, and ops copy. */
export const COMPANY_CEO = {
  name: "Jeremy",
  title: "CEO",
} as const;

export const COMPANY_CFO = {
  name: "John",
  title: "CFO",
} as const;

export function jeremyPayLabel(): string {
  return `${COMPANY_CEO.name} Pay (${COMPANY_CEO.title})`;
}

export function johnPayLabel(): string {
  return `${COMPANY_CFO.name} Pay (${COMPANY_CFO.title})`;
}
