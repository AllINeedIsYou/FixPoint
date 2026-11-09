import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './api'
import './ClientsPage.css'

type OperatorClient = {
  id: number
  FIO: string
  number: string
  email: string
  application_ids: number[]
}

type ClientApplication = {
  id: number
  FIO: string
  device: string
  device_model: string
  info: string
  status: string
  status_info: number
}

type ClientsPageProps = {
  token: string
  onOpenApplication: (id: number) => void
}

export default function ClientsPage({ token, onOpenApplication }: ClientsPageProps) {
  const [clients, setClients] = useState<OperatorClient[]>([])
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<OperatorClient | null>(null)
  const [clientApplications, setClientApplications] = useState<ClientApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedClientId = selectedClient?.id

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      const data = await apiRequest<OperatorClient[]>(`/operator/clients${query}`, { token })
      setClients(data)
      if (selectedClientId !== undefined) {
        const refreshed = data.find((item) => item.id === selectedClientId)
        setSelectedClient(refreshed ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить клиентов')
    } finally {
      setLoading(false)
    }
  }, [search, token, selectedClientId])

  useEffect(() => { void loadClients() }, [loadClients])

  async function openClient(client: OperatorClient) {
    setSelectedClient(client)
    setClientApplications([])
    setHistoryLoading(true)
    setError('')
    try {
      const data = await apiRequest<ClientApplication[]>(
        `/operator/clients/${client.id}/applications`, { token },
      )
      setClientApplications(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю клиента')
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <section className="dashboard-content operator-clients-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-label">РАБОТА С КЛИЕНТАМИ</p>
          <h1>Клиенты</h1>
          <p className="operator-clients-description">Контактные данные и история обращений из базы FixPoint.</p>
        </div>
        <button className="operator-clients-refresh" onClick={() => void loadClients()} disabled={loading}>Обновить</button>
      </header>

      <div className="operator-clients-layout">
        <section className="operator-clients-list-panel">
          <h2>Список клиентов</h2>
          <input
            className="operator-clients-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по ФИО или телефону"
          />
          {loading ? <p>Загружаем клиентов...</p> : clients.length === 0 ? <p>Клиенты не найдены.</p> : (
            <div className="operator-clients-list">
              {clients.map((client) => (
                <button
                  type="button"
                  key={client.id}
                  className={`operator-client-card ${selectedClient?.id === client.id ? 'selected' : ''}`}
                  onClick={() => void openClient(client)}
                >
                  <strong>{client.FIO}</strong>
                  <span>{client.number}</span>
                  <small>{client.application_ids.length} заявок</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="operator-client-history">
          {!selectedClient ? (
            <div className="operator-client-empty"><h2>История обращений</h2><p>Выбери клиента, чтобы посмотреть его контактные данные и заявки.</p></div>
          ) : (
            <>
              <div className="operator-client-heading">
                <div><p className="dashboard-label">КЛИЕНТ #{selectedClient.id}</p><h2>{selectedClient.FIO}</h2></div>
                <button className="operator-clients-refresh" onClick={() => setSelectedClient(null)}>Закрыть</button>
              </div>
              <div className="operator-client-contacts">
                <div><span>Телефон</span><strong>{selectedClient.number}</strong></div>
                <div><span>Email</span><strong>{selectedClient.email}</strong></div>
              </div>
              <h3>История заявок</h3>
              {historyLoading ? <p>Загружаем историю...</p> : clientApplications.length === 0 ? <p>У клиента пока нет заявок.</p> : (
                <div className="operator-client-applications">
                  {clientApplications.map((application) => (
                    <button type="button" key={application.id} className="operator-client-application" onClick={() => onOpenApplication(application.id)}>
                      <strong>Заявка #{application.id}</strong>
                      <span>{[application.device, application.device_model].filter(Boolean).join(' — ')}</span>
                      <span>{application.status}</span>
                      {application.info && <small>{application.info}</small>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
    </section>
  )
}
