import { act, render, screen } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

function MobileProbe() {
  const isMobile = useIsMobile();

  return <div>{isMobile ? "mobile" : "desktop"}</div>;
}

describe("useIsMobile hook", () => {
  let listeners: Array<() => void> = [];

  beforeEach(() => {
    listeners = [];

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: window.innerWidth < 768,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: (_event: string, cb: () => void) => listeners.push(cb),
        removeEventListener: (_event: string, cb: () => void) => {
          listeners = listeners.filter((listener) => listener !== cb);
        },
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it("returns desktop for widths >= 768", () => {
    render(<MobileProbe />);

    expect(screen.getByText("desktop")).toBeInTheDocument();
  });

  it("updates to mobile after viewport shrink event", () => {
    render(<MobileProbe />);

    act(() => {
      window.innerWidth = 500;
      listeners.forEach((listener) => listener());
    });

    expect(screen.getByText("mobile")).toBeInTheDocument();
  });
});
