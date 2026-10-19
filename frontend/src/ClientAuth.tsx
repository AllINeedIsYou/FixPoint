
import { useState } from 'react'
import './ClientAuth.css'

// Данные клиента для демонстрационного режима
export type ClientAccount = {
  id: number
  name: string
  phone: string
  email: string
  password: string
}

type ClientAuthProps = {
  onSuccess: (client: ClientAccount) => void
  onBack: () => void
  accounts: ClientAccount[]
  onRegister: (client: ClientAccount) => void
}

export default function ClientAuth({
  onSuccess,
  onBack,
  accounts,
  onRegister,
}: ClientAuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (mode === 'register') {
      if (!name.trim() || !phone.trim() || !email.trim() || !password) {
        setError('Заполни все поля')
        return
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError('Проверь адрес электронной почты')
        return
      }

      if (password.length < 6) {
        setError('Пароль должен содержать не менее 6 символов')
        return
      }

      const normalizedEmail = email.trim().toLowerCase()

      if (
        accounts.some(
          client => client.email.toLowerCase() === normalizedEmail
        )
      ) {
        setError('Аккаунт с такой почтой уже существует')
        return
      }

      const client: ClientAccount = {
        id: Math.max(0, ...accounts.map(item => item.id)) + 1,
        name: name.trim(),
        phone: phone.trim(),
        email: normalizedEmail,
        password,
      }

      onRegister(client)
      onSuccess(client)
      return
    }

    const client = accounts.find(
      item =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password
    )

    if (!client) {
      setError('Неверная почта или пароль')
      return
    }

    onSuccess(client)
  }

  return (
    <main className="client-auth-page">
      <section className="client-auth-card">
        <button
          type="button"
          className="client-auth-back"
          onClick={onBack}
        >
          ← На главную
        </button>

        <div className="client-auth-brand">
          <span className="client-auth-logo">F</span>
          <div>
            <strong>FixPoint</strong>
            <span>СЕРВИСНЫЙ ЦЕНТР</span>
          </div>
        </div>

        <p className="client-auth-eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>

        <h1>
          {mode === 'register' ? 'Создать аккаунт' : 'С возвращением'}
        </h1>

        <p className="client-auth-description">
          {mode === 'register'
            ? 'Зарегистрируйся, чтобы создавать заявки и следить за ремонтом.'
            : 'Войди, чтобы посмотреть свои заявки и профиль.'}
        </p>

        <div className="client-auth-tabs">
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Регистрация
          </button>

          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Вход
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label htmlFor="client-name">Имя и фамилия</label>
              <input
                id="client-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Как к вам обращаться"
                autoComplete="name"
                required
              />

              <label htmlFor="client-phone">Телефон</label>
              <input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="+7 900 000-00-00"
                autoComplete="tel"
                required
              />
            </>
          )}

          <label htmlFor="client-email">Электронная почта</label>
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="client-password">Пароль</label>
          <input
            id="client-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Не менее 6 символов"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            minLength={6}
            required
          />

          {error && <p className="client-auth-error">{error}</p>}

          <button className="client-auth-submit" type="submit">
            {mode === 'register' ? 'Зарегистрироваться' : 'Войти в аккаунт'}
            <span>↗</span>
          </button>
        </form>

        <p className="client-auth-note">
          {mode === 'register'
            ? 'Уже есть аккаунт? Нажми «Вход» выше.'
            : 'Впервые у нас? Переключись на регистрацию.'}
        </p>
      </section>
    </main>
  )
}
