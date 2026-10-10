import { useState } from 'react'
import { users, applications } from './mockData'
import './App.css'
import HomePage from './HomePage'

function App() {
  // =========================
  // СОСТОЯНИЯ и хуня для работы выше
  // =========================

  const [showLogin, setShowLogin] = useState(false)

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [currentUser, setCurrentUser] = useState<{
    login: string
    password: string
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


  // =========================
  // ВХОД
  // =========================

  const handleLogin = () => {
    const user = users.find(
      (user) =>
        user.login === login &&
        user.password === password
    )

    if (user) {
      setCurrentUser(user)
      setError('')
      setActivePage('home')
      setSelectedApplication(null)
    } else {
      setError('Неверный логин или пароль')
    }
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
    setLogin('')
    setPassword('')
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
      const application = applications.find(
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


              <div className="applications-list">

                {applications.map(
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
              className="nav-item active"
              onClick={() => {
                setActivePage('home')
                setSelectedApplication(null)
              }}
            >
              Главная
            </button>


            <button
              className="nav-item"
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

              {applications.map(
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
            Войдите эбэбэбэ чето написать или не надо хз
          </p>


          <div className="form">

            <label>
              Логин

              <input
                type="text"
                placeholder="Введите логин"
                value={login}
                onChange={(event) =>
                  setLogin(
                    event.target.value
                  )
                }
              />
            </label>


            <label>
              Пароль

              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
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