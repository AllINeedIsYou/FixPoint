
import { useState, type FormEvent } from 'react'
import './EmployeesPage.css'

export type Employee = {
  id: number
  name: string
  role: string
  active: boolean
}

type EmployeesPageProps = {
  employees: Employee[]
  loading: boolean
  error: string
  onToggleActive: (id: number) => Promise<void>
  onGenerateCode: (id: number) => Promise<string>
  onCreateEmployee: (FIO: string, role: string) => Promise<string>
}

const roleNames: Record<string, string> = {
  operator: 'Оператор',
  engineer: 'Инженер',
  repairer: 'Мастер',
  admin: 'Администратор',
}

function EmployeesPage({
  employees,
  loading,
  error,
  onToggleActive,
  onGenerateCode,
  onCreateEmployee,
}: EmployeesPageProps) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [newCode, setNewCode] = useState('')
  const [codeEmployee, setCodeEmployee] = useState('')
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeRole, setNewEmployeeRole] = useState('operator')
  const [creating, setCreating] = useState(false)

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newEmployeeName.trim()) {
      setNotice('Укажи ФИО нового сотрудника.')
      return
    }
    setCreating(true)
    setNotice('')
    setNewCode('')
    try {
      const code = await onCreateEmployee(newEmployeeName.trim(), newEmployeeRole)
      setNewCode(code)
      setCodeEmployee(newEmployeeName.trim())
      setNewEmployeeName('')
      setNewEmployeeRole('operator')
      setNotice('Сотрудник добавлен. Сохрани код доступа и передай его сотруднику.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Не удалось создать сотрудника')
    } finally {
      setCreating(false)
    }
  }

  async function handleGenerateCode(employee: Employee) {
    setBusyId(employee.id)
    setNotice('')
    setNewCode('')
    setCodeEmployee('')

    try {
      const code = await onGenerateCode(employee.id)
      setNewCode(code)
      setCodeEmployee(employee.name)
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Не удалось перевыпустить код',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(employee: Employee) {
    setBusyId(employee.id)
    setNotice('')

    try {
      await onToggleActive(employee.id)
      setNotice(
        employee.active
          ? `Доступ сотрудника «${employee.name}» отключён.`
          : `Доступ сотрудника «${employee.name}» активирован.`,
      )
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Не удалось изменить доступ',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(newCode)
      setNotice('Код скопирован в буфер обмена.')
    } catch {
      setNotice('Не удалось скопировать код. Выдели его и скопируй вручную.')
    }
  }

  return (
    <section className="dashboard-content employees-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-label">УПРАВЛЕНИЕ ДОСТУПОМ</p>
          <h1>Сотрудники</h1>
          <p className="employees-description">
            Список работников и управление их учётными записями.
          </p>
        </div>
      </header>

      <section className="applications-section">
        <div className="employees-summary">
          <div className="employee-summary-card">
            <span>Всего сотрудников</span>
            <strong>{employees.length}</strong>
          </div>

          <div className="employee-summary-card">
            <span>Активных</span>
            <strong>
              {employees.filter((employee) => employee.active).length}
            </strong>
          </div>

          <div className="employee-summary-card">
            <span>Заблокировано</span>
            <strong>
              {employees.filter((employee) => !employee.active).length}
            </strong>
          </div>
        </div>

        <form className="employee-card employee-create-form" onSubmit={handleCreateEmployee}>
          <h2>Добавить сотрудника</h2>
          <label>
            ФИО
            <input
              value={newEmployeeName}
              onChange={(event) => setNewEmployeeName(event.target.value)}
              placeholder="Иванов Иван Иванович"
              maxLength={255}
              required
            />
          </label>
          <label>
            Должность
            <select value={newEmployeeRole} onChange={(event) => setNewEmployeeRole(event.target.value)}>
              <option value="operator">Оператор</option>
              <option value="engineer">Инженер</option>
              <option value="repairer">Мастер</option>
            </select>
          </label>
          <button className="secondary-button" type="submit" disabled={creating}>
            {creating ? 'Создаём...' : 'Создать сотрудника и получить код'}
          </button>
        </form>

        <h2>Список сотрудников</h2>

        {notice && (
          <p className="employee-empty" role="status">
            {notice}
          </p>
        )}

        {newCode && (
          <div className="employee-card">
            <h3>Новый код доступа</h3>
            <p>
              Сотрудник: <strong>{codeEmployee}</strong>
            </p>
            <p>
              Сохрани код сейчас: повторно получить этот же код из базы нельзя.
            </p>
            <div className="employee-access">
              <code>{newCode}</code>
            </div>
            <div className="employee-actions">
              <button
                className="secondary-button"
                onClick={copyCode}
              >
                Скопировать код
              </button>
              <button
                className="employee-activate-button"
                onClick={() => {
                  setNewCode('')
                  setCodeEmployee('')
                }}
              >
                Скрыть код
              </button>
            </div>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}

        {loading ? (
          <div className="employee-empty">Загружаем сотрудников...</div>
        ) : employees.length === 0 ? (
          <div className="employee-empty">
            Сотрудников пока нет или список не удалось загрузить.
          </div>
        ) : (
          <div className="employees-list">
            {employees.map((employee) => (
              <article className="employee-card" key={employee.id}>
                <div className="employee-card-top">
                  <div className="employee-avatar">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="employee-main-info">
                    <strong>{employee.name}</strong>
                    <span>
                      {roleNames[employee.role] ?? employee.role}
                    </span>
                    <span>ID: {employee.id}</span>
                  </div>

                  <span
                    className={`employee-status ${
                      employee.active ? 'is-active' : 'is-blocked'
                    }`}
                  >
                    {employee.active ? 'Активен' : 'Заблокирован'}
                  </span>
                </div>

                <div className="employee-access">
                  <span>Код доступа</span>
                  <code>Не отображается в целях безопасности</code>
                </div>

                <div className="employee-actions">
                  <button
                    className="secondary-button"
                    disabled={busyId !== null}
                    onClick={() => void handleGenerateCode(employee)}
                  >
                    {busyId === employee.id
                      ? 'Подождите...'
                      : 'Перевыпустить код'}
                  </button>

                  <button
                    className={
                      employee.active
                        ? 'employee-block-button'
                        : 'employee-activate-button'
                    }
                    disabled={busyId !== null}
                    onClick={() => void handleToggleActive(employee)}
                  >
                    {employee.active ? 'Заблокировать' : 'Активировать'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default EmployeesPage
