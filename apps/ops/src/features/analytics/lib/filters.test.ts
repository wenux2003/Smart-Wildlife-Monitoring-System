import { describe, expect, it } from "vitest";
import { filterFromSearch } from "./filters.js";

const parkId = "11111111-1111-4111-8111-111111111111";
describe("editable analytics dates", () => {
  it("keeps a reversed or oversized custom range for correction without dropping other filters", () => {
    const reversed = filterFromSearch(
      new URLSearchParams(
        "preset=CUSTOM&from=2026-10-08&to=2026-10-01&sources=RANGER&group=OTHER",
      ),
      parkId,
    );
    expect(reversed).toMatchObject({
      from: "2026-10-08",
      to: "2026-10-01",
      preset: "CUSTOM",
      sources: ["RANGER"],
      categoryGroup: "OTHER",
    });
    expect(
      filterFromSearch(
        new URLSearchParams("preset=CUSTOM&from=2020-01-01&to=2026-10-01"),
        parkId,
      ).from,
    ).toBe("2020-01-01");
  });
  it("falls back for invalid calendar dates and untrusted enum values", () => {
    expect(
      filterFromSearch(new URLSearchParams("from=2026-02-30"), parkId).from,
    ).not.toBe("2026-02-30");
    expect(
      filterFromSearch(new URLSearchParams("group=UNKNOWN"), parkId)
        .categoryGroup,
    ).toBe("ALL");
  });
});
