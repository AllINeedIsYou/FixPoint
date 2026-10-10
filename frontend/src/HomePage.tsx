import './HomePage.css';

// Функцияz, которую передаст App.tsx для открытия входа сотрудников.
type HomePageProps = {
  onEmployeeClick: () => void;
};

export default function HomePage({ onEmployeeClick }: HomePageProps) {
  return (
    <div className="fp-home">
      {/* Верхняя панель сайта */}
      <header className="fp-header">
        <a className="fp-logo" href="#home">
          <span className="fp-logo-icon">F</span>
          <span>
            <strong>FixPoint</strong>
            <small>СЕРВИСНЫЙ ЦЕНТР</small>
          </span>
        </a>

        <nav className="fp-nav">
          <a href="#services">Услуги</a>
          <a href="#process">Как мы работаем</a>
          <a href="#contacts">Контакты</a>
        </nav>

        <button
          className="fp-employee-button"
          onClick={onEmployeeClick}
        >
          <span>↗</span> Сотрудникам
        </button>
      </header>

      <main id="home">
        {/* !!!!!Первый экран со слоганами из жпт, ПЕРЕДЕЛАЙ ПОТОМ АЛООО*/}
        <section className="fp-hero">
          <div className="fp-hero-content">
            <div className="fp-eyebrow">
              <span className="fp-status-dot" />
              РЕМОНТ ТЕХНИКИ БЕЗ ЛИШНИХ ХЛОПОТ
            </div>

            <h1>
              Вернём вашей
              <br />
              технике <span>жизнь</span>
            </h1>

            <p className="fp-hero-description">
              Диагностика, ремонт и обслуживание техники.
              Объясняем, что случилось, согласовываем стоимость
              и держим вас в курсе каждого этапа.
            </p>

            <div className="fp-hero-actions">
              <a className="fp-primary-button" href="#contacts">
                Оставить заявку <span>↗</span>
              </a>
              <a className="fp-secondary-button" href="#process">
                Как всё устроено
              </a>
            </div>

            <div className="fp-trust-row">
              <div className="fp-trust-item">
                <strong>01</strong>
                <span>Приём техники</span>
              </div>
              <div className="fp-trust-item">
                <strong>02</strong>
                <span>Диагностика</span>
              </div>
              <div className="fp-trust-item">
                <strong>03</strong>
                <span>Ремонт и выдача</span>
              </div>
            </div>
          </div>

          {/* тут декоративная иллюстрация без внешних изображений(потом сделать) */}
          <div className="fp-hero-visual" aria-hidden="true">
            <div className="fp-orbit fp-orbit-one" />
            <div className="fp-orbit fp-orbit-two" />

            <div className="fp-device">
              <div className="fp-device-top">
                <span />
                <span />
                <span />
              </div>

              <div className="fp-device-screen">
                <div className="fp-screen-label">FIXPOINT / SYSTEM</div>
                <div className="fp-screen-symbol">+</div>
                <div className="fp-screen-line" />
                <div className="fp-screen-line short" />
                <div className="fp-screen-footer">
                  <span>SERVICE</span>
                  <span>READY_</span>
                </div>
              </div>

              <div className="fp-device-bottom">
                <span>PRECISION REPAIR</span>
                <span>FP—01</span>
              </div>
            </div>

            <div className="fp-floating-card fp-card-top">
              <span className="fp-card-icon">✓</span>
              <span>
                <strong>Под контролем</strong>
                <small>Каждый этап ремонта</small>
              </span>
            </div>

            <div className="fp-floating-card fp-card-bottom">
              <span className="fp-card-icon fp-card-icon-orange">↗</span>
              <span>
                <strong>Понятный процесс</strong>
                <small>От заявки до выдачи</small>
              </span>
            </div>

            <div className="fp-visual-index">01 / SERVICE</div>
          </div>
        </section>

        {/* Услуги */}
        <section className="fp-section fp-services" id="services">
          <div className="fp-section-heading">
            <div>
              <div className="fp-section-label">ЧЕМ МЫ ПОМОЖЕМ</div>
              <h2>Техника заслуживает<br />второго шанса</h2>
            </div>
            <p>
              От первичной проверки до завершения ремонта —
              всё в одном месте.
            </p>
          </div>

          <div className="fp-service-grid">
            <article className="fp-service-card">
              <span className="fp-service-number">01 / CHECK</span>
              <div className="fp-service-icon">⌕</div>
              <h3>Диагностика</h3>
              <p>
                Определяем причину неисправности и объясняем,
                какие работы действительно необходимы.
              </p>
              <span className="fp-service-arrow">↗</span>
            </article>

            <article className="fp-service-card">
              <span className="fp-service-number">02 / REPAIR</span>
              <div className="fp-service-icon">⌘</div>
              <h3>Ремонт техники</h3>
              <p>
                Организуем ремонт, контролируем ход работ
                и проверяем результат перед выдачей.
              </p>
              <span className="fp-service-arrow">↗</span>
            </article>

            <article className="fp-service-card">
              <span className="fp-service-number">03 / CARE</span>
              <div className="fp-service-icon">✳</div>
              <h3>Обслуживание</h3>
              <p>
                Помогаем разобраться с состоянием устройства
                и подобрать необходимые работы.
              </p>
              <span className="fp-service-arrow">↗</span>
            </article>
          </div>
        </section>

        {/* Этапы работы */}
        <section className="fp-process" id="process">
          <div className="fp-section-label">ПРОСТО И ПРОЗРАЧНО</div>
          <h2>От проблемы к решению</h2>
          <p className="fp-process-intro">
            Вы знаете, что происходит с вашей техникой,
            а мы знаем, какой следующий шаг.
          </p>

          <div className="fp-process-grid">
            <div className="fp-process-step">
              <span>01</span>
              <h3>Оставляете заявку</h3>
              <p>Рассказываете, что случилось с устройством.</p>
            </div>
            <div className="fp-process-step">
              <span>02</span>
              <h3>Проводим диагностику</h3>
              <p>Уточняем неисправность и необходимые работы.</p>
            </div>
            <div className="fp-process-step">
              <span>03</span>
              <h3>Согласовываем ремонт</h3>
              <p>Обсуждаем стоимость и дальнейшие действия.</p>
            </div>
            <div className="fp-process-step">
              <span>04</span>
              <h3>Возвращаем технику</h3>
              <p>Завершаем работы и подготавливаем устройство к выдаче.</p>
            </div>
          </div>
        </section>

        {/* Контакты -пока демонстрационный блок */}
        <section className="fp-contact" id="contacts">
          <div>
            <div className="fp-section-label">МЫ НА СВЯЗИ</div>
            <h2>Начнём с вашей проблемы.</h2>
            <p>
              Расскажите о неисправности — вместе разберёмся,
              что делать дальше.
            </p>
          </div>

          <div className="fp-contact-actions">
            <a className="fp-primary-button" href="mailto:">
              Связаться с нами <span>↗</span>
            </a>
            <small>
              тут контакты и форма заявки потом добавлю.
            </small>
          </div>
        </section>
      </main>

      {/* Нижняя часть сайта */}
      <footer className="fp-footer">
        <a className="fp-logo fp-footer-logo" href="#home">
          <span className="fp-logo-icon">F</span>
          <span>
            <strong>FixPoint</strong>
            <small>СЕРВИСНЫЙ ЦЕНТР</small>
          </span>
        </a>

        <span>© FixPoint · Сервис, которому можно доверять.</span>

        <button
          className="fp-footer-employee"
          onClick={onEmployeeClick}
        >
          Вход для сотрудников ↗
        </button>
      </footer>
    </div>
  );
}