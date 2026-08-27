export class RangeNotSatisfiableError extends Error {
  constructor() { super("RANGE_NOT_SATISFIABLE"); this.name = "RangeNotSatisfiableError"; }
}

export function parseSingleByteRange(header: string | null, size: number) {
  if (!header) return null;
  if (!Number.isSafeInteger(size) || size <= 0) throw new RangeNotSatisfiableError();
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) throw new RangeNotSatisfiableError();
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new RangeNotSatisfiableError();
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) throw new RangeNotSatisfiableError();
  return { start, end: Math.min(requestedEnd, size - 1) };
}
