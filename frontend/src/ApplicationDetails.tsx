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

export type ApplicationAction =
  | 'take-engineer'
  | 'diagnose'
  | 'take-repair'
  | 'repair'
  | 'take-check'
  | 'check'
  | 'issue'
  | 'release'

type ActionData = {
  diagnostic_info?: string
  passed?: boolean
  comment?: string
}

type ApplicationDetailsProps = {
  application: Application
  currentStatus: string
  statusInfo: number
  role: string
  employeeId: number | null
  assigneeEngineerId: number | null
  assigneeRepairerId: number | null
  checkResult: string
  diagnosis: string
  onDiagnosisChange: (value: string) => void
  onAction: (action: ApplicationAction, data?: ActionData) => Promise<void>
  onRelease: () => Promise<void>
  onDelete: () => Promise<void>
  onBack: () => void
  stock: StockPart[]
  usedParts: UsedPart[]
  canEditParts: boolean
  workCost: number
  partsCost: number
  totalCost: number
  onAddPart: (stockPartId: number) => Promise<void>
  onRemovePart: (partId: number) => Promise<void>
}

function ApplicationDetails({
  application,
  currentStatus,
  statusInfo,
  role,
  employeeId,
  assigneeEngineerId,
  assigneeRepairerId,
  checkResult,
  diagnosis,
  onDiagnosisChange,
  onAction,
  onRelease,
  onDelete,
  onBack,
  stock,
  usedParts,
  canEditParts,
  workCost,
  partsCost,
  totalCost,
  onAddPart,
  onRemovePart,
}: ApplicationDetailsProps) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkComment, setCheckComment] = useState('')
  const [checkPassed, setCheckPassed] = useState(true)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)

  async function runAction(action: ApplicationAction, data?: ActionData) {
    setBusy(true)
    setError('')
    try {
      await onAction(action, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие')
    } finally {
      setBusy(false)
    }
  }

  const isMyEngineerAssignment =
    employeeId !== null && assigneeEngineerId === employeeId
  const isMyRepairerAssignment =
    employeeId !== null && assigneeRepairerId === employeeId
  const canRelease =
    (role === 'engineer' && (statusInfo === 0 || statusInfo === 2) && isMyEngineerAssignment) ||
    (role === 'repairer' && statusInfo === 1 && isMyRepairerAssignment) ||
    ((role === 'operator' || role === 'admin') &&
      ((statusInfo === 0 || statusInfo === 2) && assigneeEngineerId !== null ||
       statusInfo === 1 && assigneeRepairerId !== null))

  async function releaseAssignment() {
    setBusy(true)
    setError('')
    try {
      await onRelease()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось снять исполнителя')
    } finally {
      setBusy(false)
    }
  }

  const nextStep = (() => {
    if (statusInfo < 0) return 'Сначала оператор должен завершить доставку в ремонтный центр.'
    if (statusInfo === 0) return 'Инженер принимает заявку и проводит диагностику.'
    if (statusInfo === 1) return 'Мастер выполняет ремонт и указывает использованные запчасти.'
    if (statusInfo === 2) return 'Инженер проверяет качество выполненного ремонта.'
    if (statusInfo === 3) return 'Оператор может выдать устройство клиенту.'
    if (statusInfo === 4) return 'Заявка закрыта.'
    return 'Текущий этап обработки заявки.'
  })()

  return (
    <div className="app-detail">
      <button className="app-detail-back" onClick={onBack}>
        ← Назад к заявкам
      </button>

      <header className="app-detail-header">
        <div>
          <p className="app-detail-eyebrow">ЗАЯВКА #{application.id}</p>
          <h1>Карточка заявки</h1>
          <p className="app-detail-subtitle">
            Информация об устройстве и ходе ремонта
          </p>
        </div>
        <span className="app-detail-status">{currentStatus}</span>
      </header>

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
            <span>Текущий этап</span>
            <strong>{currentStatus}</strong>
          </div>
        </div>
      </section>

      {role === 'engineer' && (
        <section className="app-detail-card">
          <h2>Работа инженера</h2>

          {statusInfo === 0 && assigneeEngineerId === null && (
            <>
              <p>Заявка ожидает диагностики. Сначала закрепи её за собой.</p>
              <button
                className="app-detail-primary"
                disabled={busy}
                onClick={() => void runAction('take-engineer')}
              >
                {busy ? 'Выполняем...' : 'Принять заявку'}
              </button>
            </>
          )}

          {statusInfo === 0 && isMyEngineerAssignment && (
            <div className="app-detail-form">
              <p>Заявка закреплена за тобой. Внеси результат диагностики.</p>
              <label htmlFor="diagnosis-result">Результат диагностики</label>
              <textarea
                id="diagnosis-result"
                value={diagnosis}
                onChange={(event) => onDiagnosisChange(event.target.value)}
                placeholder="Опиши обнаруженную неисправность, результаты проверки и рекомендации по ремонту..."
                rows={5}
              />
              <p className="app-detail-hint">
                После отправки диагностики заявка станет доступна мастерам.
              </p>
              <button
                className="app-detail-primary"
                disabled={busy || !diagnosis.trim()}
                onClick={() =>
                  void runAction('diagnose', {
                    diagnostic_info: diagnosis.trim(),
                  })
                }
              >
                {busy ? 'Отправляем...' : 'Завершить диагностику'}
              </button>
            </div>
          )}

          {statusInfo === 0 && assigneeEngineerId !== null && !isMyEngineerAssignment && (
            <p className="app-detail-muted">
              Заявка уже закреплена за другим инженером.
            </p>
          )}

          {statusInfo === 1 && (
            <p className="app-detail-success">
              Диагностика завершена. Заявка передана на этап ремонта.
            </p>
          )}

          {statusInfo === 2 && assigneeEngineerId === null && (
            <>
              <p>Ремонт завершён. Инженер должен принять заявку на проверку.</p>
              <button
                className="app-detail-primary"
                disabled={busy}
                onClick={() => void runAction('take-check')}
              >
                {busy ? 'Выполняем...' : 'Принять на проверку'}
              </button>
            </>
          )}

          {statusInfo === 2 && isMyEngineerAssignment && (
            <div className="app-detail-form">
              <p>Проверь результат ремонта.</p>
              <label className="app-detail-check-option">
                <input
                  type="radio"
                  checked={checkPassed}
                  onChange={() => setCheckPassed(true)}
                />
                Проверка пройдена
              </label>
              <label className="app-detail-check-option">
                <input
                  type="radio"
                  checked={!checkPassed}
                  onChange={() => setCheckPassed(false)}
                />
                Проверка не пройдена
              </label>
              {!checkPassed && (
                <>
                  <label htmlFor="check-comment">Что необходимо исправить</label>
                  <textarea
                    id="check-comment"
                    value={checkComment}
                    onChange={(event) => setCheckComment(event.target.value)}
                    rows={4}
                    placeholder="Опиши, что не так с ремонтом..."
                  />
                </>
              )}
              <button
                className="app-detail-primary"
                disabled={busy || (!checkPassed && !checkComment.trim())}
                onClick={() =>
                  void runAction('check', {
                    passed: checkPassed,
                    comment: checkPassed ? checkComment.trim() || undefined : checkComment.trim(),
                  })
                }
              >
                {busy ? 'Сохраняем...' : checkPassed ? 'Подтвердить ремонт' : 'Отправить на повторную диагностику'}
              </button>
            </div>
          )}

          {statusInfo === 2 && assigneeEngineerId !== null && !isMyEngineerAssignment && (
            <p className="app-detail-muted">
              Проверка ремонта уже закреплена за другим инженером.
            </p>
          )}

          {statusInfo === 3 && (
            <p className="app-detail-success">
              Проверка пройдена. Устройство готово к выдаче клиенту.
            </p>
          )}
          {statusInfo === 4 && (
            <p className="app-detail-success">Устройство уже выдано клиенту. Заявка закрыта.</p>
          )}
        </section>
      )}

      {role === 'operator' && (
        <section className="app-detail-card">
          <h2>Выдача устройства</h2>
          {statusInfo === 3 && (
            <>
              <p>Проверка инженера пройдена. Устройство можно выдать клиенту.</p>
              <button
                className="app-detail-primary"
                disabled={busy}
                onClick={() => void runAction('issue')}
              >
                {busy ? 'Сохраняем...' : 'Подтвердить выдачу клиенту'}
              </button>
            </>
          )}
          {statusInfo === 4 && (
            <p className="app-detail-success">Устройство выдано. Заявка закрыта.</p>
          )}
          {statusInfo < 3 && (
            <p className="app-detail-muted">Выдача станет доступна после завершения ремонта и проверки инженером.</p>
          )}
        </section>
      )}

      {role === 'repairer' && (
        <section className="app-detail-card">
          <h2>Работа мастера</h2>

          {statusInfo === 1 && assigneeRepairerId === null && (
            <>
              <p>Диагностика завершена. Можно принять заявку в ремонт.</p>
              <button
                className="app-detail-primary"
                disabled={busy}
                onClick={() => void runAction('take-repair')}
              >
                {busy ? 'Выполняем...' : 'Взять в ремонт'}
              </button>
            </>
          )}

          {statusInfo === 1 && isMyRepairerAssignment && (
            <>
              <p>Заявка закреплена за тобой. После ремонта отметь его завершение.</p>
              <button
                className="app-detail-primary"
                disabled={busy}
                onClick={() => void runAction('repair')}
              >
                {busy ? 'Сохраняем...' : 'Завершить ремонт'}
              </button>
            </>
          )}

          {statusInfo === 1 && assigneeRepairerId !== null && !isMyRepairerAssignment && (
            <p className="app-detail-muted">
              Заявка уже закреплена за другим мастером.
            </p>
          )}

          {statusInfo === 2 && (
            <p className="app-detail-success">
              Ремонт завершён. Заявка ожидает проверки инженером.
            </p>
          )}
          {statusInfo >= 3 && (
            <p className="app-detail-success">Работа по заявке завершена.</p>
          )}
        </section>
      )}

      {role === 'repairer' && (
        <RepairPartsPanel
          stock={stock}
          usedParts={usedParts}
          canEdit={canEditParts}
          workCost={workCost}
          partsCost={partsCost}
          totalCost={totalCost}
          onAdd={onAddPart}
          onRemove={onRemovePart}
        />
      )}

      <section className="app-detail-card">
        <h2>Результат диагностики</h2>
        {diagnosis.trim() ? (
          <p className="app-detail-diagnosis">{diagnosis}</p>
        ) : (
          <p className="app-detail-muted">Результат диагностики пока не заполнен.</p>
        )}
      </section>

      {checkResult && (
        <section className="app-detail-card">
          <h2>Комментарий по проверке</h2>
          <p className="app-detail-diagnosis">{checkResult}</p>
        </section>
      )}

      {role === 'operator' && (
        <section className="app-detail-card">
          <h2>Удаление заявки</h2>
          {!deleteConfirmation ? (
            <button className="app-detail-secondary" disabled={busy} onClick={() => setDeleteConfirmation(true)}>
              Удалить заявку
            </button>
          ) : (
            <div className="app-detail-form">
              <p>Точно удалить заявку #{application.id}? Это действие нельзя отменить.</p>
              <div className="app-detail-actions-row">
                <button className="app-detail-secondary" disabled={busy} onClick={() => setDeleteConfirmation(false)}>Отмена</button>
                <button className="app-detail-danger" disabled={busy} onClick={() => {
                  setBusy(true)
                  setError('')
                  void onDelete().catch((err) => setError(err instanceof Error ? err.message : 'Не удалось удалить заявку')).finally(() => setBusy(false))
                }}>{busy ? 'Удаляем...' : 'Да, удалить'}</button>
              </div>
            </div>
          )}
        </section>
      )}

      {canRelease && (
        <section className="app-detail-card">
          <h2>Управление назначением</h2>
          <p className="app-detail-muted">
            Если исполнитель не может продолжить работу, его можно снять с заявки. После этого её сможет принять другой сотрудник.
          </p>
          <button
            className="app-detail-secondary"
            disabled={busy}
            onClick={() => void releaseAssignment()}
          >
            {busy ? 'Выполняем...' : 'Снять исполнителя с заявки'}
          </button>
        </section>
      )}

      {error && <p className="app-detail-error" role="alert">{error}</p>}

      <section className="app-detail-next">
        <span className="app-detail-next-icon">i</span>
        <div>
          <strong>Следующий этап</strong>
          <p>{nextStep}</p>
        </div>
      </section>
    </div>
  )
}

export default ApplicationDetails
