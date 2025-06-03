import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from './Avatar'
import { TooltipProvider } from '@/providers/TooltipProvider'

describe('Avatar', () => {
  it('renders with username initial when no image provided', () => {
    render(<Avatar username="john" />)
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('renders image when provided', () => {
    render(<Avatar username="john" image="/test-image.jpg" />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/test-image.jpg')
    expect(img).toHaveAttribute('alt', 'john')
  })

  it('applies correct size classes', () => {
    const { container: smallContainer } = render(<Avatar username="john" size="sm" />)
    expect(smallContainer.firstChild).toHaveClass('add-size-sm')

    const { container: mediumContainer } = render(<Avatar username="john" size="md" />)
    expect(mediumContainer.firstChild).toHaveClass('add-size-md')

    const { container: baseContainer } = render(<Avatar username="john" size="base" />)
    expect(baseContainer.firstChild).toHaveClass('add-size-base')
  })

  it('renders as button when as prop is button', () => {
    const { container } = render(<Avatar username="john" as="button" />)
    expect(container.firstChild).toHaveClass('interactive')
  })

  it('applies toggled state correctly', () => {
    const { container } = render(<Avatar username="john" toggled />)
    expect(container.firstChild).toHaveClass('toggle')
  })

  it('applies toggled state with image', () => {
    const { container } = render(<Avatar username="john" image="/test.jpg" toggled />)
    expect(container.firstChild).toHaveClass('after:opacity-100')
  })

  it('renders with custom className', () => {
    const { container } = render(<Avatar username="john" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders with href as link', () => {
    const { container } = render(<Avatar username="john" href="/profile" as="a" />)
    const element = container.firstChild as HTMLElement
    expect(element.tagName.toLowerCase()).toBe('a')
  })

  it('applies external link attributes', () => {
    const { container } = render(<Avatar username="john" href="/profile" external as="a" />)
    const element = container.firstChild as HTMLElement
    expect(element).toHaveAttribute('rel', 'noopener noreferrer')
    expect(element).toHaveAttribute('target', '_blank')
  })

  it('renders with tooltip when provided', () => {
    render(
      <TooltipProvider>
        <Avatar username="john" tooltip="User profile" />
      </TooltipProvider>
    )
    // Avatar should be rendered with tooltip wrapper
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('calculates correct image dimensions based on size', () => {
    const { rerender } = render(<Avatar username="john" image="/test.jpg" size="sm" />)
    let img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '28')
    expect(img).toHaveAttribute('height', '28')

    rerender(<Avatar username="john" image="/test.jpg" size="base" />)
    img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '32')
    expect(img).toHaveAttribute('height', '32')

    rerender(<Avatar username="john" image="/test.jpg" size="md" />)
    img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '36')
    expect(img).toHaveAttribute('height', '36')
  })
})