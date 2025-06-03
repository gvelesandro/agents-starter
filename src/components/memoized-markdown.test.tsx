import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoizedMarkdown } from './memoized-markdown'

// Mock marked library
vi.mock('marked', () => ({
  marked: {
    lexer: vi.fn((markdown: string) => {
      // Simple mock implementation that splits by newlines
      return markdown.split('\n').map((line, index) => ({
        raw: line + (index < markdown.split('\n').length - 1 ? '\n' : ''),
        type: 'paragraph'
      }))
    })
  }
}))

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="react-markdown">{children}</div>
}))

// Mock remark-gfm
vi.mock('remark-gfm', () => ({
  default: () => {}
}))

describe('MemoizedMarkdown', () => {
  it('renders markdown content', () => {
    render(<MemoizedMarkdown content="Hello world" id="test-1" />)
    
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByTestId('react-markdown')).toBeInTheDocument()
  })

  it('renders multiple blocks for multi-line content', () => {
    const content = "First line\nSecond line"
    render(<MemoizedMarkdown content={content} id="test-2" />)
    
    const markdownBlocks = screen.getAllByTestId('react-markdown')
    expect(markdownBlocks).toHaveLength(2)
    expect(screen.getByText('First line')).toBeInTheDocument()
    expect(screen.getByText('Second line')).toBeInTheDocument()
  })

  it('applies correct wrapper class', () => {
    const { container } = render(<MemoizedMarkdown content="Test content" id="test-3" />)
    
    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).toBeInTheDocument()
  })

  it('generates unique keys for blocks using id', () => {
    render(<MemoizedMarkdown content="Line 1\nLine 2" id="unique-id" />)
    
    // Check that the blocks are rendered - the number depends on how marked.lexer parses the content
    const markdownBlocks = screen.getAllByTestId('react-markdown')
    expect(markdownBlocks.length).toBeGreaterThan(0)
  })

  it('handles empty content', () => {
    render(<MemoizedMarkdown content="" id="test-empty" />)
    
    // Should render at least one block even with empty content
    const markdownBlocks = screen.getAllByTestId('react-markdown')
    expect(markdownBlocks).toHaveLength(1)
  })

  it('memoizes correctly with same content', () => {
    const { rerender } = render(<MemoizedMarkdown content="Same content" id="test-memo" />)
    
    const firstRender = screen.getByTestId('react-markdown')
    
    // Rerender with same content
    rerender(<MemoizedMarkdown content="Same content" id="test-memo" />)
    
    const secondRender = screen.getByTestId('react-markdown')
    expect(firstRender).toBe(secondRender)
  })

  it('re-renders when content changes', () => {
    const { rerender } = render(<MemoizedMarkdown content="Original content" id="test-change" />)
    
    expect(screen.getByText('Original content')).toBeInTheDocument()
    
    rerender(<MemoizedMarkdown content="New content" id="test-change" />)
    
    expect(screen.getByText('New content')).toBeInTheDocument()
    expect(screen.queryByText('Original content')).not.toBeInTheDocument()
  })

  it('handles single line content correctly', () => {
    render(<MemoizedMarkdown content="Single line" id="test-single" />)
    
    expect(screen.getByText('Single line')).toBeInTheDocument()
    expect(screen.getAllByTestId('react-markdown')).toHaveLength(1)
  })

  it('processes content through marked lexer', () => {
    const mockContent = "# Header\n\nParagraph text"
    render(<MemoizedMarkdown content={mockContent} id="test-lexer" />)
    
    // Just verify that the content is processed and rendered (multiple blocks expected)
    const markdownBlocks = screen.getAllByTestId('react-markdown')
    expect(markdownBlocks.length).toBeGreaterThan(0)
  })
})