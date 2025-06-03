import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Label } from './Label'

describe('Label', () => {
  it('renders title text', () => {
    render(<Label title="Test Label" />)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(<Label title="Test Label">Child content</Label>)
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('applies htmlFor attribute', () => {
    render(<Label title="Test Label" htmlFor="input-id" />)
    const label = screen.getByText('Test Label').closest('label')
    expect(label).toHaveAttribute('for', 'input-id')
  })

  it('shows required asterisk when required is true', () => {
    render(<Label title="Required Field" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows required description when required and not valid', () => {
    render(
      <Label 
        title="Required Field" 
        required 
        isValid={false} 
        requiredDescription="This field is required" 
      />
    )
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('does not show required description when valid', () => {
    render(
      <Label 
        title="Required Field" 
        required 
        isValid={true} 
        requiredDescription="This field is required" 
      />
    )
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument()
  })

  it('does not show required description when not required', () => {
    render(
      <Label 
        title="Optional Field" 
        required={false} 
        isValid={false} 
        requiredDescription="This field is required" 
      />
    )
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Label title="Test Label" className="custom-class" />)
    const label = screen.getByText('Test Label').closest('label')
    expect(label).toHaveClass('custom-class')
  })

  it('applies default styling classes', () => {
    render(<Label title="Test Label" />)
    const label = screen.getByText('Test Label').closest('label')
    expect(label).toHaveClass('text-ob-base-200')
    expect(label).toHaveClass('relative')
    expect(label).toHaveClass('block')
    expect(label).toHaveClass('w-full')
  })

  it('applies destructive styling to required description', () => {
    render(
      <Label 
        title="Required Field" 
        required 
        isValid={false} 
        requiredDescription="This field is required" 
      />
    )
    const requiredDesc = screen.getByText('This field is required')
    expect(requiredDesc).toHaveClass('text-ob-destructive')
  })

  it('passes through additional props', () => {
    render(<Label title="Test Label" data-testid="custom-label" />)
    const label = screen.getByTestId('custom-label')
    expect(label).toBeInTheDocument()
  })
})