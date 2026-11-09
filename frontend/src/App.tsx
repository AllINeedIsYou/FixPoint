import { useEffect, useState } from 'react'

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
//доставка
import DeliveryPage from './DeliveryPage'
import ClientsPage from './ClientsPage'

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
    statusInfo: number
    assigneeEngineerId: number | null
    assigneeRepairerId: number | null
    checkResult: string
    source: string
    parts: UsedPart[]
    workCost: number
    partsCost: number
    totalCost: number
  }

  const [applicationList, setApplicationList] = useState<ApplicationItem[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsError, setApplicationsError] = useState('')

  const [stock, setStock] = useState<{
    id: number
    name: string
    quantity: number
    price: number
  }[]>([])

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
  const [newApplicationPhone, setNewApplicationPhone] = useState('')
  const [newApplicationEmail, setNewApplicationEmail] = useState('')
  const [newApplicationDevice, setNewApplicationDevice] = useState('')
  const [newApplicationModel, setNewApplicationModel] = useState('')
  const [newApplicationInfo, setNewApplicationInfo] = useState('')
  const [newApplicationAddress, setNewApplicationAddress] = useState('')
  const [isCreatingApplication, setIsCreatingApplication] = useState(false)

  // Получаем ID сотрудника из JWT, чтобы показывать действия
  // только тому, кому сервер назначил заявку.
  function getEmployeeIdFromToken(token: string): number | null {
    try {
      const payloadPart = token.split('.')[1]
      if (!payloadPart) return null

      const normalized = payloadPart
        .replace(/-/g, '+')
        .replace(/_/g, '/')
      const payload = JSON.parse(atob(normalized))
      const id = Number(payload.sub)

      return Number.isFinite(id) ? id : null
    } catch {
      return null
    }
  }

  const employeeId = getEmployeeIdFromToken(employeeToken)

  function currentUserRoleReleasePath(applicationId: number): string {
    const role = localStorage.getItem('fixpoint_employee_role')
    if (role === 'engineer') return `/engineer/${applicationId}/release`
    if (role === 'repairer') return `/repairer/${applicationId}/release`
    if (role === 'operator') return `/operator/${applicationId}/release`
    return `/services/${applicationId}/release`
  }

  // Все изменения этапов выполняются только через API.
  async function handleApplicationAction(
    action: 'take-engineer' | 'diagnose' | 'take-repair' | 'repair' | 'take-check' | 'check' | 'issue' | 'release',
    applicationId: number,
    data?: { diagnostic_info?: string; passed?: boolean; comment?: string },
  ) {
    const routes: Record<typeof action, string> = {
      'take-engineer': `/engineer/${applicationId}/takeEngineer`,
      diagnose: `/engineer/${applicationId}/diagnose`,
      'take-repair': `/repairer/${applicationId}/takeRepair`,
      repair: `/repairer/${applicationId}/repair`,
      'take-check': `/engineer/${applicationId}/takeEngineer`,
      check: `/engineer/${applicationId}/check`,
      issue: `/operator/${applicationId}/issue`,
      release: currentUserRoleReleasePath(applicationId),
    }

    await apiRequest(routes[action], {
      method: 'POST',
      body: data,
      token: employeeToken,
    })

    await loadApplications()
  }

  // Запчасти списываются с настоящего склада и привязываются к заявке.
  async function handleAddPartToApplication(
    applicationId: number,
    stockPartId: number,
  ) {
    const part = stock.find((item) => item.id === stockPartId)
    if (!part) throw new Error('Запчасть не найдена на складе')
    if (part.quantity <= 0) throw new Error('Этой запчасти нет в наличии')

    await apiRequest(`/repairer/${applicationId}/parts`, {
      method: 'POST',
      body: { name: part.name, quantity: 1 },
      token: employeeToken,
    })

    await Promise.all([loadApplications(), loadRepairerStock()])
  }

  // Удаляем именно запись запчасти из заявки по её ID.
  async function handleRemovePartFromApplication(
    applicationId: number,
    partId: number,
  ) {
    await apiRequest(`/repairer/${applicationId}/parts/${partId}`, {
      method: 'DELETE',
      token: employeeToken,
    })

    await Promise.all([loadApplications(), loadRepairerStock()])
  }

  async function loadRepairerStock() {
    if (!employeeToken || localStorage.getItem('fixpoint_employee_role') !== 'repairer') {
      return
    }

    const data = await apiRequest<{
      id: number
      name: string
      price: number
      quantity: number
    }[]>('/repairer/stock', { token: employeeToken })

    setStock(data)
  }

  // =========================
  // ВХОД
  // =========================

  // Создание настоящей заявки оператором через API.
  const handleAddApplication = async () => {
    if (
      !newApplicationClient.trim() ||
      !newApplicationPhone.trim() ||
      !newApplicationEmail.trim() ||
      !newApplicationDevice.trim() ||
      !newApplicationModel.trim() ||
      !newApplicationInfo.trim() ||
      !newApplicationAddress.trim()
    ) {
      setError('Заполни все поля заявки')
      return
    }

    if (!employeeToken) {
      setError('Сессия сотрудника не найдена. Войди в аккаунт заново.')
      return
    }

    setIsCreatingApplication(true)
    setError('')

    try {
      await apiRequest('/operator/add_application', {
        method: 'POST',
        token: employeeToken,
        body: {
          FIO: newApplicationClient.trim(),
          number: newApplicationPhone.trim(),
          email: newApplicationEmail.trim(),
          device: newApplicationDevice.trim(),
          device_model: newApplicationModel.trim(),
          info: newApplicationInfo.trim(),
          address: newApplicationAddress.trim(),
        },
      })

      // После успешного ответа сервера обновляем список из базы данных.
      await loadApplications()

      setNewApplicationClient('')
      setNewApplicationPhone('')
      setNewApplicationEmail('')
      setNewApplicationDevice('')
      setNewApplicationModel('')
      setNewApplicationInfo('')
      setNewApplicationAddress('')
      setError('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать заявку. Попробуй ещё раз.'
      )
    } finally {
      setIsCreatingApplication(false)
    }
  }


  // =========================
  // ЗАГРУЗКА ЗАЯВОК С BACKEND
  // =========================

  // Этап заявки берём из status_info, а не пытаемся угадать по тексту статуса.
  function getApplicationDisplayStatus(item: {
    status_info: number
    assignee_engineer_id?: number | null
    assignee_repairer_id?: number | null
    check_result?: string | null
  }): string {
    switch (item.status_info) {
      case -3: return 'Ожидает курьера'
      case -2: return 'Курьер выехал'
      case -1: return 'Курьер забрал посылку'
      case 0:
        if (item.check_result) return 'Повторная диагностика'
        return item.assignee_engineer_id ? 'В работе у инженера' : 'Новая'
      case 1:
        return item.assignee_repairer_id ? 'В ремонте' : 'Ожидание ремонта'
      case 2: return 'Ожидает проверки'
      case 3: return 'Готово к выдаче'
      case 4: return 'Выдано клиенту'
      default: return 'Неизвестный этап'
    }
  }

  async function loadApplications() {
    if (!employeeToken) return

    setApplicationsLoading(true)
    setApplicationsError('')

    try {
      const role = localStorage.getItem('fixpoint_employee_role') || ''
      const endpointByRole: Record<string, string> = {
        engineer: '/engineer/get_applications',
        repairer: '/repairer/get_applications',
        operator: '/operator/get_applications',
        admin: '/services/get_applications',
        worker: '/services/get_applications',
      }
      const endpoint = endpointByRole[role] || '/services/get_applications'

      const data = await apiRequest<{
        id: number
        client_id: number
        FIO: string
        device: string
        device_model?: string | null
        info?: string | null
        status: string
        status_info: number
        diagnostic_result?: string | null
        assignee_engineer_id?: number | null
        assignee_repairer_id?: number | null
        check_result?: string | null
        source: string
        parts?: {
          id: number
          stock_part_id: number | null
          name: string
          price: number
          quantity: number
        }[]
        work_cost?: number
        parts_cost?: number
        total_cost?: number
      }[]>(endpoint, { token: employeeToken })

      const mapped = data.map((item) => ({
        id: item.id,
        client: item.FIO,
        clientId: item.client_id,
        device: [item.device, item.device_model]
          .filter(Boolean)
          .join(' — '),
        status: getApplicationDisplayStatus(item),
        description: item.info ?? '',
        diagnosticResult: item.diagnostic_result ?? '',
        statusInfo: item.status_info,
        assigneeEngineerId: item.assignee_engineer_id ?? null,
        assigneeRepairerId: item.assignee_repairer_id ?? null,
        checkResult: item.check_result ?? '',
        source: item.source,
        parts: (item.parts ?? []).map((part) => ({
          id: part.id,
          stockPartId: part.stock_part_id,
          name: part.name,
          price: Number(part.price),
          quantity: part.quantity,
        })),
        workCost: Number(item.work_cost ?? 5000),
        partsCost: Number(item.parts_cost ?? 0),
        totalCost: Number(item.total_cost ?? 0),
      }))

      setApplicationList(mapped)
      if (role === 'repairer') {
        await loadRepairerStock()
      }
    } catch (err) {
      setApplicationsError(
        err instanceof Error ? err.message : 'Не удалось загрузить заявки',
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

  // Создание нового сотрудника и получение одноразового кода доступа.
  async function handleCreateEmployee(FIO: string, role: string): Promise<string> {
    const result = await apiRequest<{
      id: number
      code: string
      role: string
      is_active: boolean
    }>('/services/access-codes', {
      method: 'POST',
      body: { FIO, role },
      token: employeeToken,
    })

    await loadEmployees()
    return result.code
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

      const currentStatus = application.status

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
              employeeId={employeeId}
              statusInfo={application.statusInfo}
              assigneeEngineerId={application.assigneeEngineerId}
              assigneeRepairerId={application.assigneeRepairerId}
              checkResult={application.checkResult}
              workCost={application.workCost}
              partsCost={application.partsCost}
              totalCost={application.totalCost}
              onAction={(action, data) =>
                handleApplicationAction(action, application.id, data)
              }
              onRelease={async () => {
                await handleApplicationAction('release', application.id)
              }}
              onDelete={async () => {
                await apiRequest(`/operator/delete_applications/${application.id}`, {
                  method: 'DELETE',
                  token: employeeToken,
                })
                await loadApplications()
                setSelectedApplication(null)
              }}
              onBack={() => {
                setSelectedApplication(null)
                setActivePage('applications')
                setError('')
              }}
              stock={stock}
              usedParts={application.parts}
              canEditParts={
                currentUser.role === 'repairer' &&
                application.statusInfo === 1 &&
                application.assigneeRepairerId === employeeId
              }
              onAddPart={(stockPartId) =>
                handleAddPartToApplication(application.id, stockPartId)
              }
              onRemovePart={(partId) =>
                handleRemovePartFromApplication(application.id, partId)
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
          <ClientsPage
            token={employeeToken}
            onOpenApplication={(id: number) => {
              setSelectedApplication(id)
              setActivePage('applications')
            }}
          />
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
    // СТРАНИЦА КУРЬЕРСКОЙ ДОСТАВКИ
    // =========================

    if (activePage === 'delivery' && currentUser.role === 'operator') {
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
            <DeliveryPage token={employeeToken} />
          </section>
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
                    ФИО клиента
                    <input
                      type="text"
                      placeholder="Иванов Иван Иванович"
                      value={newApplicationClient}
                      onChange={(event) => setNewApplicationClient(event.target.value)}
                    />
                  </label>

                  <label>
                    Телефон
                    <input
                      type="tel"
                      placeholder="+7 999 123-45-67"
                      value={newApplicationPhone}
                      onChange={(event) => setNewApplicationPhone(event.target.value)}
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newApplicationEmail}
                      onChange={(event) => setNewApplicationEmail(event.target.value)}
                    />
                  </label>

                  <label>
                    Устройство
                    <input
                      type="text"
                      placeholder="Ноутбук"
                      value={newApplicationDevice}
                      onChange={(event) => setNewApplicationDevice(event.target.value)}
                    />
                  </label>

                  <label>
                    Модель устройства
                    <input
                      type="text"
                      placeholder="ASUS VivoBook 15"
                      value={newApplicationModel}
                      onChange={(event) => setNewApplicationModel(event.target.value)}
                    />
                  </label>

                  <label>
                    Описание проблемы
                    <textarea
                      placeholder="Опиши неисправность со слов клиента"
                      value={newApplicationInfo}
                      onChange={(event) => setNewApplicationInfo(event.target.value)}
                      rows={3}
                    />
                  </label>

                  <label>
                    Адрес
                    <input
                      type="text"
                      placeholder="Адрес клиента или сервисного центра"
                      value={newApplicationAddress}
                      onChange={(event) => setNewApplicationAddress(event.target.value)}
                    />
                  </label>

                  <button
                    className="login-button"
                    onClick={handleAddApplication}
                    disabled={isCreatingApplication}
                  >
                    {isCreatingApplication ? 'Создаём заявку...' : 'Создать заявку'}
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
                  const currentStatus = application.status

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
            onCreateEmployee={handleCreateEmployee}
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
              <strong>{applicationList.length}</strong>
            </div>

            <div className="stat-card">
              <span>В работе</span>
              <strong>{applicationList.filter((item) => item.statusInfo === 1 || item.statusInfo === 2).length}</strong>
            </div>

            <div className="stat-card">
              <span>На диагностике</span>
              <strong>{applicationList.filter((item) => item.statusInfo === 0).length}</strong>
            </div>

            <div className="stat-card">
              <span>Готово</span>
              <strong>{applicationList.filter((item) => item.statusInfo === 3 || item.statusInfo === 4).length}</strong>
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
                const currentStatus = application.status

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
