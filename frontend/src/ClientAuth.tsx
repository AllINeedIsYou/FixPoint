
import { useState, type FormEvent } from 'react'
import { apiRequest } from './api'
import './ClientAuth.css'

export type ClientAccount = {
  id: number
  name: string
  phone: string
  email: string
  login: string
}

type ClientAuthProps = {
  onSuccess: (client: ClientAccount) => void
  onBack: () => void
  accounts: ClientAccount[]
  onRegister: (client: ClientAccount) => void
}

type ClientApiResponse = {
  id: number
  FIO: string
  number: string
  email: string
  login: string
  created_at: string
}

export default function ClientAuth({
  onSuccess,
  onBack,
  onRegister,
}: ClientAuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [applicationCode, setApplicationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function convertClient(data: ClientApiResponse): ClientAccount {
    return {
      id: data.id,
      name: data.FIO,
      phone: data.number,
      email: data.email,
      login: data.login,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        const body = {
          FIO: name.trim(),
          number: phone.trim(),
          email: email.trim().toLowerCase(),
          login: login.trim(),
          password,
          ...(applicationCode.trim()
            ? { application_code: applicationCode.trim().toUpperCase() }
            : {}),
        }

        await apiRequest<ClientApiResponse>(
          '/auth/client/register',
          {
            method: 'POST',
            body,
          }
        )

        // Регистрация создаёт аккаунт. Затем клиент входит в него.
        const loginData = await apiRequest<ClientApiResponse>(
          '/auth/client/login',
          {
            method: 'POST',
            body: {
              username: body.login,
              password,
            },
          }
        )

        const client = convertClient(loginData)
        onRegister(client)
        onSuccess(client)
        return
      }

      const data = await apiRequest<ClientApiResponse>(
        '/auth/client/login',
        {
          method: 'POST',
          body: {
            username: login.trim(),
            password,
          },
        }
      )

      onSuccess(convertClient(data))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось выполнить запрос. Проверь соединение с сервером.'
      )
    } finally {
      setLoading(false)
    }
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
              <label htmlFor="client-name">ФИО</label>
              <input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Имя и фамилия"
                autoComplete="name"
                required
              />

              <label htmlFor="client-phone">Телефон</label>
              <input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 900 000-00-00"
                autoComplete="tel"
                required
              />

              <label htmlFor="client-email">Электронная почта</label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />

              <label htmlFor="client-login">Придумай логин</label>
              <input
                id="client-login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Латинские буквы, цифры, _ . -"
                autoComplete="username"
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9_.-]+"
                required
              />

              <label htmlFor="client-code">
                Код прежней заявки (необязательно)
              </label>
              <input
                id="client-code"
                value={applicationCode}
                onChange={(event) => setApplicationCode(event.target.value)}
                placeholder="8 латинских букв или цифр"
                minLength={8}
                maxLength={8}
                autoComplete="off"
              />
            </>
          )}

          {mode === 'login' && (
            <>
              <label htmlFor="client-login">Логин</label>
              <input
                id="client-login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Твой логин"
                autoComplete="username"
                required
              />
            </>
          )}

          <label htmlFor="client-password">Пароль</label>
          <input
            id="client-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Не менее 8 символов"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            minLength={mode === 'register' ? 8 : 1}
            maxLength={128}
            required
          />

          {error && <p className="client-auth-error">{error}</p>}

          <button
            className="client-auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Подожди...'
              : mode === 'register'
                ? 'Зарегистрироваться'
                : 'Войти в аккаунт'}
            {!loading && <span>↗</span>}
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
