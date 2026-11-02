
import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './api'
import './StockPage.css'

type StockPart = {
  id: number
  name: string
  price: number
  quantity: number
}

type StockPageProps = {
  role: string
  token: string
}

export default function StockPage({ role, token }: StockPageProps) {
  const [parts, setParts] = useState<StockPart[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingPart, setEditingPart] = useState<StockPart | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [saving, setSaving] = useState(false)

  const isAdmin = role === 'admin'

  // Получить список запчастей с бэкенда
  const loadParts = useCallback(async () => {
    if (!token) {
      setError('Нет токена сотрудника. Выйди и войди заново.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : ''

      const endpoint = isAdmin
        ? `/services/stock${query}`
        : `/repairer/stock${query}`

      const data = await apiRequest<StockPart[]>(endpoint, {
        token,
      })

      setParts(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить склад',
      )
    } finally {
      setLoading(false)
    }
  }, [isAdmin, search, token])

  useEffect(() => {
    void loadParts()
  }, [loadParts])

  // Очистить форму добавления или редактирования
  function resetForm() {
    setShowForm(false)
    setEditingPart(null)
    setName('')
    setPrice('')
    setQuantity('0')
  }

  // Открыть форму редактирования запчасти
  function startEditing(part: StockPart) {
    setEditingPart(part)
    setName(part.name)
    setPrice(String(part.price))
    setQuantity(String(part.quantity))
    setShowForm(true)
    setNotice('')
    setError('')
  }

  // Добавить запчасть или изменить существующую
  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedPrice = Number(price)
    const parsedQuantity = Number(quantity)

    if (!name.trim()) {
      setError('Укажи название запчасти.')
      return
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Цена должна быть больше нуля.')
      return
    }

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 0
    ) {
      setError('Количество должно быть целым числом не меньше нуля.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (editingPart) {
        await apiRequest<StockPart>(
          `/services/stock/${editingPart.id}`,
          {
            method: 'PATCH',
            body: {
              price: parsedPrice,
              quantity: parsedQuantity,
            },
            token,
          },
        )

        setNotice('Данные запчасти обновлены.')
      } else {
        await apiRequest<StockPart>('/services/stock', {
          method: 'POST',
          body: {
            name: name.trim(),
            price: parsedPrice,
            quantity: parsedQuantity,
          },
          token,
        })

        setNotice('Запчасть добавлена на склад.')
      }

      resetForm()
      await loadParts()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить запчасть',
      )
    } finally {
      setSaving(false)
    }
  }

  const totalParts = parts.reduce(
    (sum, part) => sum + part.quantity,
    0,
  )

  const emptyParts = parts.filter(
    (part) => part.quantity === 0,
  ).length

  return (
    <section className="dashboard-content stock-page">
      <header className="dashboard-header stock-header">
        <div>
          <p className="dashboard-label">УЧЁТ ЗАПЧАСТЕЙ</p>
          <h1>Склад</h1>
          <p className="stock-description">
            Остатки запчастей и цены в сервисном центре FixPoint.
          </p>
        </div>

        {isAdmin && (
          <button
            className="stock-primary-button"
            onClick={() => {
              resetForm()
              setShowForm(true)
              setError('')
              setNotice('')
            }}
          >
            + Добавить запчасть
          </button>
        )}
      </header>

      <div className="stock-summary">
        <article className="stock-summary-card">
          <span>Видов запчастей</span>
          <strong>{parts.length}</strong>
        </article>

        <article className="stock-summary-card">
          <span>Всего единиц</span>
          <strong>{totalParts}</strong>
        </article>

        <article className="stock-summary-card">
          <span>Нет в наличии</span>
          <strong>{emptyParts}</strong>
        </article>
      </div>

      {showForm && isAdmin && (
        <form className="stock-form" onSubmit={handleSave}>
          <h2>
            {editingPart ? 'Редактирование запчасти' : 'Новая запчасть'}
          </h2>

          <label>
            Название
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, аккумулятор"
              maxLength={255}
              required
              disabled={Boolean(editingPart)}
            />
          </label>

          <div className="stock-form-row">
            <label>
              Цена за единицу, ₽
              <input
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </label>

            <label>
              Количество
              <input
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="stock-form-actions">
            <button
              type="submit"
              className="stock-primary-button"
              disabled={saving}
            >
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>

            <button
              type="button"
              className="stock-secondary-button"
              onClick={resetForm}
              disabled={saving}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="stock-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск запчасти по названию..."
          aria-label="Поиск запчасти"
        />

        <button
          className="stock-secondary-button"
          onClick={() => void loadParts()}
          disabled={loading}
        >
          Найти
        </button>
      </div>

      {notice && (
        <p className="stock-notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="stock-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="stock-empty">Загружаем склад...</div>
      ) : parts.length === 0 ? (
        <div className="stock-empty">
          Запчасти не найдены. Попробуй изменить запрос.
        </div>
      ) : (
        <div className="stock-list">
          {parts.map((part) => (
            <article className="stock-part-card" key={part.id}>
              <div className="stock-part-icon">
                <span>{part.name.charAt(0).toUpperCase()}</span>
              </div>

              <div className="stock-part-info">
                <h3>{part.name}</h3>
                <span>ID: {part.id}</span>
              </div>

              <div className="stock-part-quantity">
                <span>Остаток</span>
                <strong className={part.quantity === 0 ? 'out-of-stock' : ''}>
                  {part.quantity} шт.
                </strong>
              </div>

              <div className="stock-part-price">
                <span>Цена</span>
                <strong>
                  {part.price.toLocaleString('ru-RU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ₽
                </strong>
              </div>

              {isAdmin && (
                <button
                  className="stock-secondary-button"
                  onClick={() => startEditing(part)}
                >
                  Изменить
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
