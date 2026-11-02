import { useEffect, useState } from 'react'
import {
  clients,
  stockParts,
} from './mockData'

import type { UsedPart } from './RepairPartsPanel'
import './App.css'
import HomePage from './HomePage'
//боковая менюшка
import Sidebar from './Sidebar'
//сотрудники для адм
import EmployeesPage, { type Employee } from './pages/EmployeesPage'
//работа с заявками
import ApplicationDetails from './ApplicationDetails'
//регистрация клиентуса
import ClientAuth, { type ClientAccount } from './ClientAuth'
//профиль клиента
import ClientProfile from './ClientProfile'
//импорт апи
import { apiRequest } from './api'
//Эт склад
import StockPage from './StockPage'

function App() {
  // =========================
  // СОСТОЯНИЯ и все для работы выше
  // =========================

  const [showLogin, setShowLogin] = useState(false)

  //КОД ДОСТУПА КОТОРЫЙ ВВОДИТ СОТРУДНИК
  const [accessCode, setAccessCode] = useState('')

  const [error, setError] = useState('')

  // JWT-токен сотрудника, полученный от бэкенда
  const [employeeToken, setEmployeeToken] = useState('')

  // Восстанавливаем сессию сотрудника после перезагрузки страницы
  useEffect(() => {
    const savedToken = localStorage.getItem('fixpoint_employee_token')
    const savedRole = localStorage.getItem('fixpoint_employee_role')

    if (savedToken && savedRole) {
      setEmployeeToken(savedToken)
      setCurrentUser({
        role: savedRole,
        name: savedRole,
      })
    }
  }, [])

  // Настоящий список сотрудников с бэкенда
  const [employeeList, setEmployeeList] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [employeesError, setEmployeesError] = useState('')

  const [currentUser, setCurrentUser] = useState<{
    role: string
    name: string
  } | null>(null)

  // Какая заявка сейчас открыта
  const [selectedApplication, setSelectedApplication] =
    useState<number | null>(null)

  // Какая страница открыта
  const [activePage, setActivePage] = useState(
    () => localStorage.getItem('fixpoint_employee_page') || 'home'
  )

  // Временные статусы заявок
  // Потом это заменю на данные с backend
  const [applicationStatuses, setApplicationStatuses] =
    useState<Record<number, string>>({})

  // Результаты диагностики храним отдельно для каждой заявки
  const [applicationDiagnoses, setApplicationDiagnoses] =
    useState<Record<number, string>>({})

  //реальные заявки, загружаемые с бэкенда
  type ApplicationItem = {
    id: number
    client: string
    clientId?: number
    device: string
    status: string
    description?: string
    diagnosticResult?: string
  }

  const [applicationList, setApplicationList] = useState<ApplicationItem[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsError, setApplicationsError] = useState('')

  //локальные копии моковых данных которые можно изменять
  const [clientList, setClientList] = useState(clients)
  const [stock, setStock] = useState(stockParts)

  // Запчасти, использованные в каждой заявке
  const [applicationParts, setApplicationParts] =
    useState<Record<number, UsedPart[]>>({})

  // --- Авторизация клиентов ---
  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>([])
  const [currentClient, setCurrentClient] = useState<ClientAccount | null>(null)

  // Восстанавливаем сессию клиента после перезагрузки страницы.
  useEffect(() => {
    let cancelled = false

    async function restoreClientSession() {
      try {
        const data = await apiRequest<{
          id: number
          FIO: string
          number: string
          email: string
          login: string
        }>('/auth/client/me')

        if (cancelled) return

        setCurrentClient({
          id: data.id,
          name: data.FIO,
          phone: data.number,
          email: data.email,
          login: data.login,
        })
      } catch {
        // Нет активной сессии — оставляем пользователя на главной.
        if (!cancelled) {
          setCurrentClient(null)
        }
      }
    }

    void restoreClientSession()

    return () => {
      cancelled = true
    }
  }, [])

  const [showClientAuth, setShowClientAuth] = useState(false)

  //поля создания заявок оператором
  const [newApplicationClient, setNewApplicationClient] = useState('')
  const [newApplicationDevice, setNewApplicationDevice] = useState('')

  //поля управления складом
  const [stockSearch, setStockSearch] = useState('')
  const [newPartName, setNewPartName] = useState('')
  const [newPartQuantity, setNewPartQuantity] = useState('1')
  const [newPartPrice, setNewPartPrice] = useState('')

  // Запчасти: здесь оставлен один комплект обработчиков, без дублирующих объявлений.
  // Добавить одну единицу запчасти в заявку
  const handleAddPartToApplication = (
    applicationId: number,
    stockPartId: number
  ) => {
    const part = stock.find((item) => item.id === stockPartId)

    if (!part || part.quantity <= 0) {
      return
    }

    // Уменьшаем остаток на складе
    setStock((prev) =>
      prev.map((item) =>
        item.id === stockPartId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    )

    // Добавляем деталь в заявку или увеличиваем её количество
    setApplicationParts((prev) => {
      const currentParts = prev[applicationId] ?? []
      const existingPart = currentParts.find(
        (item) => item.stockPartId === stockPartId
      )

      if (existingPart) {
        return {
          ...prev,
          [applicationId]: currentParts.map((item) =>
            item.stockPartId === stockPartId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        }
      }

      const newPart: UsedPart = {
        stockPartId: part.id,
        name: part.name,
        price: part.price,
        quantity: 1,
      }

      return {
        ...prev,
        [applicationId]: [...currentParts, newPart],
      }
    })
  }

  // Убрать одну единицу запчасти из заявки и вернуть её на склад
  const handleRemovePartFromApplication = (
    applicationId: number,
    stockPartId: number
  ) => {
    const currentParts = applicationParts[applicationId] ?? []
    const usedPart = currentParts.find(
      (item) => item.stockPartId === stockPartId
    )

    if (!usedPart) {
      return
    }

    setStock((prev) =>
      prev.map((item) =>
        item.id === stockPartId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )

    setApplicationParts((prev) => {
      const updatedParts = (prev[applicationId] ?? [])
        .map((item) =>
          item.stockPartId === stockPartId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)

      return {
        ...prev,
        [applicationId]: updatedParts,
      }
    })
  }

  // =========================
  // ВХОД
  // =========================

  // создание тестовой заявки оператором
  const handleAddApplication = () => {
    if (!newApplicationClient.trim() || !newApplicationDevice.trim()) {
      setError('Заполни имя клиента и устройство')
      return
    }

    const nextId =
      Math.max(0, ...applicationList.map((item) => item.id)) + 1

    const newApplication = {
      id: nextId,
      client: newApplicationClient.trim(),
      device: newApplicationDevice.trim(),
      status: 'Новая',
    }

    // добавляем заявку в список
    setApplicationList((prev) => [newApplication, ...prev])

    // проверка существует ли уже такой клиент
    const clientExists = clientList.some(
      (client) =>
        client.name.toLowerCase() === newApplication.client.toLowerCase()
    )

    // добавить клиента если нет, но не сохр пока
    if (!clientExists) {
      const nextClientId =
        Math.max(0, ...clientList.map((client) => client.id)) + 1

      setClientList((prev) => [
        ...prev,
        {
          id: nextClientId,
          name: newApplication.client,
          phone: 'Не указан',
        },
      ])
    }

    setNewApplicationClient('')
    setNewApplicationDevice('')
    setError('')
    setActivePage('applications')
  }


  // =========================
  // ЗАГРУЗКА ЗАЯВОК С BACKEND
  // =========================

  // Преобразуем статус сервера в статус, который понимает интерфейс
  function normalizeApplicationStatus(status: string): string {
    const value = status.toLowerCase()

    if (value.includes('создана') || value.includes('ожидание диагностики')) {
      return 'Новая'
    }

    if (value.includes('диагностик')) {
      return 'Диагностика'
    }

    if (value.includes('ожидание ремонта')) {
      return 'Ожидание ремонта'
    }

    if (value.includes('ремонт')) {
      return 'В ремонте'
    }

    if (value.includes('готов')) {
      return 'Готово'
    }

    return status
  }

  async function loadApplications() {
    if (!employeeToken) return

    setApplicationsLoading(true)
    setApplicationsError('')

    try {
      const data = await apiRequest<
        {
          id: number
          client_id: number
          FIO: string
          device: string
          device_model?: string | null
          info?: string | null
          status: string
          diagnostic_result?: string | null
        }[]
      >('/services/get_applications', {
        token: employeeToken,
      })

      setApplicationList(
        data.map((item) => ({
          id: item.id,
          client: item.FIO,
          clientId: item.client_id,
          device: [item.device, item.device_model]
            .filter(Boolean)
            .join(' — '),
          status: normalizeApplicationStatus(item.status),
          description: item.info ?? '',
          diagnosticResult: item.diagnostic_result ?? '',
        }))
      )

      // Обновляем список клиентов по данным заявок
      const uniqueClients = new Map<
        number,
        { id: number; name: string; phone: string }
      >()

      // Телефоны можно будет добавить отдельно, когда подключим
      // полноценную загрузку клиентов из API.
      data.forEach((item) => {
        if (!uniqueClients.has(item.client_id)) {
          uniqueClients.set(item.client_id, {
            id: item.client_id,
            name: item.FIO,
            phone: 'Не указан',
          })
        }
      })

      setClientList(Array.from(uniqueClients.values()))
    } catch (err) {
      setApplicationsError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить заявки'
      )
    } finally {
      setApplicationsLoading(false)
    }
  }

  // Загружаем реальные заявки после авторизации сотрудника
  useEffect(() => {
    if (employeeToken) {
      void loadApplications()
    }
  }, [employeeToken])

  // =========================
  // ВХОД СОТРУДНИКА ЧЕРЕЗ BACKEND
  // =========================

  const getRoleName = (role: string) => {
    const roleNames: Record<string, string> = {
      engineer: 'Инженер',
      repairer: 'Мастер',
      operator: 'Оператор',
      admin: 'Администратор',
      worker: 'Сотрудник',
    }

    return roleNames[role] ?? role
  }

  const handleLogin = async () => {
    if (!accessCode.trim()) {
      setError('Введи код доступа')
      return
    }

    setError('')

    try {
      // Бэкенд использует OAuth2PasswordRequestForm:
      // код передаём в username, пароль оставляем пустым.
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          username: accessCode.trim(),
          password: '',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Не удалось войти. Проверь код доступа.'
        )
      }

      // Сохраняем токен и роль сотрудника после успешного входа
      localStorage.setItem('fixpoint_employee_token', data.access_token)
      localStorage.setItem('fixpoint_employee_role', data.role)

      setEmployeeToken(data.access_token)
      setCurrentUser({
        role: data.role,
        name: getRoleName(data.role),
      })

      setAccessCode('')
      setActivePage('home')
      setSelectedApplication(null)
      setShowLogin(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка авторизации'
      )
    }
  }

  // ===================
  // УПРАВЛЕНИЕ СОТРУДНИКАМИ ЧЕРЕЗ API
  // ==========================

  // Получить список сотрудников с сервера
  async function loadEmployees() {
    if (!employeeToken) return

    setEmployeesLoading(true)
    setEmployeesError('')

    try {
      const data = await apiRequest<
        {
          id: number
          FIO: string
          role: string
          is_active: boolean
        }[]
      >('/services/get_accesscode', {
        token: employeeToken,
      })

      setEmployeeList(
        data.map((item) => ({
          id: item.id,
          name: item.FIO,
          role: item.role,
          active: item.is_active,
        }))
      )
    } catch (err) {
      setEmployeesError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить сотрудников'
      )
    } finally {
      setEmployeesLoading(false)
    }
  }

  // Блокировка или повторная активация сотрудника
  async function handleToggleEmployeeActive(id: number) {
    const employee = employeeList.find((item) => item.id === id)

    if (!employee) {
      throw new Error('Сотрудник не найден')
    }

    const action = employee.active ? 'dismissal' : 'hier'

    await apiRequest(`/services/${id}/${action}`, {
      method: 'PATCH',
      token: employeeToken,
    })

    await loadEmployees()
  }

  // Перевыпустить код доступа сотрудника
  async function handleGenerateEmployeeCode(id: number): Promise<string> {
    const result = await apiRequest<{
      FIO: string
      Code: string
    }>('/services/reload-access-code', {
      method: 'POST',
      body: { id },
      token: employeeToken,
    })

    return result.Code
  }

  // Загружаем сотрудников, когда администратор открывает их страницу
  useEffect(() => {
    if (
      currentUser?.role === 'admin' &&
      activePage === 'employees' &&
      employeeToken
    ) {
      void loadEmployees()
    }
  }, [currentUser?.role, activePage, employeeToken])

  // =========================
  // кнопка выход из акка сотрудника
  // =========================

  
  const handleLogout = () => {
    // Очищаем сохранённую сессию сотрудника
    localStorage.removeItem('fixpoint_employee_token')
    localStorage.removeItem('fixpoint_employee_role')
    localStorage.removeItem('fixpoint_employee_page')

    // Сбрасываем данные сотрудника в приложении
    setCurrentUser(null)
    setEmployeeToken('')
    setEmployeeList([])

    // Возвращаем на экран входа
    setShowLogin(true)
    setActivePage('home')
    setSelectedApplication(null)
    setAccessCode('')
    setError('')
  }


  // =====================
  // если челик зашел
  // =========================

  if (currentUser) {
    // =========================
    // Экранчик ПОДРОБНОСТЕЙ ЗАЯВКИ
    // =========================

    if (selectedApplication !== null) {
      const application = applicationList.find(
        (item) => item.id === selectedApplication
      )

      if (!application) {
        return null
      }

      const currentStatus =
        applicationStatuses[application.id] ?? application.status

      return (
        <main className="dashboard">
          <Sidebar
            role={currentUser.role}
            activePage={activePage}
            onNavigate={(page) => {
              localStorage.setItem('fixpoint_employee_page', page)
              setActivePage(page)
              setSelectedApplication(null)
              setError('')
            }}
            onLogout={handleLogout}
          />

          <section className="dashboard-content">
            <ApplicationDetails
              application={application}
              currentStatus={currentStatus}
              role={currentUser.role}
              diagnosis={
                applicationDiagnoses[application.id] ??
                application.diagnosticResult ??
                ''
              }
              onDiagnosisChange={(value) => {
                setApplicationDiagnoses((prev) => ({
                  ...prev,
                  [application.id]: value,
                }))
              }}
              onStatusChange={(status) => {
                setApplicationStatuses((prev) => ({
                  ...prev,
                  [application.id]: status,
                }))
              }}
              onBack={() => {
                setSelectedApplication(null)
                setActivePage('applications')
                setError('')
              }}
              stock={stock}
              usedParts={applicationParts[application.id] ?? []}
              canEditParts={currentStatus === 'В ремонте'}
              onAddPart={(stockPartId) =>
                handleAddPartToApplication(application.id, stockPartId)
              }
              onRemovePart={(stockPartId) =>
                handleRemovePartFromApplication(application.id, stockPartId)
              }
            />
          </section>
        </main>
      )
    }

    // =========================
    // СТРАНИЦА КЛИЕНТОВ ОПЕРАТОРА
    // =========================

    if (activePage === 'clients' && currentUser.role === 'operator') {
      return (
        <main className="dashboard">
          {/* ОБЩЕЕ БОКОВОЕ МЕНЮ */}
          <Sidebar
            role={currentUser.role}
            activePage={activePage}
            onNavigate={(page) => {
              localStorage.setItem('fixpoint_employee_page', page)
              setActivePage(page)
              setSelectedApplication(null)
              setError('')
            }}
            onLogout={handleLogout}
          />

          <section className="dashboard-content">
            <header className="dashboard-header">
              <div>
                <p className="dashboard-label">ОПЕРАТОР</p>
                <h1>Клиенты</h1>
              </div>
            </header>

            <section className="applications-section">
              <h2>Список клиентов</h2>

              {applicationsLoading && (
                <p>Загружаем заявки...</p>
              )}

              {applicationsError && (
                <p className="login-error">
                  Не удалось загрузить заявки: {applicationsError}
                </p>
              )}

              <div className="applications-list">
                {clientList.map((client) => {
                  const clientApplications = applicationList.filter(
                    (application) => application.client === client.name
                  )

                  return (
                    <div className="application-card" key={client.id}>
                      <div className="application-number">
                        #{client.id}
                      </div>

                      <div className="application-info">
                        <strong>{client.name}</strong>
                        <span>{client.phone}</span>
                        <span>
                          Заявок: {clientApplications.length}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </section>
        </main>
      )
    }


    // =========================
    // СТРАНИЦА СКЛАДА !!!
    // =========================

    if (
      activePage === 'stock' &&
      (currentUser.role === 'admin' || currentUser.role === 'repairer')
    ) {
      return (
        <main className="dashboard">
          <Sidebar
            role={currentUser.role}
            activePage={activePage}
            onNavigate={(page) => {
              localStorage.setItem('fixpoint_employee_page', page)
              setActivePage(page)
              setSelectedApplication(null)
              setError('')
            }}
            onLogout={handleLogout}
          />

          <StockPage
            role={currentUser.role}
            token={employeeToken}
          />
        </main>
      )
    }

    // =========================
    // СТРАНИЦА "ЗАЯВКИ"
    // =========================

    if (activePage === 'applications') {
      return (
        <main className="dashboard">
          {/* ОБЩЕЕ БОКОВОЕ МЕНЮ */}
          <Sidebar
            role={currentUser.role}
            activePage={activePage}
            onNavigate={(page) => {
              localStorage.setItem('fixpoint_employee_page', page)
              setActivePage(page)
              setSelectedApplication(null)
              setError('')
            }}
            onLogout={handleLogout}
          />

          {/* ОСНОВНАЯ ЧАСТЬ */}
          <section className="dashboard-content">
            <header className="dashboard-header">
              <div>
                <p className="dashboard-label">РАЗДЕЛ</p>
                <h1>Все заявки</h1>
              </div>

              <div className="user-info">
                <div className="user-avatar">
                  {currentUser.name.charAt(0)}
                </div>

                <div>
                  <strong>{currentUser.name}</strong>
                  <span>{getRoleName(currentUser.role)}</span>
                </div>
              </div>
            </header>

            <section className="applications-section">
              <div className="section-header">
                <div>
                  <h2>Заявки сервисного центра</h2>
                  <p>Все заявки, доступные вашей роли</p>
                </div>
              </div>

              {currentUser.role === 'operator' && (
                <div className="details-card">
                  <h2>Создать заявку</h2>

                  <label>
                    Клиент
                    <input
                      type="text"
                      placeholder="Имя клиента"
                      value={newApplicationClient}
                      onChange={(event) =>
                        setNewApplicationClient(event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Устройство
                    <input
                      type="text"
                      placeholder="Например, ноутбук ASUS"
                      value={newApplicationDevice}
                      onChange={(event) =>
                        setNewApplicationDevice(event.target.value)
                      }
                    />
                  </label>

                  <button
                    className="login-button"
                    onClick={handleAddApplication}
                  >
                    Создать заявку
                  </button>

                  {error && <p className="login-error">{error}</p>}
                </div>
              )}

              {applicationsLoading && (
                <p>Загружаем заявки...</p>
              )}

              {applicationsError && (
                <p className="login-error">
                  Не удалось загрузить заявки: {applicationsError}
                </p>
              )}


              <div className="applications-list">
                {applicationList.map((application) => {
                  const currentStatus =
                    applicationStatuses[application.id] ?? application.status

                  return (
                    <div
                      className="application-card"
                      key={application.id}
                      onClick={() => {
                        setSelectedApplication(application.id)
                        setActivePage('applications')
                      }}
                    >
                      <div className="application-number">
                        #{application.id}
                      </div>

                      <div className="application-info">
                        <strong>{application.client}</strong>
                        <span>{application.device}</span>
                      </div>

                      <div className="status">{currentStatus}</div>
                    </div>
                  )
                })}
              </div>
            </section>
          </section>
        </main>
      )
    }

    // =========================
    // СТРАНИЦА СОТРУДНИКОВ
    // =========================

    if (activePage === 'employees' && currentUser.role === 'admin') {
      return (
        <main className="dashboard">
          <Sidebar
            role={currentUser.role}
            activePage={activePage}
            onNavigate={(page) => {
              localStorage.setItem('fixpoint_employee_page', page)
              setActivePage(page)
              setSelectedApplication(null)
              setError('')
            }}
            onLogout={handleLogout}
          />

          <EmployeesPage
            employees={employeeList}
            loading={employeesLoading}
            error={employeesError}
            onToggleActive={handleToggleEmployeeActive}
            onGenerateCode={handleGenerateEmployeeCode}
          />
        </main>
      )
    }

    // =========================
    // ГЛАВНАЯ СТРАНИЦА
    // =========================

    return (
      <main className="dashboard">
        {/* ОБЩЕЕ БОКОВОЕ МЕНЮ */}
        <Sidebar
          role={currentUser.role}
          activePage={activePage}
          onNavigate={(page) => {
            localStorage.setItem('fixpoint_employee_page', page)
            setActivePage(page)
            setSelectedApplication(null)
            setError('')
          }}
          onLogout={handleLogout}
        />

        {/* ОСНОВНАЯ ЧАСТЬ */}
        <section className="dashboard-content">
          <header className="dashboard-header">
            <div>
              <p className="dashboard-label">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
              <h1>
                Добро пожаловать, {currentUser.name}
              </h1>
            </div>

            <div className="user-info">
              <div className="user-avatar">
                {currentUser.name.charAt(0)}
              </div>

              <div>
                <strong>{currentUser.name}</strong>
                <span>{getRoleName(currentUser.role)}</span>
              </div>
            </div>
          </header>

          {/* СТАТИСТИКА */}
          <section className="stats">
            <div className="stat-card">
              <span>Всего заявок</span>
              <strong>12</strong>
            </div>

            <div className="stat-card">
              <span>В работе</span>
              <strong>4</strong>
            </div>

            <div className="stat-card">
              <span>На диагностике</span>
              <strong>3</strong>
            </div>

            <div className="stat-card">
              <span>Готово</span>
              <strong>5</strong>
            </div>
          </section>

          {/* ПОСЛЕДНИЕ ЗАЯВКИ */}
          <section className="applications-section">
            <div className="section-header">
              <div>
                <h2>Последние заявки</h2>
                <p>Недавно созданные заявки клиентов</p>
              </div>

              <button
                className="view-all-button"
                onClick={() => {
                  setActivePage('applications')
                  setSelectedApplication(null)
                }}
              >
                Все заявки →
              </button>
            </div>

            {applicationsLoading && (
              <p>Загружаем заявки...</p>
            )}

            {applicationsError && (
              <p className="login-error">
                Не удалось загрузить заявки: {applicationsError}
              </p>
            )}

            <div className="applications-list">
              {applicationList.map((application) => {
                const currentStatus =
                  applicationStatuses[application.id] ?? application.status

                return (
                  <div
                    className="application-card"
                    key={application.id}
                    onClick={() => {
                      setSelectedApplication(application.id)
                      setActivePage('applications')
                    }}
                  >
                    <div className="application-number">
                      #{application.id}
                    </div>

                    <div className="application-info">
                      <strong>{application.client}</strong>
                      <span>{application.device}</span>
                    </div>

                    <div className="status">{currentStatus}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </section>
      </main>
    )
  }

  // ===========================
  // РЕГИСТРАЦИЯ И ВХОД КЛИЕНТА
  // ===========================

  if (showClientAuth) {
    return (
      <ClientAuth
        accounts={clientAccounts}
        onRegister={(client) => {
          setClientAccounts((prev) => [...prev, client])
        }}
        onSuccess={(client) => {
          setCurrentClient(client)
          setShowClientAuth(false)
          setShowLogin(false)
          setError('')
        }}
        onBack={() => {
          setShowClientAuth(false)
          setError('')
        }}
      />
    )
  }

  if (currentClient) {
    return (
      <ClientProfile
        client={currentClient}
        onLogout={async () => {
          try {
            await apiRequest<void>('/auth/client/logout', {
              method: 'POST',
            })
          } catch (err) {
            console.error('Не удалось завершить серверную сессию:', err)
          } finally {
            setCurrentClient(null)
            setShowClientAuth(false)
            setShowLogin(false)
          }
        }}
      />
    )
  }

  // ===========================
  // ЭКРАН ВХОДАА
  // =========================

  if (showLogin) {
    return (
      <main className="login">
        <div className="login-content">
          <p className="welcome-label">
            FIXPOINT / СОТРУДНИКАМ
          </p>

          <h1>Вход в систему</h1>

          <p className="welcome-description">
            Введите индивидуальный код доступа, выданный администратором.
          </p>

          <div className="form">
            <label>
              Код доступа сотрудника

              <input
                type="password"
                placeholder="Введите код доступа"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <button
              className="login-button"
              onClick={handleLogin}
            >
              Войти
            </button>

            {error && (
              <p className="login-error">
                {error}
              </p>
            )}

            <button
              className="back-button"
              onClick={() => {
                setShowLogin(false)
                setAccessCode('')
                setError('')
              }}
            >
              ← На главную
            </button>
          </div>
        </div>
      </main>
    )
  }

  // =========================
  // ГЛАВНЫЙ ЭКРАН аа
  // =========================
  // Главная страница для клиентов.
  // Кнопка сотрудников открывает существующую форму входа.
  return (
    <HomePage
      onEmployeeClick={() => {
        setShowLogin(true)
        setShowClientAuth(false)
        setError('')
      }}
      onClientClick={() => {
        setShowClientAuth(true)
        setShowLogin(false)
        setError('')
      }}
    />
  )
}

export default App
