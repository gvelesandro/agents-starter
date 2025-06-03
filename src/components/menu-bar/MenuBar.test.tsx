import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MenuBar } from './MenuBar'
import { TooltipProvider } from '@/providers/TooltipProvider'

// Mock the hooks
vi.mock('@/hooks/useMenuNavigation', () => ({
  useMenuNavigation: vi.fn()
}))

// Mock Phosphor Icons
vi.mock('@phosphor-icons/react', () => ({
  IconContext: {
    Provider: ({ children, value }: { children: React.ReactNode; value: any }) => (
      <div data-testid="icon-context" data-size={value.size}>{children}</div>
    )
  }
}))

describe('MenuBar', () => {
  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <TooltipProvider>
        {children}
      </TooltipProvider>
    )
  }

  const mockOptions = [
    {
      icon: <span data-testid="icon-1">Icon1</span>,
      id: 1,
      onClick: vi.fn(),
      tooltip: 'Option 1'
    },
    {
      icon: <span data-testid="icon-2">Icon2</span>,
      id: 2,
      onClick: vi.fn(),
      tooltip: 'Option 2'
    },
    {
      icon: <span data-testid="icon-3">Icon3</span>,
      id: 3,
      onClick: vi.fn(),
      tooltip: 'Option 3'
    }
  ]

  it('renders menu bar with navigation element', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
      />
    )
    
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveClass('bg-ob-base-100', 'flex', 'rounded-lg', 'shadow-xs')
  })

  it('renders all menu options', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
      />
    )
    
    expect(screen.getByTestId('icon-1')).toBeInTheDocument()
    expect(screen.getByTestId('icon-2')).toBeInTheDocument()
    expect(screen.getByTestId('icon-3')).toBeInTheDocument()
  })

  it('applies active styling to active option', () => {
    renderWithProvider(
      <MenuBar
        isActive={2}
        options={mockOptions}
        optionIds={true}
      />
    )
    
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveClass('text-ob-base-300', 'bg-ob-base-200')
  })

  it('calls onClick when option is clicked', async () => {
    const user = userEvent.setup()
    const mockOnClick = vi.fn()
    const options = [
      {
        icon: <span>Icon</span>,
        id: 1,
        onClick: mockOnClick,
        tooltip: 'Test Option'
      }
    ]

    renderWithProvider(
      <MenuBar
        isActive={1}
        options={options}
      />
    )
    
    const button = screen.getByRole('button')
    await user.click(button)
    
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
        className="custom-menu-class"
      />
    )
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-menu-class')
  })

  it('uses option IDs when optionIds is true', () => {
    renderWithProvider(
      <MenuBar
        isActive={2}
        options={mockOptions}
        optionIds={true}
      />
    )
    
    // When optionIds is true, the active check uses option.id
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveClass('text-ob-base-300', 'bg-ob-base-200')
  })

  it('uses array index when optionIds is false', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
        optionIds={false}
      />
    )
    
    // When optionIds is false, the active check uses array index
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveClass('text-ob-base-300', 'bg-ob-base-200')
  })

  it('renders icons with correct size context', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
      />
    )
    
    const iconContexts = screen.getAllByTestId('icon-context')
    iconContexts.forEach(context => {
      expect(context).toHaveAttribute('data-size', '18')
    })
  })

  it('applies correct button styling', () => {
    renderWithProvider(
      <MenuBar
        isActive={-1} // Set to inactive state to test base styling
        options={mockOptions}
      />
    )
    
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass(
      'text-ob-base-100',
      'hover:text-ob-base-300',
      'border-ob-border',
      'relative',
      '-ml-px',
      'flex',
      'h-full',
      'w-11',
      'cursor-pointer',
      'items-center',
      'justify-center',
      'border',
      'transition-colors'
    )
    expect(buttons[0]).toHaveAttribute('type', 'button')
  })

  it('handles different isActive types', () => {
    const { rerender } = renderWithProvider(
      <MenuBar
        isActive="test"
        options={mockOptions}
        optionIds={true}
      />
    )
    
    // Test with string
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    
    // Test with boolean
    rerender(
      <TooltipProvider>
        <MenuBar
          isActive={true}
          options={mockOptions}
          optionIds={true}
        />
      </TooltipProvider>
    )
    
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders with no active option', () => {
    renderWithProvider(
      <MenuBar
        isActive={undefined}
        options={mockOptions}
      />
    )
    
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toHaveClass('text-ob-base-300', 'bg-ob-base-200')
    })
  })

  it('handles empty options array', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={[]}
      />
    )
    
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies border radius classes correctly', () => {
    renderWithProvider(
      <MenuBar
        isActive={1}
        options={mockOptions}
      />
    )
    
    // Check that tooltips have the correct classes for border radius
    const tooltips = document.querySelectorAll('[class*="first-of-type"]')
    expect(tooltips.length).toBeGreaterThan(0)
  })
})