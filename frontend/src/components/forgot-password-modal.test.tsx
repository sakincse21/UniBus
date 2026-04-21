import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordModal } from "./forgot-password-modal";
import { forgotPasswordAction } from "@/lib/action/auth";
import { toast } from "sonner";

jest.mock("@/lib/action/auth", () => ({
  forgotPasswordAction: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("ForgotPasswordModal integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("submits email and closes modal on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    (forgotPasswordAction as jest.Mock).mockResolvedValue({
      success: true,
      message: "Email sent",
    });

    render(<ForgotPasswordModal open onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/email address/i), "a@tracku.test");
    await user.click(screen.getByRole("button", { name: /send reset password/i }));

    await waitFor(() => {
      expect(forgotPasswordAction).toHaveBeenCalledWith("a@tracku.test");
      expect(toast.success).toHaveBeenCalledWith("Email sent");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error toast when service returns failure", async () => {
    const user = userEvent.setup();

    (forgotPasswordAction as jest.Mock).mockResolvedValue({
      success: false,
      message: "Unable to send",
    });

    render(<ForgotPasswordModal open onOpenChange={jest.fn()} />);

    await user.type(screen.getByLabelText(/email address/i), "a@tracku.test");
    await user.click(screen.getByRole("button", { name: /send reset password/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unable to send");
    });
  });
});
