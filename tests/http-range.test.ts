import assert from "node:assert/strict";
import test from "node:test";
import { parseSingleByteRange, RangeNotSatisfiableError } from "../lib/http-range";

test("analyse les plages HTTP explicites, ouvertes et suffixées", () => {
  assert.deepEqual(parseSingleByteRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseSingleByteRange("bytes=900-", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseSingleByteRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseSingleByteRange("bytes=0-9999", 1000), { start: 0, end: 999 });
  assert.equal(parseSingleByteRange(null, 1000), null);
});

test("refuse les plages multiples ou hors fichier avec un 416 exploitable", () => {
  for (const value of ["bytes=1000-", "bytes=20-10", "bytes=0-1,4-5", "items=0-1", "bytes=-0"]) {
    assert.throws(() => parseSingleByteRange(value, 1000), RangeNotSatisfiableError);
  }
});
