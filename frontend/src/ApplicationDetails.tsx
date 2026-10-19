
import { useState } from 'react'
import './ApplicationDetails.css'

import RepairPartsPanel, {
  type StockPart,
  type UsedPart,
} from './RepairPartsPanel'

type Application = {
  id: number
  client: string
  device: string
  status: string
}

type ApplicationDetailsProps = {
  application: Application
  currentStatus: string
  role: string
  diagnosis: string
  onDiagnosisChange: (value: string) => void
  onStatusChange: (status: string) => void
  onBack: () => void

  // Новые свойства для запчастей
  stock: StockPart[]
  usedParts: UsedPart[]
  canEditParts: boolean
  onAddPart: (stockPartId: number) => void
  onRemovePart: (stockPartId: number) => void
}

function ApplicationDetails({
  application,
  currentStatus,
  role,
  diagnosis,
  onDiagnosisChange,
  onStatusChange,
  onBack,
  stock,
  usedParts,
  canEditParts,
  onAddPart,
  onRemovePart,
}: ApplicationDetailsProps) {
  // Состояние используется только для сообщения об ошибке формы
  const [error, setError] = useState('')

  const finishDiagnosis = () => {
    if (!diagnosis.trim()) {
      setError('Сначала укажите результат диагностики')
      return
    }

    setError('')
    onStatusChange('Ожидание ремонта')
  }

  const getNextStep = () => {
    if (currentStatus === 'Новая') {
      return 'Инженер должен принять заявку в работу'
    }

    if (
      currentStatus === 'В работе у инженера' ||
      currentStatus === 'Диагностика'
    ) {
      return 'После диагностики заявка будет передана мастеру'
    }

    if (
      currentStatus === 'Ожидание ремонта' ||
      currentStatus === 'В ремонте'
    ) {
      return 'Следующий этап — завершение ремонта'
    }

    if (currentStatus === 'Готово') {
      return 'Ремонт завершён. Можно организовать выдачу устройства'
    }

    return 'Текущий этап обработки заявки'
  }

  return (
    <div className="app-detail">
      <button className="app-detail-back" onClick={onBack}>
        ← Назад к заявкам
      </button>

      <header className="app-detail-header">
        <div>
          <p className="app-detail-eyebrow">
            ЗАЯВКА #{application.id}
          </p>
          <h1>Карточка заявки</h1>
          <p className="app-detail-subtitle">
            Информация об устройстве и ходе ремонта
          </p>
        </div>

        <span className="app-detail-status">
          {currentStatus}
        </span>
      </header>

      {/* Основная информация о заявке */}
      <section className="app-detail-card">
        <h2>Информация о клиенте и устройстве</h2>

        <div className="app-detail-info-grid">
          <div className="app-detail-info-item">
            <span>Номер заявки</span>
            <strong>#{application.id}</strong>
          </div>

          <div className="app-detail-info-item">
            <span>Клиент</span>
            <strong>{application.client}</strong>
          </div>

          <div className="app-detail-info-item">
            <span>Устройство</span>
            <strong>{application.device}</strong>
          </div>

          <div className="app-detail-info-item">
            <span>Текущий статус</span>
            <strong>{currentStatus}</strong>
          </div>
        </div>
      </section>

      {/* Рабочие действия инженера */}
      {role === 'engineer' && (
        <section className="app-detail-card">
          <h2>Работа инженера</h2>

          {currentStatus === 'Новая' && (
            <>
              <p>
                Заявка ещё не принята в работу.
              </p>

              <button
                className="app-detail-primary"
                onClick={() =>
                  onStatusChange('В работе у инженера')
                }
              >
                Принять заявку
              </button>
            </>
          )}

          {currentStatus === 'В работе у инженера' && (
            <>
              <p>
                Заявка назначена инженеру. Можно приступать к проверке.
              </p>

              <button
                className="app-detail-primary"
                onClick={() => onStatusChange('Диагностика')}
              >
                Начать диагностику
              </button>
            </>
          )}

          {currentStatus === 'Диагностика' && (
            <div className="app-detail-form">
              <label htmlFor="diagnosis-result">
                Результат диагностики
              </label>

              <textarea
                id="diagnosis-result"
                value={diagnosis}
                onChange={(event) => {
                  onDiagnosisChange(event.target.value)
                  setError('')
                }}
                placeholder="Опиши обнаруженную неисправность, результаты проверки и рекомендации по ремонту..."
                rows={5}
              />

              <p className="app-detail-hint">
                Укажите, что неисправно и какие работы необходимы.
              </p>

              {error && (
                <p className="app-detail-error">{error}</p>
              )}

              <button
                className="app-detail-primary"
                onClick={finishDiagnosis}
              >
                Завершить диагностику
              </button>
            </div>
          )}

          {currentStatus === 'Ожидание ремонта' && (
            <p className="app-detail-success">
              Диагностика завершена. Заявка ожидает ремонта.
            </p>
          )}
        </section>
      )}

      {/* Действия мастера */}
      {role === 'repairer' && (
        <section className="app-detail-card">
          <h2>Работа мастера</h2>

          {currentStatus === 'Ожидание ремонта' && (
            <>
              <p>
                Заявка ожидает начала ремонта.
              </p>

              <button
                className="app-detail-primary"
                onClick={() => onStatusChange('В ремонте')}
              >
                Взять в ремонт
              </button>
            </>
          )}

          {currentStatus === 'В ремонте' && (
            <>
              <p>
                После выполнения ремонта завершите этот этап.
              </p>

              <button
                className="app-detail-primary"
                onClick={() => onStatusChange('Готово')}
              >
                Завершить ремонт
              </button>
            </>
          )}

          {currentStatus === 'Готово' && (
            <p className="app-detail-success">
              Ремонт отмечен как завершённый.
            </p>
          )}
        </section>
      )}

      {/* Запчасти, использованные при ремонте */}
        {role === 'repairer' && (
        <RepairPartsPanel
            stock={stock}
            usedParts={usedParts}
            canEdit={canEditParts}
            onAdd={onAddPart}
            onRemove={onRemovePart}
        />
        )}


      {/* Результат диагностики виден при повторном открытии заявки */}
      <section className="app-detail-card">
        <h2>Результат диагностики</h2>

        {diagnosis.trim() ? (
          <p className="app-detail-diagnosis">
            {diagnosis}
          </p>
        ) : (
          <p className="app-detail-muted">
            Результат диагностики пока не заполнен.
          </p>
        )}
      </section>

      {/* Подсказка о следующем этапе */}
      <section className="app-detail-next">
        <span className="app-detail-next-icon">i</span>

        <div>
          <strong>Следующий этап</strong>
          <p>{getNextStep()}</p>
        </div>
      </section>
    </div>
  )
}

export default ApplicationDetails
