import { useState } from 'react'
import {
  users,
  applications,
  clients,
  stockParts
} from './mockData'
import './App.css'
import HomePage from './HomePage'

function App() {
  // =========================
  // СОСТОЯНИЯ и хуня для работы выше
  // =========================

  const [showLogin, setShowLogin] = useState(false)

  //КОД ДОСТУПА КОТОРЫЙ ВВОДИТ СОТРУДНИК
  const [accessCode, setAccessCode] = useState('')

  const [error, setError] = useState('')

  const [currentUser, setCurrentUser] = useState<{
    role: string
    name: string
  } | null>(null)

  // Какая заявка сейчас открыта
  const [selectedApplication, setSelectedApplication] =
    useState<number | null>(null)

  // Какая страница открыта
  const [activePage, setActivePage] = useState('home')

  // Временные статусы заявок
  // Потом это заменю на данные с backend
  const [applicationStatuses, setApplicationStatuses] =
    useState<Record<number, string>>({})

  //эт локальный список пока без бд. чтобы новые заявки добавлялись в
  //  интерфейс, а не терялись из-за использования исходного массива.
  const [applicationList, setApplicationList] = useState<
    { id: number; client: string; device: String; status: string }[]
  >(applications)
  
  //локальные копии моковых данных которые можно изменять
  const [clientList, setClientList] = useState(clients)
  const [stock, setStock] = useState(stockParts)

  //поля создания заявок оператором
  const [newApplicationClient, setNewApplicationClient] = useState('')
  const [newApplicationDevice, setNewApplicationDevice] = useState('')

  //поля управления складом
  const [stockSearch, setStockSearch] = useState('')
  const [newPartName, setNewPartName] = useState('')
  const [newPartQuantity, setNewPartQuantity] = useState('1')
  const [newPartPrice, setNewPartPrice] = useState('')


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


  const handleLogin = () => {
    //тута пока только проверяю формат заполения 
    //реальную проверку потом к бекенду подкл надо
    //if (!accessCode.trim()) {
      //setError('Введите код доступа сотрудника')
      //return
    const user = users.find(
      (user) =>
        user.password === accessCode.trim()
    )

    if (user) {
      setCurrentUser({
        role: user.role,
        name: user.name,
      })

      setError('')
      setAccessCode('')
      setActivePage('home')
      setSelectedApplication(null)
      setShowLogin(false)
    } else {
      setError('Неверный код доступа')
    }
    //setError('Проверка кода пока не подключена к серверу')
  }


  // =========================
  // кнопка выход из акка сотрудника
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

  const handleLogout = () => {
    setCurrentUser(null)
    setShowLogin(true) //после выхода показываем форму входа сотруудников
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

      // Получаем актуальный статус
      const currentStatus =
        applicationStatuses[application.id] ??
        application.status

      return (
        <main className="dashboard">

          {/* БОКОВОЕ МЕНЮ */}

          <aside className="sidebar">

            <div className="sidebar-logo">
              <span>Fix</span>
              <strong>Point</strong>
            </div>

            <nav className="sidebar-nav">

              <button
                className={`nav-item ${
                  activePage === 'home' ? 'active' : ''
                }`}
                onClick={() => {
                  setActivePage('home')
                  setSelectedApplication(null)
                }}
              >
                Главная
              </button>

              <button
                className={`nav-item ${
                  activePage === 'applications'
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  setActivePage('applications')
                  setSelectedApplication(null)
                }}
              >
                Заявки
              </button>

              <button className="nav-item">
                Профиль
              </button>

            </nav>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              Выйти
            </button>

          </aside>


          {/* ОСНОВНАЯ ЧАСТЬ */}

          <section className="dashboard-content">

            <button
              className="back-button"
              onClick={() => {
                setSelectedApplication(null)
                setActivePage('applications')
              }}
            >
              ← Назад к заявкам
            </button>


            <div className="application-details">

              <p className="dashboard-label">
                ЗАЯВКА #{application.id}
              </p>

              <h1>
                Информация о заявке
              </h1>


              {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}

              <div className="details-card">

                <div className="detail-row">
                  <span>Клиент</span>

                  <strong>
                    {application.client}
                  </strong>
                </div>


                <div className="detail-row">
                  <span>Устройство</span>

                  <strong>
                    {application.device}
                  </strong>
                </div>


                <div className="detail-row">
                  <span>Статус</span>

                  <strong>
                    {currentStatus}
                  </strong>
                </div>

              </div>


              {/* ДЕЙСТВИЯ ИНЖЕНЕРА */}

              {currentUser.role === 'engineer' && (
                <div className="role-actions">

                  <h2>
                    Действия инженера
                  </h2>

                  <div className="action-buttons">

                    {currentStatus === 'Новая' && (
                      <button
                        className="action-button"
                        onClick={() =>
                          setApplicationStatuses(
                            (prev) => ({
                              ...prev,
                              [application.id]:
                                'В работе у инженера',
                            })
                          )
                        }
                      >
                        Взять заявку
                      </button>
                    )}


                    {currentStatus ===
                      'В работе у инженера' && (
                      <button
                        className="action-button"
                        onClick={() =>
                          setApplicationStatuses(
                            (prev) => ({
                              ...prev,
                              [application.id]:
                                'Диагностика',
                            })
                          )
                        }
                      >
                        Провести диагностику
                      </button>
                    )}


                    {currentStatus ===
                      'Диагностика' && (
                      <button
                        className="action-button"
                        onClick={() =>
                          setApplicationStatuses(
                            (prev) => ({
                              ...prev,
                              [application.id]:
                                'Ожидание ремонта',
                            })
                          )
                        }
                      >
                        Завершить диагностику
                      </button>
                    )}

                  </div>

                </div>
              )}


              {/* ДЕЙСТВИЯ МАСТЕРА */}

              {currentUser.role === 'repairer' && (
                <div className="role-actions">

                  <h2>
                    Действия мастера
                  </h2>

                  <div className="action-buttons">

                    {currentStatus ===
                      'Ожидание ремонта' && (
                      <button
                        className="action-button"
                        onClick={() =>
                          setApplicationStatuses(
                            (prev) => ({
                              ...prev,
                              [application.id]:
                                'В ремонте',
                            })
                          )
                        }
                      >
                        Взять в ремонт
                      </button>
                    )}


                    {currentStatus ===
                      'В ремонте' && (
                      <button
                        className="action-button"
                        onClick={() =>
                          setApplicationStatuses(
                            (prev) => ({
                              ...prev,
                              [application.id]:
                                'Готово',
                            })
                          )
                        }
                      >
                        Завершить ремонт
                      </button>
                    )}

                  </div>

                </div>
              )}


              {/* ИСТОРИЯ */}

              <div className="status-history">

                <h2>
                  История заявки
                </h2>

                <div className="timeline">

                  <div className="timeline-item completed">
                    <strong>
                      Заявка создана
                    </strong>

                    <span>
                      Клиент оставил заявку
                    </span>
                  </div>


                  <div className="timeline-item active-step">
                    <strong>
                      {currentStatus}
                    </strong>

                    <span>
                      Текущий этап обработки
                    </span>
                  </div>


                  <div className="timeline-item">
                    <strong>
                      Завершение ремонта
                    </strong>

                    <span>
                      Ожидается
                    </span>
                  </div>

                </div>

              </div>

            </div>

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
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span>Fix</span>
              <strong>Point</strong>
            </div>

            <nav className="sidebar-nav">
              <button
                className="nav-item"
                onClick={() => setActivePage('home')}
              >
                Главная
              </button>

              <button
                className="nav-item"
                onClick={() => setActivePage('applications')}
              >
                Все заявки
              </button>

              <button className="nav-item active">
                Клиенты
              </button>
            </nav>

            <button className="logout-button" onClick={handleLogout}>
              Выйти
            </button>
          </aside>

          <section className="dashboard-content">
            <header className="dashboard-header">
              <div>
                <p className="dashboard-label">ОПЕРАТОР</p>
                <h1>Клиенты</h1>
              </div>
            </header>

            <section className="applications-section">
              <h2>Список клиенттов</h2>

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
    // СТРАНИЦА СКЛАДА!!!!
    // =========================

    if (
      activePage === 'stock' &&
      (currentUser.role === 'admin' || currentUser.role === 'repairer')
    ) {
      const filteredStock = stock.filter((part) =>
        part.name.toLowerCase().includes(stockSearch.toLowerCase())
      )

      const handleAddPart = () => {
        if (!newPartName.trim() || !newPartQuantity || !newPartPrice) {
          setError('Заполни все поля запчасти')
          return
        }

        const quantity = Number(newPartQuantity)
        const price = Number(newPartPrice)

        if (
          !Number.isFinite(quantity) ||
          !Number.isFinite(price) ||
          quantity < 0 ||
          price < 0
        ) {
          setError('Количество и цена должны быть неотрицательными числами')
          return
        }

        const nextId = Math.max(0, ...stock.map((part) => part.id)) + 1

        setStock((prev) => [
          ...prev,
          {
            id: nextId,
            name: newPartName.trim(),
            quantity,
            price,
          },
        ])

        setNewPartName('')
        setNewPartQuantity('1')
        setNewPartPrice('')
        setError('')
      }

      return (
        <main className="dashboard">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span>Fix</span>
              <strong>Point</strong>
            </div>

            <nav className="sidebar-nav">
              <button
                className="nav-item"
                onClick={() => setActivePage('home')}
              >
                Главная
              </button>

              <button
                className="nav-item"
                onClick={() => setActivePage('applications')}
              >
                Мои заявки
              </button>

              <button className="nav-item active">
                Склад запчастей
              </button>
            </nav>

            <button className="logout-button" onClick={handleLogout}>
              Выйти
            </button>
          </aside>

          <section className="dashboard-content">
            <header className="dashboard-header">
              <div>
                <p className="dashboard-label">
                  {currentUser.role === 'admin' ? 'АДМИНИСТРАТОР' : 'МАСТЕР'}
                </p>
                <h1>Склад запчастей</h1>
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
                  <h2>Запчасти</h2>
                  <p>Всего позиций: {stock.length}</p>
                </div>
              </div>

              <input
                type="text"
                placeholder="Поиск запчастей..."
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
              />

              {currentUser.role === 'admin' && (
                <div className="application-card">
                  <div className="application-info">
                    <h3>Добавить запчасть</h3>

                    <input
                      type="text"
                      placeholder="Название запчасти"
                      value={newPartName}
                      onChange={(event) => setNewPartName(event.target.value)}
                    />

                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Количество"
                      value={newPartQuantity}
                      onChange={(event) => setNewPartQuantity(event.target.value)}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Цена за единицу, ₽"
                      value={newPartPrice}
                      onChange={(event) => setNewPartPrice(event.target.value)}
                    />

                    <button className="primary-button" onClick={handleAddPart}>
                      Добавить запчасть
                    </button>

                    {error && <p>{error}</p>}
                  </div>
                </div>
              )}

              <div className="applications-list">
                {filteredStock.length === 0 ? (
                  <p>Запчасти не найдены.</p>
                ) : (
                  filteredStock.map((part) => (
                    <div className="application-card" key={part.id}>
                      <div className="application-number">#{part.id}</div>

                      <div className="application-info">
                        <strong>{part.name}</strong>
                        <span>В наличии: {part.quantity} шт.</span>
                        <span>
                          Цена: {part.price.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
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

          {/* БОКОВОЕ МЕНЮ */}

          <aside className="sidebar">

            <div className="sidebar-logo">
              <span>Fix</span>
              <strong>Point</strong>
            </div>

            <nav className="sidebar-nav">

              <button
                className="nav-item"
                onClick={() => {
                  setActivePage('home')
                  setSelectedApplication(null)
                }}
              >
                Главная
              </button>


              <button
                className="nav-item active"
                onClick={() => {
                  setActivePage('applications')
                  setSelectedApplication(null)
                }}
              >
                Заявки
              </button>


              <button className="nav-item">
                Профиль
              </button>

            </nav>


            <button
              className="logout-button"
              onClick={handleLogout}
            >
              Выйти
            </button>

          </aside>


          {/* ОСНОВНАЯ ЧАСТЬ */}

          <section className="dashboard-content">

            <header className="dashboard-header">

              <div>

                <p className="dashboard-label">
                  РАЗДЕЛ
                </p>

                <h1>
                  Все заявки
                </h1>

              </div>


              <div className="user-info">

                <div className="user-avatar">
                  {currentUser.name.charAt(0)}
                </div>

                <div>
                  <strong>
                    {currentUser.name}
                  </strong>

                  <span>
                    {getRoleName(currentUser.role)}
                  </span>
                </div>

              </div>

            </header>


            <section className="applications-section">

              <div className="section-header">

                <div>

                  <h2>
                    Заявки сервисного центра
                  </h2>

                  <p>
                    Все заявки, доступные вашей роли
                  </p>

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


              <div className="applications-list">

                {applicationList.map(
                  (application) => {

                    const currentStatus =
                      applicationStatuses[
                        application.id
                      ] ??
                      application.status

                    return (
                      <div
                        className="application-card"
                        key={application.id}
                        onClick={() => {
                          setSelectedApplication(
                            application.id
                          )
                          setActivePage(
                            'applications'
                          )
                        }}
                      >

                        <div className="application-number">
                          #{application.id}
                        </div>


                        <div className="application-info">

                          <strong>
                            {application.client}
                          </strong>

                          <span>
                            {application.device}
                          </span>

                        </div>


                        <div className="status">
                          {currentStatus}
                        </div>

                      </div>
                    )
                  }
                )}

              </div>

            </section>

          </section>

        </main>
      )
    }


    // =========================
    // ГЛАВНАЯ СТРАНИЦА
    // =========================

    return (
      <main className="dashboard">

        {/* БОКОВОЕ МЕНЮ */}

        <aside className="sidebar">

          <div className="sidebar-logo">
            <span>Fix</span>
            <strong>Point</strong>
          </div>


          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activePage === 'home' ? 'active' : ''}`}
              onClick={() => {
                setActivePage('home')
                setSelectedApplication(null)
              }}
            >
              Главная
            </button>

            {currentUser.role === 'engineer' && (
              <>
                <button
                  className={`nav-item ${activePage === 'applications' ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage('applications')
                    setSelectedApplication(null)
                  }}
                >
                  Мои заявки
                </button>
              </>
            )}

            {currentUser.role === 'operator' && (
              <>
                <button
                  className={`nav-item ${activePage === 'applications' ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage('applications')
                    setSelectedApplication(null)
                  }}
                >
                  Все заявки
                </button>

                <button
                  className={`nav-item ${activePage === 'clients' ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage('clients')
                    setSelectedApplication(null)
                  }}
                >
                  Клиенты
                </button>
              </>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button
                  className={`nav-item ${activePage === 'applications' ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage('applications')
                    setSelectedApplication(null)
                  }}
                >
                  Все заявки
                </button>

                <button
                  className={`nav-item ${activePage === 'employees' ? 'active' : ''}`}
                  onClick={() => setActivePage('employees')}
                >
                  Сотрудники
                </button>

                <button
                  className={`nav-item ${activePage === 'stock' ? 'active' : ''}`}
                  onClick={() => setActivePage('stock')}
                >
                  Склад
                </button>
              </>
            )}

            {currentUser.role === 'repairer' && (
              <>
                <button
                  className={`nav-item ${activePage === 'applications' ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage('applications')
                    setSelectedApplication(null)
                  }}
                >
                  Мои заявки
                </button>

                <button
                  className={`nav-item ${activePage === 'stock' ? 'active' : ''}`}
                  onClick={() => setActivePage('stock')}
                >
                  Склад запчастей
                </button>
              </>
            )}
          </nav>


          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Выйти
          </button>

        </aside>


        {/* ОСНОВНАЯ ЧАСТЬ */}

        <section className="dashboard-content">

          <header className="dashboard-header">

            <div>

              <p className="dashboard-label">
                ПАНЕЛЬ УПРАВЛЕНИЯ
              </p>

              <h1>
                Добро пожаловать,{' '}
                {currentUser.name}
              </h1>

            </div>


            <div className="user-info">

              <div className="user-avatar">
                {currentUser.name.charAt(0)}
              </div>

              <div>

                <strong>
                  {currentUser.name}
                </strong>

                <span>
                  {getRoleName(currentUser.role)}
                </span>

              </div>

            </div>

          </header>


          {/* СТАТИСТИКА */}

          <section className="stats">

            <div className="stat-card">
              <span>
                Всего заявок
              </span>

              <strong>
                12
              </strong>
            </div>


            <div className="stat-card">
              <span>
                В работе
              </span>

              <strong>
                4
              </strong>
            </div>


            <div className="stat-card">
              <span>
                На диагностике
              </span>

              <strong>
                3
              </strong>
            </div>


            <div className="stat-card">
              <span>
                Готово
              </span>

              <strong>
                5
              </strong>
            </div>

          </section>


          {/* ПОСЛЕДНИЕ ЗАЯВКИ */}

          <section className="applications-section">

            <div className="section-header">

              <div>

                <h2>
                  Последние заявки
                </h2>

                <p>
                  Недавно созданные заявки клиентов
                </p>

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


            <div className="applications-list">

              {applicationList.map(
                (application) => {

                  const currentStatus =
                    applicationStatuses[
                      application.id
                    ] ??
                    application.status

                  return (
                    <div
                      className="application-card"
                      key={application.id}
                      onClick={() => {
                        setSelectedApplication(
                          application.id
                        )
                        setActivePage('applications')
                      }}
                    >

                      <div className="application-number">
                        #{application.id}
                      </div>


                      <div className="application-info">

                        <strong>
                          {application.client}
                        </strong>

                        <span>
                          {application.device}
                        </span>

                      </div>


                      <div className="status">
                        {currentStatus}
                      </div>

                    </div>
                  )
                }
              )}

            </div>

          </section>

        </section>

      </main>
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

          <h1>
            Вход в систему
          </h1>

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
                onChange={(event) =>
                  setAccessCode(event.target.value)
                }
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
        setError('')
      }}
    />
  )
}

export default App