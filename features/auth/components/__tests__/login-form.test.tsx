import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mutate = vi.fn();
let isPending = false;

vi.mock("@/features/auth/hooks/use-login", () => ({
  useLogin: () => ({ mutate, isPending }),
}));

import { LoginForm } from "@/features/auth/components/login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    mutate.mockClear();
    isPending = false;
  });

  it("blocks submit and shows an inline error for an invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
  });

  it("submits parsed credentials on a valid form", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "secret123",
    });
  });

  it("disables the submit button while the mutation is pending", () => {
    isPending = true;
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
