/** URL page state: absent means first page; invalid values are replaced by the canonical first-page URL. */
export function readBlogPage(value: string | null): {page: number; invalid: boolean} {
  if (value === null) return {page: 1, invalid: false};
  const page = Number(value);
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(page) && page <= Math.floor(Number.MAX_SAFE_INTEGER / 6)
    ? {page, invalid: false}
    : {page: 1, invalid: true};
}
