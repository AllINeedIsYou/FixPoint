
type SidebarProps = {
  role: string
  activePage: string
  onNavigate: (page: string) => void
  onLogout: () => void
}

function Sidebar({
  role,
  activePage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const menuItems = [
    {
      page: 'home',
      label: 'Главная',
      roles: ['operator', 'engineer', 'repairer', 'admin'],
    },
    {
      page: 'applications',
      label: role === 'operator' || role === 'admin'
        ? 'Все заявки'
        : 'Мои заявки',
      roles: ['operator', 'engineer', 'repairer', 'admin'],
    },
    {
      page: 'clients',
      label: 'Клиенты',
      roles: ['operator'],
    },
    {
      page: 'employees',
      label: 'Сотрудники',
      roles: ['admin'],
    },
    {
      page: 'stock',
      label: role === 'repairer' ? 'Склад запчастей' : 'Склад',
      roles: ['admin', 'repairer'],
    },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>Fix</span>
        <strong>Point</strong>
      </div>

      <nav className="sidebar-nav">
        {menuItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <button
              key={item.page}
              className={`nav-item ${
                activePage === item.page ? 'active' : ''
              }`}
              onClick={() => onNavigate(item.page)}
            >
              {item.label}
            </button>
          ))}
      </nav>

      <button className="logout-button" onClick={onLogout}>
        Выйти
      </button>
    </aside>
  )
}

export default Sidebar