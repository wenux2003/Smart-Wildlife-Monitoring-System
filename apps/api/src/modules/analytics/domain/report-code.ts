/** The caller supplies a database sequence value, never a process-local counter. */
export function reportCode(
  parkCode: string,
  year: number,
  sequence: number | string,
): string {
  const value = String(sequence);
  if (
    !/^[A-Z][A-Z0-9_]{0,15}$/.test(parkCode) ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 9999 ||
    !/^[1-9][0-9]{0,11}$/.test(value)
  )
    throw new Error("Invalid report code components.");
  return "RPT-" + parkCode + "-" + year + "-" + value.padStart(6, "0");
}
