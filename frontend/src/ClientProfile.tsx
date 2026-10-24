
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ClientAccount } from './ClientAuth'
import { apiRequest } from './api'
import './ClientProfile.css'

type ClientApplication = {
  id: number
  code: string
  info: string
  device: string
  device_model: string
  created_at: string
  status: string
  status_info: number
}

type ClientProfileProps = {
  client: ClientAccount
  onLogout: () => void
}

export default function ClientProfile({
  client,
  onLogout,
}: ClientProfileProps) {
  const [applications, setApplications] = useState<ClientApplication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [device, setDevice] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successCode, setSuccessCode] = useState('')

  const loadApplications = useCallback(async () => {
    try {
      const data = await apiRequest<ClientApplication[]>(
        '/client/applications'
      )
      setApplications(data)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить заявки.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessCode('')

    if (
      !device.trim() ||
      !deviceModel.trim() ||
      !description.trim() ||
      !address.trim()
    ) {
      setError('Заполни все поля заявки.')
      return
    }

    setSubmitting(true)

    try {
      const created = await apiRequest<ClientApplication>(
        '/client/applications',
        {
          method: 'POST',
          body: {
            device: device.trim(),
            device_model: deviceModel.trim(),
            info: description.trim(),
            address: address.trim(),
          },
        }
      )

      setApplications((previous) => [created, ...previous])
      setSuccessCode(created.code)
      setDevice('')
      setDeviceModel('')
      setDescription('')
      setAddress('')
      setShowForm(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать заявку.'
      )
    } finally {
      setSubmitting(false)
    }
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
            <h1>Привет, {client.name.split(' ')[0]}!</h1>
            <p>
              Оформляй заявки и следи за ремонтом своей техники.
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
              <div className="client-profile-eyebrow">
                ИСТОРИЯ ОБРАЩЕНИЙ
              </div>
              <h2>Мои заявки</h2>
            </div>

            <button
              className="client-create-button"
              type="button"
              onClick={() => {
                setShowForm((value) => !value)
                setError('')
                setSuccessCode('')
              }}
            >
              {showForm ? 'Отмена' : '+ Новая заявка'}
            </button>
          </div>

          {successCode && (
            <div className="client-success-message">
              <strong>Заявка создана!</strong>
              <p>
                Сохрани код заявки — он понадобится для обращения в сервис.
              </p>
              <div className="client-code-row">
                <code>{successCode}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(successCode)
                  }}
                >
                  Копировать код
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form
              className="client-application-form"
              onSubmit={handleSubmit}
            >
              <h3>Информация об устройстве</h3>

              <label htmlFor="client-device">Тип устройства</label>
              <input
                id="client-device"
                value={device}
                onChange={(event) => setDevice(event.target.value)}
                placeholder="Например, ноутбук"
                maxLength={1000}
                required
              />

              <label htmlFor="client-model">Модель устройства</label>
              <input
                id="client-model"
                value={deviceModel}
                onChange={(event) => setDeviceModel(event.target.value)}
                placeholder="Например, ASUS VivoBook 15"
                maxLength={1000}
                required
              />

              <label htmlFor="client-description">
                Описание неисправности
              </label>
              <textarea
                id="client-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Что произошло с устройством?"
                rows={4}
                maxLength={1000}
                required
              />

              <label htmlFor="client-address">Адрес</label>
              <input
                id="client-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Адрес для оформления заявки"
                maxLength={1000}
                required
              />

              {error && <p className="client-form-error">{error}</p>}

              <button
                className="client-create-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          )}

          {error && !showForm && (
            <div className="client-form-error">
              {error}
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  void loadApplications()
                }}
              >
                Повторить
              </button>
            </div>
          )}

          {loading ? (
            <div className="client-empty-state">
              Загружаем заявки...
            </div>
          ) : applications.length === 0 ? (
            <div className="client-empty-state">
              <div className="client-empty-icon">＋</div>
              <h3>Пока нет заявок</h3>
              <p>
                Создай первую заявку, чтобы начать работу с сервисным центром.
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
              {applications.map((application) => (
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

                  <h3>{application.device} — {application.device_model}</h3>
                  <p>{application.info}</p>

                  <div className="client-application-meta">
                    <span>
                      Создана: {new Date(application.created_at).toLocaleString('ru-RU')}
                    </span>
                    <span>Код: {application.code}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
