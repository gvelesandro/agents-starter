import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DropdownMenu } from "./DropdownMenu";

// Mock Radix UI components
vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-root">{children}</div>
  ),
  Trigger: ({ children, className, disabled, id }: any) => (
    <button
      data-testid="dropdown-trigger"
      className={className}
      disabled={disabled}
      id={id}
    >
      {children}
    </button>
  ),
  Portal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-portal">{children}</div>
  ),
  Content: ({
    children,
    className,
    align,
    side,
    sideOffset,
    alignOffset,
    onCloseAutoFocus,
  }: any) => (
    <div
      data-testid="dropdown-content"
      className={className}
      data-align={align}
      data-side={side}
      data-side-offset={sideOffset}
      data-align-offset={alignOffset}
    >
      {children}
    </div>
  ),
  Item: ({ children, asChild }: any) =>
    asChild ? children : <div data-testid="dropdown-item">{children}</div>,
}));

// Mock Phosphor Icons
vi.mock("@phosphor-icons/react", () => ({
  DotsThree: ({ weight }: { weight?: string }) => (
    <span data-testid="dots-icon" data-weight={weight}>
      ⋯
    </span>
  ),
  IconContext: {
    Provider: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: any;
    }) => (
      <div data-testid="icon-context" data-size={value.size}>
        {children}
      </div>
    ),
  },
}));

describe("DropdownMenu", () => {
  const mockMenuItems = [
    {
      type: "button" as const,
      label: "Action 1",
      onClick: vi.fn(),
    },
    {
      type: "link" as const,
      label: "Link 1",
      href: "/test",
    },
    {
      type: "divider" as const,
    },
    {
      type: "title" as const,
      titleContent: "Section Title",
    },
  ];

  it("renders dropdown trigger with default dots icon", () => {
    render(
      <DropdownMenu align="start" side="bottom" MenuItems={mockMenuItems} />
    );

    expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("dots-icon")).toBeInTheDocument();
  });

  it("renders custom children instead of default icon", () => {
    render(
      <DropdownMenu align="start" side="bottom" MenuItems={mockMenuItems}>
        <span>Custom Trigger</span>
      </DropdownMenu>
    );

    expect(screen.getByText("Custom Trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("dots-icon")).not.toBeInTheDocument();
  });

  it("applies custom className to trigger", () => {
    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={mockMenuItems}
        className="custom-class"
      />
    );

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger).toHaveClass("custom-class");
  });

  it("disables trigger when disabled prop is true", () => {
    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={mockMenuItems}
        disabled
      />
    );

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger).toBeDisabled();
  });

  it("applies id to trigger", () => {
    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={mockMenuItems}
        id="test-dropdown"
      />
    );

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger).toHaveAttribute("id", "test-dropdown");
  });

  it("renders button menu items", () => {
    const handleClick = vi.fn();
    const menuItems = [
      {
        type: "button" as const,
        label: "Test Button",
        onClick: handleClick,
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    expect(screen.getByText("Test Button")).toBeInTheDocument();
  });

  it("renders link menu items", () => {
    const menuItems = [
      {
        type: "link" as const,
        label: "Test Link",
        href: "/test-url",
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    const link = screen.getByText("Test Link").closest("a");
    expect(link).toHaveAttribute("href", "/test-url");
  });

  it('renders external links with target="_blank"', () => {
    const menuItems = [
      {
        type: "link" as const,
        label: "External Link",
        href: "https://example.com",
        hrefExternal: true,
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    const link = screen.getByText("External Link").closest("a");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders divider items", () => {
    const menuItems = [
      {
        type: "divider" as const,
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    // Check for divider structure
    const divider = document.querySelector(".h-px");
    expect(divider).toBeInTheDocument();
  });

  it("renders title items", () => {
    const menuItems = [
      {
        type: "title" as const,
        titleContent: "Section Header",
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    expect(screen.getByText("Section Header")).toBeInTheDocument();
  });

  it("applies destructive styling to destructive buttons", () => {
    const menuItems = [
      {
        type: "button" as const,
        label: "Delete Item",
        onClick: vi.fn(),
        destructiveAction: true,
      },
    ];

    render(<DropdownMenu align="start" side="bottom" MenuItems={menuItems} />);

    const button = screen.getByText("Delete Item");
    expect(button).toHaveClass("text-red-500");
  });

  it("renders icons with proper sizing", () => {
    const menuItems = [
      {
        type: "button" as const,
        label: "With Icon",
        onClick: vi.fn(),
        icon: <span data-testid="test-icon">Icon</span>,
      },
    ];

    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={menuItems}
        size="base"
      />
    );

    const iconContext = screen.getByTestId("icon-context");
    expect(iconContext).toHaveAttribute("data-size", "20");
  });

  it("renders small icons for small size", () => {
    const menuItems = [
      {
        type: "button" as const,
        label: "With Icon",
        onClick: vi.fn(),
        icon: <span data-testid="test-icon">Icon</span>,
      },
    ];

    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={menuItems}
        size="sm"
      />
    );

    const iconContext = screen.getByTestId("icon-context");
    expect(iconContext).toHaveAttribute("data-size", "16");
  });

  it("handles null MenuItems gracefully", () => {
    render(<DropdownMenu align="start" side="bottom" MenuItems={null} />);

    expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
  });

  it("applies small font styling for small size", () => {
    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={mockMenuItems}
        size="sm"
      />
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveClass("text-sm", "font-normal");
  });

  it("applies positioning classes based on align and side props", () => {
    render(
      <DropdownMenu align="end" side="bottom" MenuItems={mockMenuItems} />
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveClass("origin-top-right");
  });

  it("passes sideOffset and alignOffset to content", () => {
    render(
      <DropdownMenu
        align="start"
        side="bottom"
        MenuItems={mockMenuItems}
        sideOffset={10}
        alignOffset={5}
      />
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveAttribute("data-side-offset", "10");
    expect(content).toHaveAttribute("data-align-offset", "5");
  });
});
