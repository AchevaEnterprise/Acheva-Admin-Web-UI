export const LEVELS = ['100', '200', '300', '400', '500'] as const;
export const SEMESTERS = ['1ST SEMESTER', '2ND SEMESTER'] as const;

/**
 * Academic sessions offered in every session picker — 2020/2021 upward through
 * three sessions past the current calendar year (so a new session is always
 * pickable ahead of time). Format: `YYYY/YYYY+1`.
 */
export const SESSIONS: readonly string[] = (() => {
  const START_YEAR = 2020;
  const endYear = new Date().getFullYear() + 3;
  const list: string[] = [];
  for (let year = START_YEAR; year <= endYear; year++) {
    list.push(`${year}/${year + 1}`);
  }
  return list;
})();
