/** @jest-environment node */

import { cookies } from "next/headers";
import {
  forgotPasswordAction,
  loginAction,
  logoutFunc,
} from "./auth";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

type CookieStore = {
  set: jest.Mock;
  delete: jest.Mock;
};

describe("auth action integration tests", () => {
  const cookiesMock = cookies as jest.Mock;
  const originalFetch = global.fetch;

  let cookieStore: CookieStore;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    cookieStore = {
      set: jest.fn(),
      delete: jest.fn(),
    };

    cookiesMock.mockResolvedValue(cookieStore);
    (global as any).fetch = jest.fn();

    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  it("loginAction sets token cookie and returns response payload on success", async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, role: "student" }),
      headers: {
        getSetCookie: jest.fn().mockReturnValue(["token=abc123; Path=/; HttpOnly"]),
      },
    });

    const formData = new FormData();
    formData.set("email", "student@tracku.test");
    formData.set("password", "secret");

    const result = await loginAction(null, formData);

    expect(result).toEqual({ success: true, role: "student" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "token",
      "abc123",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("loginAction returns failure message when backend returns non-OK", async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: false,
      headers: { getSetCookie: jest.fn().mockReturnValue([]) },
    });

    const formData = new FormData();
    formData.set("email", "student@tracku.test");
    formData.set("password", "wrong");

    const result = await loginAction(null, formData);

    expect(result).toEqual({ message: "Login failed" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("loginAction returns generic error when token cookie is absent", async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
      headers: {
        getSetCookie: jest.fn().mockReturnValue(["session=xyz; Path=/"]),
      },
    });

    const formData = new FormData();
    formData.set("email", "student@tracku.test");
    formData.set("password", "secret");

    const result = await loginAction(null, formData);

    expect(result).toEqual({ message: "An error occurred during login" });
  });

  it("forgotPasswordAction returns success payload when backend succeeds", async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ message: "Reset sent" }),
    });

    const result = await forgotPasswordAction("student@tracku.test");

    expect(result).toEqual({ success: true, message: "Reset sent" });
  });

  it("forgotPasswordAction returns failure payload when backend fails", async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: "User not found" }),
    });

    const result = await forgotPasswordAction("unknown@tracku.test");

    expect(result).toEqual({ success: false, message: "User not found" });
  });

  it("logoutFunc deletes token cookie", async () => {
    const result = await logoutFunc();

    expect(result).toBe(true);
    expect(cookieStore.delete).toHaveBeenCalledWith("token");
  });
});
