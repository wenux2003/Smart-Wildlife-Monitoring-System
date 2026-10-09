import { describe, expect, it } from "vitest";
import { writeCsv } from "./csv-writer.js";

describe("CSV writer", () => {
  it("uses a UTF-8 BOM, RFC 4180 quoting, escaped quotes and CRLF", () => {
    const csv = writeCsv([
      ["plain", "comma,value", 'a"b', "line\r\nbreak"],
      ["Sinhala නොවන", null, "", "end"],
    ]);
    expect(csv.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(csv.toString("utf8")).toBe(
      '\uFEFFplain,"comma,value","a""b","line\r\nbreak"\r\nSinhala නොවන,,,end\r\n',
    );
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tcmd", "\rcmd"])(
    "guards formula-like text starting with %j",
    (value) => {
      expect(writeCsv([[value]]).toString("utf8")).toContain(`'${value}`);
    },
  );

  it("keeps numeric values raw, including negative values", () => {
    expect(writeCsv([[-12, 0, 2.5]]).toString("utf8")).toBe(
      "\uFEFF-12,0,2.5\r\n",
    );
  });

  it("rejects non-finite numeric values", () => {
    expect(() => writeCsv([[Number.NaN]])).toThrow(
      "CSV numbers must be finite.",
    );
  });
});
