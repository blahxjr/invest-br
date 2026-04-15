// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('should not render when open is false', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        description="This action cannot be undone"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone')).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    const confirmButton = screen.getByRole('button', { name: /Confirmar/ })
    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    const cancelButton = screen.getByRole('button', { name: /Cancelar/ })
    fireEvent.click(cancelButton)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when X button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    const closeButton = screen.getByLabelText('Fechar')
    fireEvent.click(closeButton)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should apply danger styling when variant is danger', () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        variant="danger"
      />
    )
    const confirmButton = screen.getByRole('button', { name: /Confirmar/ })
    expect(confirmButton).toHaveClass('bg-red-600')
  })

  it('should disable buttons when isLoading is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )
    const confirmButton = screen.getByRole('button', { name: /Processando/ })
    const cancelButton = screen.getByRole('button', { name: /Cancelar/ })
    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it('should use custom button text', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmText="Deletar"
        cancelText="Manter"
      />
    )
    expect(screen.getByRole('button', { name: /Deletar/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manter/ })).toBeInTheDocument()
  })
})
