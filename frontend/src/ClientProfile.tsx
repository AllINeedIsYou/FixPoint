
import { useState } from 'react'
import type { ClientAccount } from './ClientAuth'
import './ClientProfile.css'

type ClientApplication = {
  id: number
  client: string
  clientId?: number
  device: string
  status: string
  description?: string
}

type ClientProfileProps = {
  client: ClientAccount
  applications: ClientApplication[]
  onCreateApplication: (device: string, description: string) => void
  onLogout: () => void
}

export default function ClientProfile({
  client,
  applications,
  onCreateApplication,
  onLogout,
}: ClientProfileProps) {
  const [showForm, setShowForm] = useState(false)
  const [device, setDevice] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const myApplications = applications.filter(
    (application) => application.clientId === client.id
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!device.trim() || !description.trim()) {
      setError('Заполни оба поля, чтобы оформить заявку.')
      return
    }

    onCreateApplication(device.trim(), description.trim())
    setDevice('')
    setDescription('')
    setError('')
    setShowForm(false)
  }

  return (
    <div className="client-profile">
      <header className="client-profile-header">
        <a className="client-profile-logo" href="#profile">
          <span className="client-profile-logo-icon">F</span>
          <span>
            <strong>FixPoint</strong>
            <small>ЛИЧНЫЙ КАБИНЕТ</small>
          </span>
        </a>

        <button
          className="client-logout-button"
          type="button"
          onClick={onLogout}
        >
          Выйти
        </button>
      </header>

      <main className="client-profile-main">
        <section className="client-welcome">
          <div>
            <div className="client-profile-eyebrow">
              ЛИЧНЫЙ КАБИНЕТ КЛИЕНТА
            </div>
            <h1>
              Привет, {client.name.split(' ')[0]}!
            </h1>
            <p>
              Здесь ты можешь оформить заявку и следить за ремонтом своей техники.
            </p>
          </div>

          <div className="client-avatar">
            {client.name.trim().charAt(0).toUpperCase()}
          </div>
        </section>

        <section className="client-info-card">
          <div>
            <span>Имя</span>
            <strong>{client.name}</strong>
          </div>
          <div>
            <span>Телефон</span>
            <strong>{client.phone}</strong>
          </div>
          <div>
            <span>Электронная почта</span>
            <strong>{client.email}</strong>
          </div>
        </section>

        <section className="client-applications-section">
          <div className="client-section-heading">
            <div>
              <div className="client-profile-eyebrow">ИСТОРИЯ ОБРАЩЕНИЙ</div>
              <h2>Мои заявки</h2>
            </div>

            <button
              className="client-create-button"
              type="button"
              onClick={() => {
                setShowForm(!showForm)
                setError('')
              }}
            >
              {showForm ? 'Отмена' : '+ Новая заявка'}
            </button>
          </div>

          {showForm && (
            <form className="client-application-form" onSubmit={handleSubmit}>
              <h3>Расскажи о своей технике</h3>

              <label htmlFor="client-device">Устройство</label>
              <input
                id="client-device"
                value={device}
                onChange={(event) => setDevice(event.target.value)}
                placeholder="Например, ноутбук ASUS"
              />

              <label htmlFor="client-description">Что случилось?</label>
              <textarea
                id="client-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Опиши неисправность"
                rows={4}
              />

              {error && <p className="client-form-error">{error}</p>}

              <button className="client-create-button" type="submit">
                Отправить заявку
              </button>
            </form>
          )}

          {myApplications.length === 0 ? (
            <div className="client-empty-state">
              <div className="client-empty-icon">＋</div>
              <h3>Пока нет заявок</h3>
              <p>
                Когда понадобится помощь с техникой, создай первую заявку здесь.
              </p>
              {!showForm && (
                <button
                  className="client-create-button"
                  type="button"
                  onClick={() => setShowForm(true)}
                >
                  Создать заявку
                </button>
              )}
            </div>
          ) : (
            <div className="client-application-list">
              {myApplications.map((application) => (
                <article
                  className="client-application-card"
                  key={application.id}
                >
                  <div className="client-application-card-top">
                    <span>Заявка №{application.id}</span>
                    <span className="client-application-status">
                      {application.status}
                    </span>
                  </div>
                  <h3>{application.device}</h3>
                  {application.description && <p>{application.description}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
