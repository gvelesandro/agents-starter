import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('renders toggle button', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    
    render(<Toggle onClick={onClick} toggled={false} />)
    
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies default base size classes', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-6.5')
    expect(button).toHaveClass('w-10.5')
  })

  it('applies small size classes', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} size="sm" />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-5.5')
    expect(button).toHaveClass('w-8.5')
  })

  it('applies large size classes', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} size="lg" />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-7.5')
    expect(button).toHaveClass('w-12.5')
  })

  it('applies toggled styling when toggled is true', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={true} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('dark:hover:bg-neutral-450')
    expect(button).toHaveClass('bg-neutral-900')
    expect(button).toHaveClass('hover:bg-neutral-700')
    expect(button).toHaveClass('dark:bg-neutral-500')
  })

  it('does not apply toggled styling when toggled is false', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} />)
    const button = screen.getByRole('button')
    expect(button).not.toHaveClass('dark:hover:bg-neutral-450')
    expect(button).not.toHaveClass('bg-neutral-900')
    expect(button).not.toHaveClass('hover:bg-neutral-700')
    expect(button).not.toHaveClass('dark:bg-neutral-500')
  })

  it('applies translate transform to inner div when toggled', () => {
    const onClick = vi.fn()
    const { container } = render(<Toggle onClick={onClick} toggled={true} />)
    const innerDiv = container.querySelector('div')
    expect(innerDiv).toHaveClass('translate-x-full')
  })

  it('does not apply translate transform when not toggled', () => {
    const onClick = vi.fn()
    const { container } = render(<Toggle onClick={onClick} toggled={false} />)
    const innerDiv = container.querySelector('div')
    expect(innerDiv).not.toHaveClass('translate-x-full')
  })

  it('has default styling classes', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} />)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('ob-focus')
    expect(button).toHaveClass('interactive')
    expect(button).toHaveClass('dark:bg-neutral-750')
    expect(button).toHaveClass('bg-neutral-250')
    expect(button).toHaveClass('cursor-pointer')
    expect(button).toHaveClass('rounded-full')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('border-transparent')
    expect(button).toHaveClass('p-1')
    expect(button).toHaveClass('transition-colors')
  })

  it('inner div has proper styling', () => {
    const onClick = vi.fn()
    const { container } = render(<Toggle onClick={onClick} toggled={false} />)
    const innerDiv = container.querySelector('div')
    
    expect(innerDiv).toHaveClass('aspect-square')
    expect(innerDiv).toHaveClass('h-full')
    expect(innerDiv).toHaveClass('rounded-full')
    expect(innerDiv).toHaveClass('bg-white')
    expect(innerDiv).toHaveClass('transition-all')
  })

  it('has button type button', () => {
    const onClick = vi.fn()
    render(<Toggle onClick={onClick} toggled={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'button')
  })
})