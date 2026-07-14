'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(_: unknown, formData: FormData) {
  const password = formData.get('password') as string
  if (password === process.env.PORTAL_PASSWORD) {
    const cookieStore = await cookies()
    cookieStore.set('portal_auth', 'ok', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    redirect('/cotizador')
  }
  return { error: 'Contraseña incorrecta' }
}
