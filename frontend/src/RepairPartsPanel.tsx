
import './RepairPartsPanel.css'

export type StockPart = {
  id: number
  name: string
  quantity: number
  price: number
}

export type UsedPart = {
  stockPartId: number
  name: string
  price: number
  quantity: number
}

type RepairPartsPanelProps = {
  stock: StockPart[]
  usedParts: UsedPart[]
  canEdit: boolean
  onAdd: (stockPartId: number) => void
  onRemove: (stockPartId: number) => void
}

const formatPrice = (price: number) =>
  `${price.toLocaleString('ru-RU')} ₽`

function RepairPartsPanel({
  stock,
  usedParts,
  canEdit,
  onAdd,
  onRemove,
}: RepairPartsPanelProps) {
  const partsCost = usedParts.reduce(
    (sum, part) => sum + part.price * part.quantity,
    0
  )

  // Фиксированная стоимость работы согласно правилам проекта
  const laborCost = 5000
  const totalCost = laborCost + partsCost

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
          <p className="repair-parts-empty">
            Пока к заявке не добавлены запчасти.
          </p>
        ) : (
          <div className="repair-parts-list">
            {usedParts.map((part) => (
              <div
                className="repair-part-row"
                key={part.stockPartId}
              >
                <div className="repair-part-info">
                  <strong>{part.name}</strong>
                  <span>
                    {formatPrice(part.price)} × {part.quantity}
                  </span>
                </div>

                <div className="repair-part-actions">
                  <strong>
                    {formatPrice(part.price * part.quantity)}
                  </strong>

                  {canEdit && (
                    <button
                      className="repair-part-remove"
                      onClick={() => onRemove(part.stockPartId)}
                      title="Убрать одну единицу из заявки"
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
          <p className="repair-parts-empty">
            На складе пока нет запчастей.
          </p>
        ) : (
          <div className="repair-parts-list">
            {stock.map((part) => (
              <div className="repair-part-row" key={part.id}>
                <div className="repair-part-info">
                  <strong>{part.name}</strong>
                  <span>
                    В наличии: {part.quantity} шт.
                  </span>
                </div>

                <div className="repair-part-actions">
                  <strong>{formatPrice(part.price)}</strong>

                  {canEdit && (
                    <button
                      className="repair-part-add"
                      onClick={() => onAdd(part.id)}
                      disabled={part.quantity <= 0}
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
            Добавлять и убирать запчасти можно только во время ремонта.
          </p>
        )}
      </div>

      <div className="repair-parts-total">
        <div>
          <span>Работа мастера</span>
          <strong>{formatPrice(laborCost)}</strong>
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
