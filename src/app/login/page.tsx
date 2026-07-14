'use client'
import { useActionState } from 'react'
import { loginAction } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F3D7A 0%, #16A99C 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(15,61,122,.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="CE Viaja"
            style={{ height: 64, marginBottom: 16, display: 'inline-block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ fontSize: 13, color: '#5B7186', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Portal de Vendedoras
          </div>
        </div>

        <form action={formAction}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D5A73', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '13px 14px',
                border: '1.5px solid #D4DEE9',
                borderRadius: 10,
                fontSize: 15,
                color: '#15293F',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <div style={{
              background: '#FFF0F0',
              border: '1px solid #FFD0D0',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#C0392B',
              marginBottom: 16,
            }}>
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              width: '100%',
              padding: '13px',
              background: pending ? '#9AA8B8' : 'linear-gradient(135deg, #0F3D7A, #16A99C)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
              letterSpacing: '.03em',
            }}
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
