import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthCard } from '@/components/AuthCard'
import LoginPage from '@/app/login/page'
import RegisterPage from '@/app/register/page'
import ForgotPasswordPage from '@/app/forgot-password/page'
import ResetPasswordPage from '@/app/reset-password/page'

const pushMock = vi.fn()
const refreshMock = vi.fn()
const signInMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'test-token-123' : null),
  }),
}))

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

describe('Auth UI Components & Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AuthCard component', () => {
    it('renders title, subtitle, children, and footer', () => {
      render(
        <AuthCard title="Test Title" subtitle="Test Subtitle" footer={<span>Test Footer</span>}>
          <div>Inner Form</div>
        </AuthCard>
      )

      expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument()
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
      expect(screen.getByText('Inner Form')).toBeInTheDocument()
      expect(screen.getByText('Test Footer')).toBeInTheDocument()
    })
  })

  describe('LoginPage', () => {
    it('renders login form and handles sign in errors inline with role="alert"', async () => {
      signInMock.mockResolvedValueOnce({ error: 'CredentialsSignin' })
      render(<LoginPage />)

      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(signInMock).toHaveBeenCalledWith('credentials', {
          email: 'user@example.com',
          password: 'wrongpass',
          redirect: false,
        })
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Invalid email or password.')
      })
    })

    it('redirects to /albums on successful credentials login', async () => {
      signInMock.mockResolvedValueOnce({ ok: true })
      render(<LoginPage />)

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correctpass' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/albums')
        expect(refreshMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('RegisterPage', () => {
    it('shows inline error with role="alert" when API registration fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      }))

      render(<RegisterPage />)

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'existing@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email already exists')
      })
    })
  })

  describe('ForgotPasswordPage', () => {
    it('renders uniform anti-enumeration success message when API returns 200 OK', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }))

      render(<ForgotPasswordPage />)

      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'any@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByText(/If an account exists for that email, we've sent a reset link/i)).toBeInTheDocument()
      })
    })
  })

  describe('ResetPasswordPage', () => {
    it('validates client-side that confirm password matches before calling API', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      render(<ResetPasswordPage />)

      fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'differentpass' } })
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
        expect(fetchSpy).not.toHaveBeenCalled()
      })
    })

    it('calls API and shows success state when passwords match', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }))

      render(<ResetPasswordPage />)

      fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'newpassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newpassword123' } })
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByText(/your password has been successfully reset/i)).toBeInTheDocument()
      })
    })
  })
})
