import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  const mockOptions = [
    { value: 'option1' },
    { value: 'option2' },
    { value: 'option3' }
  ]

  it('renders select element', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders all options', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    
    expect(screen.getByText('option1')).toBeInTheDocument()
    expect(screen.getByText('option2')).toBeInTheDocument()
    expect(screen.getByText('option3')).toBeInTheDocument()
  })

  it('renders placeholder when provided', () => {
    const setValue = vi.fn()
    render(
      <Select 
        options={mockOptions} 
        setValue={setValue} 
        value="" 
        placeholder="Choose option"
      />
    )
    expect(screen.getByText('Choose option')).toBeInTheDocument()
  })

  it('shows selected value', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="option2" />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('option2')
  })

  it('calls setValue when option is selected', async () => {
    const user = userEvent.setup()
    const setValue = vi.fn()
    
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'option2')
    
    expect(setValue).toHaveBeenCalledWith('option2')
  })

  it('applies default base size classes', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('add-size-base')
    expect(select).toHaveClass('!pr-9')
  })

  it('applies small size classes', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" size="sm" />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('add-size-sm')
    expect(select).toHaveClass('!pr-6.5')
  })

  it('applies medium size classes', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" size="md" />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('add-size-md')
    expect(select).toHaveClass('!pr-8')
  })

  it('applies custom className', () => {
    const setValue = vi.fn()
    render(
      <Select 
        options={mockOptions} 
        setValue={setValue} 
        value="" 
        className="custom-class"
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('custom-class')
  })

  it('has default styling classes', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    const select = screen.getByRole('combobox')
    
    expect(select).toHaveClass('btn')
    expect(select).toHaveClass('btn-secondary')
    expect(select).toHaveClass('interactive')
    expect(select).toHaveClass('relative')
    expect(select).toHaveClass('appearance-none')
    expect(select).toHaveClass('truncate')
    expect(select).toHaveClass('bg-no-repeat')
  })

  it('handles pointer events correctly', async () => {
    const user = userEvent.setup()
    const setValue = vi.fn()
    
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    const select = screen.getByRole('combobox')
    
    // Initially should have focus class
    expect(select).toHaveClass('add-focus')
    
    // Simulate mouse pointer down
    await user.pointer({ keys: '[MouseLeft>]', target: select })
    
    // Should remove focus class when using pointer
    expect(select).not.toHaveClass('add-focus')
  })

  it('applies correct background image styling based on size', () => {
    const setValue = vi.fn()
    
    // Test base size
    const { rerender } = render(<Select options={mockOptions} setValue={setValue} value="" size="base" />)
    let select = screen.getByRole('combobox')
    expect(select.style.backgroundSize).toBe('16px')
    
    // Test medium size
    rerender(<Select options={mockOptions} setValue={setValue} value="" size="md" />)
    select = screen.getByRole('combobox')
    expect(select.style.backgroundSize).toBe('14px')
    
    // Test small size
    rerender(<Select options={mockOptions} setValue={setValue} value="" size="sm" />)
    select = screen.getByRole('combobox')
    expect(select.style.backgroundSize).toBe('12px')
  })

  it('has caret background image', () => {
    const setValue = vi.fn()
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    const select = screen.getByRole('combobox')
    expect(select.style.backgroundImage).toContain('caret.svg')
  })

  it('blurs select after value change', async () => {
    const user = userEvent.setup()
    const setValue = vi.fn()
    
    render(<Select options={mockOptions} setValue={setValue} value="" />)
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'option1')
    
    // Check that blur was called (select should not have focus)
    expect(document.activeElement).not.toBe(select)
  })
})