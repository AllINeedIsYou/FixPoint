
import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './api'
import './DeliveryPage.css'

type DeliveryStatus =
  | 'created'
  | 'courier_dispatched'
  | 'courier_picked_up'
  | 'arrived'

type DeliveryApplication = {
  id: number
  FIO: string
  number: string
  email: string
  device: string
  device_model?: string | null
  info?: string | null
  status: string
  source: string
  source_label: string
  courier_visit_at: string | null
  delivery_status: DeliveryStatus | null
  next_delivery_status: DeliveryStatus | null
  next_delivery_action: string | null
}

type DeliveryPageProps = {
  token: string
}

const deliveryLabels: Record<DeliveryStatus, string> = {
  created: 'Ожидает курьера',
  courier_dispatched: 'Курьер выехал',
  courier_picked_up: 'Устройство забрано',
  arrived: 'Прибыло в сервис',
}

const actionLabels: Record<string, string> = {
  courier_dispatched: 'Отметить выезд курьера',
  courier_picked_up: 'Отметить получение устройства',
  arrived: 'Подтвердить прибытие в сервис',
}

function formatVisitDate(value: string | null) {
  if (!value) return 'Время не указано'

  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DeliveryPage({ token }: DeliveryPageProps) {
  const [deliveries, setDeliveries] = useState<DeliveryApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadDeliveries = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest<DeliveryApplication[]>(
        '/operator/deliveries',
        { token }
      )

      setDeliveries(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить доставки'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadDeliveries()
  }, [loadDeliveries])

  async function handleDeliveryAction(application: DeliveryApplication) {
    const nextStatus = application.next_delivery_status

    if (!nextStatus || nextStatus === 'created') return

    setUpdatingId(application.id)
    setError('')

    try {
      await apiRequest<DeliveryApplication>(
        `/operator/${application.id}/delivery`,
        {
          method: 'POST',
          token,
          body: { status: nextStatus },
        }
      )

      // После изменения заново получаем очередь с сервера.
      await loadDeliveries()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось изменить этап доставки'
      )

      // Обновляем данные на случай, если этап уже изменился.
      await loadDeliveries()
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="delivery-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-label">РАБОТА С КЛИЕНТАМИ</p>
          <h1>Курьерская доставка</h1>
          <p className="delivery-description">
            Онлайн-заявки и контроль движения устройств до сервисного центра.
          </p>
        </div>

        <button
          className="delivery-refresh"
          onClick={() => void loadDeliveries()}
          disabled={loading}
        >
          Обновить
        </button>
      </header>

      <div className="delivery-summary">
        <div className="delivery-summary-card">
          <span>В очереди</span>
          <strong>{deliveries.length}</strong>
        </div>

        <div className="delivery-summary-card">
          <span>Ожидают курьера</span>
          <strong>
            {deliveries.filter(
              (item) => item.delivery_status === 'created'
            ).length}
          </strong>
        </div>

        <div className="delivery-summary-card">
          <span>Уже забраны</span>
          <strong>
            {deliveries.filter(
              (item) => item.delivery_status === 'courier_picked_up'
            ).length}
          </strong>
        </div>
      </div>

      {error && (
        <div className="delivery-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="delivery-message">Загружаем доставки...</p>
      ) : deliveries.length === 0 ? (
        <div className="delivery-empty">
          <h2>Пока нет активных доставок</h2>
          <p>
            Здесь появятся онлайн-заявки, для которых клиент заказал курьера.
          </p>
        </div>
      ) : (
        <div className="delivery-list">
          {deliveries.map((application) => {
            const status = application.delivery_status ?? 'created'
            const nextAction = application.next_delivery_status

            return (
              <article
                className="delivery-card"
                key={application.id}
              >
                <div className="delivery-card-top">
                  <span className="delivery-number">
                    Заявка №{application.id}
                  </span>

                  <span className={`delivery-status status-${status}`}>
                    {deliveryLabels[status]}
                  </span>
                </div>

                <div className="delivery-client">
                  <h2>{application.FIO}</h2>
                  <span>{application.number}</span>
                  <span>{application.email}</span>
                </div>

                <div className="delivery-device">
                  <strong>
                    {[application.device, application.device_model]
                      .filter(Boolean)
                      .join(' — ')}
                  </strong>

                  {application.info && (
                    <p>{application.info}</p>
                  )}
                </div>

                <div className="delivery-time">
                  <span>Время встречи с курьером</span>
                  <strong>
                    {formatVisitDate(application.courier_visit_at)}
                  </strong>
                </div>

                <div className="delivery-progress">
                  {(
                    [
                      'created',
                      'courier_dispatched',
                      'courier_picked_up',
                      'arrived',
                    ] as DeliveryStatus[]
                  ).map((step, index) => {
                    const currentIndex = [
                      'created',
                      'courier_dispatched',
                      'courier_picked_up',
                      'arrived',
                    ].indexOf(status)

                    return (
                      <div
                        className={`delivery-step ${
                          index <= currentIndex ? 'completed' : ''
                        }`}
                        key={step}
                      >
                        <span className="delivery-step-dot" />
                        <span>{deliveryLabels[step]}</span>
                      </div>
                    )
                  })}
                </div>

                {nextAction && nextAction !== 'created' ? (
                  <button
                    className="delivery-action"
                    onClick={() => void handleDeliveryAction(application)}
                    disabled={updatingId === application.id}
                  >
                    {updatingId === application.id
                      ? 'Сохраняем...'
                      : actionLabels[nextAction] ?? 'Следующий этап'}
                  </button>
                ) : (
                  <div className="delivery-finished">
                    Устройство прибыло в сервисный центр
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default DeliveryPage
