// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

// Mock next-auth/react signIn
const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
  })

  it('renderiza o formulário de login com campo de e-mail', () => {
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: /Entrar no InvestBR/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar link de acesso/i })).toBeInTheDocument()
  })

  it('botão fica desabilitado enquanto o campo de e-mail está vazio', () => {
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /Enviar link de acesso/i })
    expect(button).toBeDisabled()
  })

  it('exibe mensagem de sucesso após envio do magic link', async () => {
    mockSignIn.mockResolvedValue({ error: null })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'usuario@teste.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /Enviar link de acesso/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Verifique seu e-mail/i)).toBeInTheDocument()
    })

    expect(mockSignIn).toHaveBeenCalledWith('nodemailer', expect.objectContaining({
      email: 'usuario@teste.com',
      redirect: false,
    }))
  })

  it('exibe mensagem de erro quando signIn retorna erro', async () => {
    mockSignIn.mockResolvedValue({ error: 'EmailSignin' })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'usuario@teste.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /Enviar link de acesso/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível enviar o link/i)).toBeInTheDocument()
    })
  })
})
