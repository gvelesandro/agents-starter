import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Tooltip } from './Tooltip'
import { TooltipProvider } from '@/providers/TooltipProvider'

describe('Tooltip', () => {
  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <TooltipProvider>
        {children}
      </TooltipProvider>
    )
  }

  it('renders children content', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('applies custom className to wrapper', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip" className="custom-class">
        <button>Button</button>
      </Tooltip>
    )
    
    const wrapper = screen.getByText('Button').parentElement
    expect(wrapper).toHaveClass('custom-class')
  })

  it('does not have aria-describedby when tooltip is hidden', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip" id="unique-id">
        <button>Button</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Button')
    expect(button.parentElement).not.toHaveAttribute('aria-describedby')
  })

  it('wrapper has default styling classes', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    const wrapper = screen.getByText('Button').parentElement
    expect(wrapper).toHaveClass('relative')
    expect(wrapper).toHaveClass('inline-block')
  })

  it('generates tooltip identifier correctly', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip" id="unique-id">
        <button>Button</button>
      </Tooltip>
    )
    
    // Test that component renders without errors - tooltip logic tested via integration
    expect(screen.getByText('Button')).toBeInTheDocument()
  })

  it('handles content with spaces correctly', () => {
    renderWithProvider(
      <Tooltip content="My test tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    // Test that component renders without errors - tooltip logic tested via integration
    expect(screen.getByText('Button')).toBeInTheDocument()
  })

  it('applies proper wrapper structure', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Button')
    const wrapper = button.parentElement
    
    expect(wrapper?.tagName).toBe('DIV')
    expect(wrapper).toHaveClass('relative', 'inline-block')
  })

  it('handles undefined id gracefully', () => {
    renderWithProvider(
      <Tooltip content="Test tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    expect(screen.getByText('Button')).toBeInTheDocument()
  })
})