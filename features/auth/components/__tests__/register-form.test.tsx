import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const registerMutate = vi.fn();
const upgradeMutate = vi.fn();
let isGuest = false;

vi.mock("@/features/auth/hooks/use-register", () => ({
  useRegister: () => ({ mutate: registerMutate, isPending: false }),
}));
vi.mock("@/features/auth/hooks/use-upgrade", () => ({
  useUpgrade: () => ({ mutate: upgradeMutate, isPending: false }),
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ isGuest }),
}));

import { RegisterForm } from "@/features/auth/components/register-form";

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Username"), "ada");
  await user.type(screen.getByLabelText("Password"), "secret123");
}

describe("RegisterForm", () => {
  beforeEach(() => {
    registerMutate.mockClear();
    upgradeMutate.mockClear();
    isGuest = false;
  });

  it("non-guest: submitting calls register (fresh account)", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(registerMutate).toHaveBeenCalledWith({
      email: "ada@example.com",
      username: "ada",
      password: "secret123",
    });
    expect(upgradeMutate).not.toHaveBeenCalled();
  });

  it("guest: submitting calls UPGRADE (preserves user_id), not register", async () => {
    isGuest = true;
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(upgradeMutate).toHaveBeenCalledWith({
      email: "ada@example.com",
      username: "ada",
      password: "secret123",
    });
    expect(registerMutate).not.toHaveBeenCalled();
  });

  it("invalid input shows an inline error and submits neither mutation", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Username"), "ab"); // too short (min 3)
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(registerMutate).not.toHaveBeenCalled();
    expect(upgradeMutate).not.toHaveBeenCalled();
  });
});
