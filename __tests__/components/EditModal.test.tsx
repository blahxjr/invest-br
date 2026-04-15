// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { EditModal } from '@/components/ui/EditModal'

describe('EditModal', () => {
  it('should not render when open is false', () => {
    const { container } = render(
      <EditModal open={false} title="Edit" onClose={vi.fn()}>
        <div>Form content</div>
      </EditModal>
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when open is true', () => {
    render(
      <EditModal open={true} title="Edit Transaction" onClose={vi.fn()}>
        <div>Form content here</div>
      </EditModal>
    )
    expect(screen.getByText('Edit Transaction')).toBeInTheDocument()
    expect(screen.getByText('Form content here')).toBeInTheDocument()
  })

  it('should call onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(
      <EditModal open={true} title="Edit" onClose={onClose}>
        <div>Content</div>
      </EditModal>
    )
    const closeButton = screen.getByLabelText('Fechar')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should render children properly', () => {
    const TestContent = () => (
      <form>
        <input type="text" placeholder="Name" />
        <button type="submit">Save</button>
      </form>
    )
    render(
      <EditModal open={true} title="Edit" onClose={vi.fn()}>
        <TestContent />
      </EditModal>
    )
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
  })
})
