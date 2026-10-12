import './EmployeesPage.css'

// Описание одного сотрудника
export type Employee = {
  login: string
  password: string
  role: string
  name: string
  active: boolean
}

type EmployeesPageProps = {
  employees: Employee[]
  onToggleActive: (login: string) => void
  onGenerateCode: (login: string) => void
}

// Переводим технические названия ролей на русский
const roleNames: Record<string, string> = {
  operator: 'Оператор',
  engineer: 'Инженер',
  repairer: 'Мастер',
  admin: 'Администратор',
}

function EmployeesPage({
  employees,
  onToggleActive,
  onGenerateCode,
}: EmployeesPageProps) {
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

        <h2>Список сотрудников</h2>

        {employees.length === 0 ? (
          <div className="employee-empty">
            Сотрудников пока нет.
          </div>
        ) : (
          <div className="employees-list">
            {employees.map((employee) => (
              <article className="employee-card" key={employee.login}>
                <div className="employee-card-top">
                  <div className="employee-avatar">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="employee-main-info">
                    <strong>{employee.name}</strong>
                    <span>@{employee.login}</span>
                    <span>
                      {roleNames[employee.role] ?? employee.role}
                    </span>
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
                  <code>{employee.password}</code>
                </div>

                <div className="employee-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onGenerateCode(employee.login)}
                  >
                    Сгенерировать новый код
                  </button>

                  <button
                    className={
                      employee.active
                        ? 'employee-block-button'
                        : 'employee-activate-button'
                    }
                    onClick={() => onToggleActive(employee.login)}
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