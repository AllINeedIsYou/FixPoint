export const users = [
  {
    login: 'operator',
    password: 'DW785YE6RVJA',
    role: 'operator',
    name: 'Иван Петров',
  },
  {
    login: 'engineer',
    password: 'D0KND8UDUVTL',
    role: 'engineer',
    name: 'Ахмед Крутой',
  },
  {
    login: 'repairer',
    password: '0A0NW3HHKK6J',
    role: 'repairer',
    name: 'Билл Гейтс',
  },
  {
    login: 'admin',
    password: 'A0ANW3KKHH6J',
    role: 'admin',
    name: 'Администратор Юлия',
  },
]

//тестовые заявки серв центра
export const applications = [
  {
    id: 1024,
    client: 'Иван Петров',
    device: 'Ноутбук ASUS TUF Gaming',
    status: 'В работе у инженера',
    description: 'Ноутбук перегревается во время работы',
    assignedTo: 'engineer',
    parts: [],
  },
  {
    id: 1023,
    client: 'Анна Смирнова',
    device: 'iPhone 15',
    status: 'Диагностика',
    description: 'Телефон быстро разряжается почините пж',
    assignedTo: 'engineer',
    parts: [],
  },
  {
    id: 1022,
    client: 'Дмитрий Орлов',
    device: 'MacBook Air M2',
    status: 'Готово',
    description: 'Необходимо проверить устройство после ремонта',
    assignedTo: 'repairer',
    parts: [],
  },
]

//тестовые клиенты
export const clients = [
  {
    id: 1,
    name: 'Иван Петров',
    phone: '+7 900 11-22-33'
  },
  {
    id: 2,
    name: 'Анна Смирнова',
    phone: '+7 900 222-33-44'
  },
  {
    id: 3,
    name: 'Дмитрий Орлов',
    phone: '+7 900 333-44-55'
  },
]

// тестовый склад для админа и мастера данные вымышлены и ни с чем не свяханы пока ч
export const stockParts = [
  {
    id: 1,
    name: 'SSD Kingston 1 TB',
    quantity: 8,
    price: 6500,
  },
  {
    id: 2,
    name: 'Оперативная память DDR4 8 GB',
    quantity: 12,
    price: 2200,
  },
  {
    id: 3,
    name: 'Аккумулятор для ноутбука ASUS',
    quantity: 4,
    price: 4800,
  },
  {
    id: 4,
    name: 'Вентилятор охлаждения',
    quantity: 6,
    price: 1500,
  },
]