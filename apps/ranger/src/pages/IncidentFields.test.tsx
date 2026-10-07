// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  CoordinateFields,
  IncidentPhotoInput,
  prepareIncidentPhoto,
  parseCoordinates,
  localDateTime,
} from "@wr/ui";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const jpeg = "data:image/jpeg;base64,/9j/AAAA";
function mockImage() {
  vi.stubGlobal(
    "Image",
    class {
      width = 1600;
      height = 1200;
      src = "";
      decode = vi.fn(async () => {});
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(jpeg);
}
describe("M1 location and photo controls", () => {
  it("validates named coordinate ranges and renders manual fields", () => {
    expect(parseCoordinates("6.52", "81.42")).toEqual({
      latitude: 6.52,
      longitude: 81.42,
    });
    expect(() => parseCoordinates("", "81")).toThrow("Enter latitude");
    expect(() => parseCoordinates("91", "181")).toThrow("Latitude must");
    expect(localDateTime()).toMatch(/^\d{4}-\d{2}/);
    const change = vi.fn();
    render(<CoordinateFields latitude="6" longitude="81" onChange={change} />);
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "7" },
    });
    expect(change).toHaveBeenLastCalledWith("7", "81");
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "82" },
    });
    expect(change).toHaveBeenLastCalledWith("6", "82");
  });
  it("compresses a valid photo, previews it and removes it", async () => {
    mockImage();
    const onChange = vi.fn();
    const view = render(
      <IncidentPhotoInput value={null} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("Optional photo"), {
      target: {
        files: [new File(["bytes"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(jpeg));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    view.rerender(<IncidentPhotoInput value={jpeg} onChange={onChange} />);
    fireEvent.click(screen.getByText("Remove photo"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it("keeps no-photo submission possible after invalid type, oversized file or processing failure", async () => {
    mockImage();
    await expect(
      prepareIncidentPhoto(new File(["x"], "bad.txt", { type: "text/plain" })),
    ).rejects.toThrow("JPEG");
    const large = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(large, "size", { value: 11 * 1024 * 1024 });
    await expect(prepareIncidentPhoto(large)).rejects.toThrow("10 MB");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<IncidentPhotoInput value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Optional photo"), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("without a photo");
  });
  it("tries lower quality and reports photos still too large, releasing the temporary URL", async () => {
    mockImage();
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:invalid",
    );
    await expect(
      prepareIncidentPhoto(
        new File(["x"], "photo.webp", { type: "image/webp" }),
      ),
    ).rejects.toThrow("too large");
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
