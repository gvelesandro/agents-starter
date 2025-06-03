import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Test content</Card>)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies default variant secondary', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild).toHaveClass('btn-secondary')
  })

  it('applies primary variant styling', () => {
    const { container } = render(<Card variant="primary">Content</Card>)
    expect(container.firstChild).toHaveClass('btn-primary')
  })

  it('applies secondary variant styling', () => {
    const { container } = render(<Card variant="secondary">Content</Card>)
    expect(container.firstChild).toHaveClass('btn-secondary')
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders as div by default', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild?.tagName).toBe('DIV')
  })

  it('renders as custom element when as prop provided', () => {
    const { container } = render(<Card as="section">Content</Card>)
    expect(container.firstChild?.tagName).toBe('SECTION')
  })

  it('applies tabIndex when provided', () => {
    const { container } = render(<Card tabIndex={0}>Content</Card>)
    expect(container.firstChild).toHaveAttribute('tabIndex', '0')
  })

  it('has default card styling classes', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild
    expect(card).toHaveClass('w-full')
    expect(card).toHaveClass('rounded-lg')
    expect(card).toHaveClass('p-4')
  })

  it('does not apply variant classes for ghost and destructive variants', () => {
    const { container: ghostContainer } = render(<Card variant="ghost">Content</Card>)
    expect(ghostContainer.firstChild).not.toHaveClass('btn-primary')
    expect(ghostContainer.firstChild).not.toHaveClass('btn-secondary')

    const { container: destructiveContainer } = render(<Card variant="destructive">Content</Card>)
    expect(destructiveContainer.firstChild).not.toHaveClass('btn-primary')
    expect(destructiveContainer.firstChild).not.toHaveClass('btn-secondary')
  })
})