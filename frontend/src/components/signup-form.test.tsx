import { render, screen } from "@testing-library/react";
import { SignupForm } from "./signup-form";

describe("SignupForm component", () => {
  it("renders required account creation fields", () => {
    render(<SignupForm />);

    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email$/i)).toBeRequired();
    expect(screen.getByLabelText(/^password$/i)).toBeRequired();
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("shows existing-account helper text", () => {
    render(<SignupForm />);

    expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});
