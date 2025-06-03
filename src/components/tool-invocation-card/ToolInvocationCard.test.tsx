import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToolInvocationCard } from './ToolInvocationCard'
import { TooltipProvider } from '@/providers/TooltipProvider'

// Mock Phosphor Icons
vi.mock('@phosphor-icons/react', () => ({
  Robot: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="robot-icon" data-size={size} className={className}>🤖</span>
  ),
  CaretDown: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="caret-icon" data-size={size} className={className}>⌄</span>
  )
}))

// Mock shared constants
vi.mock('@/shared', () => ({
  APPROVAL: {
    YES: 'approved',
    NO: 'rejected'
  }
}))

describe('ToolInvocationCard', () => {
  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <TooltipProvider>
        {children}
      </TooltipProvider>
    )
  }

  const mockToolInvocation = {
    toolName: 'Test Tool',
    toolCallId: 'test-123',
    state: 'call' as const,
    args: { param1: 'value1', param2: 42 }
  }

  const mockAddToolResult = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tool invocation card with tool name', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('Test Tool')).toBeInTheDocument()
    expect(screen.getByTestId('robot-icon')).toBeInTheDocument()
  })

  it('shows completed status for non-confirmation tools in result state', () => {
    const completedTool = {
      ...mockToolInvocation,
      state: 'result' as const
    }

    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={completedTool}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('✓ Completed')).toBeInTheDocument()
  })

  it('toggles expansion when header is clicked', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    const toggleButton = screen.getByRole('button')
    const caretIcon = screen.getByTestId('caret-icon')
    
    // Initially expanded (default state)
    expect(caretIcon).toHaveClass('rotate-180')
    
    // Click to collapse
    await user.click(toggleButton)
    expect(caretIcon).not.toHaveClass('rotate-180')
  })

  it('displays tool arguments in JSON format', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('Arguments:')).toBeInTheDocument()
    expect(screen.getByText(/"param1": "value1"/)).toBeInTheDocument()
    expect(screen.getByText(/"param2": 42/)).toBeInTheDocument()
  })

  it('shows approval buttons for tools needing confirmation', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={true}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('Reject')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
  })

  it('calls addToolResult with NO when reject is clicked', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={true}
        addToolResult={mockAddToolResult}
      />
    )
    
    await user.click(screen.getByText('Reject'))
    
    expect(mockAddToolResult).toHaveBeenCalledWith({
      toolCallId: 'test-123',
      result: 'rejected'
    })
  })

  it('calls addToolResult with YES when approve is clicked', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={true}
        addToolResult={mockAddToolResult}
      />
    )
    
    await user.click(screen.getByText('Approve'))
    
    expect(mockAddToolResult).toHaveBeenCalledWith({
      toolCallId: 'test-123',
      result: 'approved'
    })
  })

  it('displays result section for completed tools', () => {
    const toolWithResult = {
      ...mockToolInvocation,
      state: 'result' as const,
      result: {
        content: [{ type: 'text', text: 'Operation completed successfully' }]
      }
    }

    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={toolWithResult}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('Result:')).toBeInTheDocument()
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument()
  })

  it('formats page URL results correctly', () => {
    const toolWithPageUrls = {
      ...mockToolInvocation,
      state: 'result' as const,
      result: {
        content: [
          { 
            type: 'text', 
            text: '\n~ Page URL: https://example.com\n~ Title: Example Site' 
          }
        ]
      }
    }

    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={toolWithPageUrls}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    // The output shows "- ~ Page URL: https://example.com" (keeping the ~)
    expect(screen.getByText(/- ~ Page URL: https:\/\/example.com/)).toBeInTheDocument()
    expect(screen.getByText(/- ~ Title: Example Site/)).toBeInTheDocument()
  })

  it('handles non-content result format', () => {
    const toolWithDirectResult = {
      ...mockToolInvocation,
      state: 'result' as const,
      result: { success: true, data: 'test data' }
    }

    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={toolWithDirectResult}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.getByText('Result:')).toBeInTheDocument()
    expect(screen.getByText(/"success": true/)).toBeInTheDocument()
  })

  it('applies correct styling for confirmation tools', () => {
    const { container } = renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={true}
        addToolResult={mockAddToolResult}
      />
    )
    
    const iconContainer = container.querySelector('.bg-\\[\\#F48120\\]\\/10')
    expect(iconContainer).toBeInTheDocument()
  })

  it('applies correct styling for non-confirmation tools', () => {
    const { container } = renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    const iconContainer = container.querySelector('.bg-\\[\\#F48120\\]\\/5')
    expect(iconContainer).toBeInTheDocument()
  })

  it('has proper robot icon styling', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    const robotIcon = screen.getByTestId('robot-icon')
    expect(robotIcon).toHaveAttribute('data-size', '16')
    expect(robotIcon).toHaveClass('text-[#F48120]')
  })

  it('has proper caret icon styling', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    const caretIcon = screen.getByTestId('caret-icon')
    expect(caretIcon).toHaveAttribute('data-size', '16')
    expect(caretIcon).toHaveClass('text-muted-foreground', 'transition-transform')
  })

  it('does not show approval buttons for tools not needing confirmation', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
  })

  it('does not show result section for call state', () => {
    renderWithProvider(
      <ToolInvocationCard
        toolInvocation={mockToolInvocation}
        toolCallId="test-123"
        needsConfirmation={false}
        addToolResult={mockAddToolResult}
      />
    )
    
    expect(screen.queryByText('Result:')).not.toBeInTheDocument()
  })
})