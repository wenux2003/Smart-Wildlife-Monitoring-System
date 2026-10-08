import { describe, expect, it } from "vitest";
import {
  CommunitySmsSchema,
  ImageDataSchema,
  CoordinatesSchema,
} from "./incidents.js";
describe("M1 shared contracts", () => {
  it("preserves raw SMS exactly while rejecting empty messages", () => {
    const sms = {
      parkId: "11111111-1111-4111-8111-111111111111",
      phone: "0771234567",
      providerMessageId: "test",
      rawText: "  ELEPHANT crop damage @ Unknown field  ",
    };
    expect(CommunitySmsSchema.parse(sms).rawText).toBe(sms.rawText);
    expect(CommunitySmsSchema.safeParse({ ...sms, rawText: " " }).success).toBe(
      false,
    );
  });
  it("rejects out-of-range or nonfinite coordinates and non-image data", () => {
    for (const location of [
      { latitude: NaN, longitude: 81 },
      { latitude: 6, longitude: 181 },
    ])
      expect(CoordinatesSchema.safeParse(location).success).toBe(false);
    for (const image of [
      "https://example.com/fake.jpg",
      "data:image/svg+xml;base64,AAAA",
      "data:image/png;base64,AAAA",
      "data:image/jpeg;base64,AAAA",
      "data:image/webp;base64,AAAA",
    ])
      expect(ImageDataSchema.safeParse(image).success).toBe(false);
    expect(
      ImageDataSchema.safeParse("data:image/jpeg;base64,/9j/AAAA").success,
    ).toBe(true);
    expect(
      ImageDataSchema.safeParse("data:image/webp;base64,UklGRgAA").success,
    ).toBe(true);
  });
});
