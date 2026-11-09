import { useState } from 'react'
import './RepairPartsPanel.css'

export type StockPart = {
  id: number
  name: string
  quantity: number
  price: number
}

export type UsedPart = {
  id: number
  stockPartId: number | null
  name: string
  price: number
  quantity: number
}

type RepairPartsPanelProps = {
  stock: StockPart[]
  usedParts: UsedPart[]
  canEdit: boolean
  workCost: number
  partsCost: number
  totalCost: number
  onAdd: (stockPartId: number) => Promise<void>
  onRemove: (partId: number) => Promise<void>
}

const formatPrice = (price: number) =>
  `${price.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`

function RepairPartsPanel({
  stock,
  usedParts,
  canEdit,
  workCost,
  partsCost,
  totalCost,
  onAdd,
  onRemove,
}: RepairPartsPanelProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function runPartAction(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить запчасти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="repair-parts">
      <div className="repair-parts-heading">
        <div>
          <h2>Запчасти и стоимость</h2>
          <p>Детали, использованные при ремонте</p>
        </div>
        <span className="repair-parts-count">
          {usedParts.reduce((sum, part) => sum + part.quantity, 0)} шт.
        </span>
      </div>

      <div className="repair-parts-used">
        <h3>Запчасти в заявке</h3>
        {usedParts.length === 0 ? (
          <p className="repair-parts-empty">Пока к заявке не добавлены запчасти.</p>
        ) : (
          <div className="repair-parts-list">
            {usedParts.map((part) => (
              <div className="repair-part-row" key={part.id}>
                <div className="repair-part-info">
                  <strong>{part.name}</strong>
                  <span>{formatPrice(part.price)} × {part.quantity}</span>
                </div>
                <div className="repair-part-actions">
                  <strong>{formatPrice(part.price * part.quantity)}</strong>
                  {canEdit && (
                    <button
                      className="repair-part-remove"
                      disabled={busy}
                      onClick={() => void runPartAction(() => onRemove(part.id))}
                      title="Удалить эту запись запчасти из заявки"
                    >
                      − Убрать
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="repair-parts-stock">
        <h3>Доступно на складе</h3>
        {stock.length === 0 ? (
          <p className="repair-parts-empty">На складе пока нет запчастей.</p>
        ) : (
          <div className="repair-parts-list">
            {stock.map((part) => (
              <div className="repair-part-row" key={part.id}>
                <div className="repair-part-info">
                  <strong>{part.name}</strong>
                  <span>В наличии: {part.quantity} шт.</span>
                </div>
                <div className="repair-part-actions">
                  <strong>{formatPrice(part.price)}</strong>
                  {canEdit && (
                    <button
                      className="repair-part-add"
                      disabled={busy || part.quantity <= 0}
                      onClick={() => void runPartAction(() => onAdd(part.id))}
                    >
                      + Добавить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!canEdit && (
          <p className="repair-parts-hint">
            Добавлять и убирать запчасти можно только после того, как мастер примет заявку в ремонт.
          </p>
        )}
      </div>

      {error && <p className="app-detail-error" role="alert">{error}</p>}

      <div className="repair-parts-total">
        <div>
          <span>Работа мастера</span>
          <strong>{formatPrice(workCost)}</strong>
        </div>
        <div>
          <span>Стоимость запчастей</span>
          <strong>{formatPrice(partsCost)}</strong>
        </div>
        <div className="repair-parts-grand-total">
          <span>Предварительная стоимость</span>
          <strong>{formatPrice(totalCost)}</strong>
        </div>
      </div>
    </section>
  )
}

export default RepairPartsPanel
