import { cn, downloadFile } from "./utils";

describe("utils unit tests", () => {
  it("merges class names with tailwind conflict resolution", () => {
    const result = cn("p-2", "p-4", "text-sm");

    expect(result).toBe("p-4 text-sm");
  });

  it("downloads a file blob and revokes generated object URL", () => {
    const createObjectURLMock = jest.fn(() => "blob:test-url");
    const revokeObjectURLMock = jest.fn();

    Object.defineProperty(window.URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: revokeObjectURLMock,
    });

    const appendSpy = jest.spyOn(document.body, "appendChild");
    const removeSpy = jest.spyOn(document.body, "removeChild");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadFile(new Blob(["sample"]), "report.csv");

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    const appendedNode = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(appendedNode.download).toBe("report.csv");
    expect(appendedNode.href).toBe("blob:test-url");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(appendedNode);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:test-url");

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
