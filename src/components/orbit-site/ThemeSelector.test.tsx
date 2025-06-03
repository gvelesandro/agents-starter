import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ThemeSelector from './ThemeSelector'

// Mock the useTheme hook since it's external dependency
vi.mock('@/hooks/useTheme', () => ({
  default: vi.fn()
}))

// Mock the phosphor icons
vi.mock('@phosphor-icons/react', () => ({
  Moon: ({ className, weight }: { className?: string; weight?: string }) => 
    <span data-testid="moon-icon" className={className} data-weight={weight}>Moon</span>,
  Sun: ({ className, weight }: { className?: string; weight?: string }) => 
    <span data-testid="sun-icon" className={className} data-weight={weight}>Sun</span>
}))

describe('ThemeSelector', () => {
  it('renders theme toggle button', () => {
    render(<ThemeSelector />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows sun icon by default (light theme)', () => {
    render(<ThemeSelector />)
    const sunIcon = screen.getByTestId('sun-icon')
    const moonIcon = screen.getByTestId('moon-icon')
    
    expect(sunIcon).toHaveClass('block')
    expect(moonIcon).toHaveClass('hidden')
  })

  it('toggles theme when clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector />)
    
    const button = screen.getByRole('button')
    const sunIcon = screen.getByTestId('sun-icon')
    const moonIcon = screen.getByTestId('moon-icon')
    
    // Initially light theme
    expect(sunIcon).toHaveClass('block')
    expect(moonIcon).toHaveClass('hidden')
    
    // Click to toggle to dark theme
    await user.click(button)
    
    expect(sunIcon).toHaveClass('hidden')
    expect(moonIcon).toHaveClass('block')
    expect(moonIcon).toHaveClass('animate-fade')
  })

  it('toggles back to light theme on second click', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector />)
    
    const button = screen.getByRole('button')
    const sunIcon = screen.getByTestId('sun-icon')
    const moonIcon = screen.getByTestId('moon-icon')
    
    // Click twice to go dark then back to light
    await user.click(button)
    await user.click(button)
    
    expect(sunIcon).toHaveClass('block')
    expect(moonIcon).toHaveClass('hidden')
  })

  it('has proper button styling', () => {
    render(<ThemeSelector />)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('flex')
    expect(button).toHaveClass('size-8')
    expect(button).toHaveClass('cursor-pointer')
    expect(button).toHaveClass('items-center')
    expect(button).toHaveClass('justify-center')
    expect(button).toHaveClass('rounded-md')
  })

  it('has button type button', () => {
    render(<ThemeSelector />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('applies bold weight to icons', () => {
    render(<ThemeSelector />)
    const sunIcon = screen.getByTestId('sun-icon')
    const moonIcon = screen.getByTestId('moon-icon')
    
    expect(sunIcon).toHaveAttribute('data-weight', 'bold')
    expect(moonIcon).toHaveAttribute('data-weight', 'bold')
  })

  it('applies animate-fade class to sun icon', () => {
    render(<ThemeSelector />)
    const sunIcon = screen.getByTestId('sun-icon')
    expect(sunIcon).toHaveClass('animate-fade')
  })
})