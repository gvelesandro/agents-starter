import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders textarea element', () => {
    render(<Textarea placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('handles text input', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Type here" />)
    
    const textarea = screen.getByPlaceholderText('Type here')
    await user.type(textarea, 'Hello world')
    
    expect(textarea).toHaveValue('Hello world')
  })

  it('can be disabled', () => {
    render(<Textarea placeholder="Disabled textarea" disabled />)
    const textarea = screen.getByPlaceholderText('Disabled textarea')
    expect(textarea).toBeDisabled()
    expect(textarea).toHaveClass('disabled:cursor-not-allowed')
    expect(textarea).toHaveClass('disabled:opacity-50')
  })

  it('applies custom className', () => {
    render(<Textarea placeholder="Custom textarea" className="custom-class" />)
    const textarea = screen.getByPlaceholderText('Custom textarea')
    expect(textarea).toHaveClass('custom-class')
  })

  it('has default styling classes', () => {
    render(<Textarea placeholder="Styled textarea" />)
    const textarea = screen.getByPlaceholderText('Styled textarea')
    
    expect(textarea).toHaveClass('flex')
    expect(textarea).toHaveClass('min-h-[80px]')
    expect(textarea).toHaveClass('w-full')
    expect(textarea).toHaveClass('rounded-md')
    expect(textarea).toHaveClass('border')
    expect(textarea).toHaveClass('bg-background')
    expect(textarea).toHaveClass('px-3')
    expect(textarea).toHaveClass('py-2')
    expect(textarea).toHaveClass('text-sm')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Textarea ref={ref} placeholder="Ref textarea" />)
    expect(ref).toHaveBeenCalled()
  })

  it('shows initial value', () => {
    render(<Textarea defaultValue="Initial content" placeholder="Textarea" />)
    expect(screen.getByDisplayValue('Initial content')).toBeInTheDocument()
  })

  it('handles onChange events', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    
    render(<Textarea onChange={handleChange} placeholder="Change textarea" />)
    
    const textarea = screen.getByPlaceholderText('Change textarea')
    await user.type(textarea, 'New text')
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('has proper focus styling classes', () => {
    render(<Textarea placeholder="Focus textarea" />)
    const textarea = screen.getByPlaceholderText('Focus textarea')
    
    expect(textarea).toHaveClass('focus-visible:outline-none')
    expect(textarea).toHaveClass('focus-visible:ring-2')
    expect(textarea).toHaveClass('focus-visible:ring-ring')
    expect(textarea).toHaveClass('focus-visible:ring-offset-2')
  })

  it('has proper placeholder styling', () => {
    render(<Textarea placeholder="Placeholder text" />)
    const textarea = screen.getByPlaceholderText('Placeholder text')
    expect(textarea).toHaveClass('placeholder:text-muted-foreground')
  })

  it('passes through additional props', () => {
    render(<Textarea placeholder="Props textarea" rows={5} maxLength={100} />)
    const textarea = screen.getByPlaceholderText('Props textarea')
    expect(textarea).toHaveAttribute('rows', '5')
    expect(textarea).toHaveAttribute('maxLength', '100')
  })
})