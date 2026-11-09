import './HomePage.css'

import logo from './assets/logo.png'
import fixi from './assets/fixi.png'
import fixiFly from './assets/fixi_fly.png'

import fixiD from './assets/fixi_d.png'
import fixiR from './assets/fixi_r.png'
import fixiO from './assets/fixi_o.png'

type HomePageProps = {
  onEmployeeClick: () => void
  onClientClick: () => void
}

function HomePage({ onEmployeeClick, onClientClick }: HomePageProps) {
  return (
    <main className="fp-home" id="home">
      {/* навигация */}
      <header className="fp-header">
        <a href="#home" className="fp-logo">
          <img src={logo} alt="" />
          <span>FixPoint</span>
        </a>

        <nav className="fp-nav">
          <a href="#services">Услуги</a>
          <a href="#process">Как мы работаем</a>
          <a href="#contacts">Контакты</a>
        </nav>

        <button className="fp-employee" onClick={onEmployeeClick}>
          <span className="fp-employee-dot" />
          Для сотрудников
          <span className="fp-arrow">↗</span>
        </button>
      </header>

      {/* первый экран */}
      <section className="fp-hero">
        <div className="fp-hero-meta">
          <span>СЕРВИСНЫЙ ЦЕНТР / 2026</span>
          <span className="fp-meta-center">РЕМОНТ • ДИАГНОСТИКА • ЗАБОТА</span>
          <span>МОСКВА · РАБОТАЕМ ДЛЯ ВАС</span>
        </div>

        <div className="fp-wordmark">
          <h1>FixPoint</h1>
          <span className="fp-wordmark-star">✳</span>
          <span className="fp-wordmark-note"></span>
        </div>

        <div className="fp-hero-main">
          <div className="fp-hero-copy">
            <div className="fp-overline">
              <span className="fp-overline-number">01</span>
              <span className="fp-overline-line" />
              <span>ТЕХНИКА В НАДЁЖНЫХ РУКАХ</span>
            </div>

            <h2>
              Когда техника
              <br />
              просит <span>помощи.</span>
            </h2>

            <p>
              Найдём причину неисправности, поможем с ремонтом
              и позаботимся о вашем устройстве.
            </p>

            <div className="fp-hero-buttons">
              <button className="fp-button-primary" onClick={onClientClick}>
                Оставить заявку <span>↗</span>
              </button>
              <a className="fp-button-link" href="#services">
                Посмотреть услуги <span>↓</span>
              </a>
            </div>

            <div className="fp-hero-footnote">
              <span>✦</span>
              ВАШЕ УСТРОЙСТВО - НАША ЗАБОТА
            </div>
          </div>

          <div className="fp-hero-art">
            <div className="fp-art-grid" />
            <div className="fp-art-orbit fp-orbit-one" />
            <div className="fp-art-orbit fp-orbit-two" />

            <span className="fp-art-spark fp-spark-one">✳</span>
            <span className="fp-art-spark fp-spark-two">✦</span>
            <span className="fp-art-label">MEET FIXI</span>
            <span className="fp-art-number">№ 001</span>

            <img
              src={fixi}
              alt="Персонаж FixPoint"
              className="fp-fixi"
            />

            <div className="fp-art-sticker">
              <span>✦</span>
              <div>
                <strong>Привет!</strong>
                <small>Я помогу тебе</small>
              </div>
            </div>
          </div>
        </div>

        <div className="fp-hero-bottom">
          <span>FIXPOINT SERVICE</span>
          <span>МЫ ЗНАЕМ, КАК ВЕРНУТЬ ТЕХНИКУ К ЖИЗНИ</span>
          <a href="#services">SCROLL TO EXPLORE ↓</a>
        </div>
      </section>

      {/* бегущая строка */}
      <div className="fp-marquee" aria-hidden="true">
        <div className="fp-marquee-track">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index}>
              FIXPOINT <i>✳</i> РЕМОНТ ТЕХНИКИ <i>✳</i> ЗАБОТА О ВАЖНОМ <i>✳</i>
            </span>
          ))}
        </div>
      </div>

            {/* услуги */}
            <section className="fp-section fp-services" id="services">
              <div className="fp-section-top">
                <div>
                  <span className="fp-eyebrow">02 / ЧЕМ МЫ ПОМОЖЕМ</span>
                  <h2>
                    Всё для вашей
                    <br />
                    <span>техники.</span>
                  </h2>
                </div>
                <p>
                  От поиска проблемы до её решения.
                  <br />
                  Разберёмся вместе.
                </p>
              </div>

              <div className="fp-service-grid">

                {/* диагностика */}
                <article className="fp-service-card fp-service-card-main">
                  <div className="fp-service-top">
                    <span>01 — ANALYSIS</span>
                    <span className="fp-service-icon">⌕</span>
                  </div>

                  <div className="fp-service-body">
                    <div className="fp-service-content">
                      <span className="fp-service-tag">СНАЧАЛА РАЗБЕРЁМСЯ</span>
                      <h3>Диагностика</h3>
                      <p>
                        Определим причину неисправности и подскажем,
                        что можно сделать.
                      </p>
                    </div>

                    <img
                      src={fixiD}
                      alt="Фикси демонстрирует диагностику"
                      className="fp-service-character"
                    />
                  </div>

                  <span className="fp-service-arrow">↗</span>
                </article>

                {/* ремонт */}
                <article className="fp-service-card fp-service-card-blue">
                  <div className="fp-service-top">
                    <span>02 — REPAIR</span>
                    <span className="fp-service-icon">✳</span>
                  </div>

                  <div className="fp-service-body">
                    <div className="fp-service-content">
                      <span className="fp-service-tag">ВОЗВРАЩАЕМ К ЖИЗНИ</span>
                      <h3>Ремонт техники</h3>
                      <p>
                        Поможем устранить неисправность и вернуть
                        устройству работоспособность.
                      </p>
                    </div>

                    <img
                      src={fixiR}
                      alt="Фикси демонстрирует ремонт техники"
                      className="fp-service-character"
                    />
                  </div>

                  <span className="fp-service-arrow">↗</span>
                </article>

                {/* обслуживание */}
                <article className="fp-service-card fp-service-card-purple">
                  <div className="fp-service-top">
                    <span>03 — CARE</span>
                    <span className="fp-service-icon">♡</span>
                  </div>

                  <div className="fp-service-body">
                    <div className="fp-service-content">
                      <span className="fp-service-tag">ЗАБОТИМСЯ О ВАЖНОМ</span>
                      <h3>Обслуживание</h3>
                      <p>
                        Поможем поддерживать устройство в хорошем
                        состоянии.
                      </p>
                    </div>

                    <img
                      src={fixiO}
                      alt="Фикси демонстрирует обслуживание техники"
                      className="fp-service-character"
                    />
                  </div>

                  <span className="fp-service-arrow">↗</span>
                </article>

              </div>

              <div className="fp-service-bottom">
                <span>НЕ УВЕРЕНЫ, КАКАЯ УСЛУГА НУЖНА?</span>
                <button onClick={onClientClick}>
                  Расскажите нам о проблеме <span>↗</span>
                </button>
              </div>
            </section>

      {/* этапы работы */}
      <section className="fp-process-section" id="process">
        <div className="fp-section fp-process">
          <div className="fp-section-top">
            <div>
              <span className="fp-eyebrow">03 / ВСЁ ПО ПОРЯДКУ</span>
              <h2>
                Четыре шага
                <br />
                до <span>результата.</span>
              </h2>
            </div>
          </div>

          <div className="fp-steps">
            <article className="fp-step">
              <span className="fp-step-number">01</span>
              <div className="fp-step-icon">↗</div>
              <h3>Заявка</h3>
              <p>Расскажите, что случилось с вашим устройством.</p>
            </article>

            <article className="fp-step">
              <span className="fp-step-number">02</span>
              <div className="fp-step-icon">⌕</div>
              <h3>Диагностика</h3>
              <p>Определим причину проблемы и обсудим решение.</p>
            </article>

            <article className="fp-step">
              <span className="fp-step-number">03</span>
              <div className="fp-step-icon">✳</div>
              <h3>Ремонт</h3>
              <p>Согласуем работы и займёмся вашим устройством.</p>
            </article>

            <article className="fp-step">
              <span className="fp-step-number">04</span>
              <div className="fp-step-icon">✓</div>
              <h3>Готово!</h3>
              <p>Вы получите своё устройство обратно.</p>
            </article>
          </div>
        </div>
      </section>

      {/* доставка */}
      <section className="fp-courier">
        <div className="fp-courier-symbol">↗</div>
        <div className="fp-courier-copy">
          <span className="fp-eyebrow">ЕСТЬ ЕЩЁ ОДНА УДОБНАЯ ВОЗМОЖНОСТЬ</span>
          <h2>Курьер может приехать к вам.</h2>
          <p>
            При оформлении заявки укажите адрес и удобное время встречи.
            Мы обсудим передачу устройства и дальнейший ремонт.
          </p>
        </div>
        <button onClick={onClientClick}>
          Оформить заявку <span>↗</span>
        </button>
      </section>

      {/* финальный призыв */}
      <section className="fp-contact" id="contacts">
        <div className="fp-contact-copy">
          <span className="fp-eyebrow">04 / ПОРА НАЧАТЬ</span>
          <h2>
            Вернём технику
            <br />
            <span>к жизни.</span>
          </h2>
          <p>
            Создайте аккаунт, оставьте заявку и доверьте нам
            заботу о своём устройстве.
          </p>
          <button className="fp-contact-button" onClick={onClientClick}>
            Оставить заявку <span>↗</span>
          </button>
        </div>

        <div className="fp-contact-art">
          <div className="fp-contact-ring" />
          <span className="fp-contact-star">✳</span>
          <span className="fp-contact-caption">FIX IT WITH FIXPOINT</span>
          <img
            src={fixiFly}
            alt="Персонаж FixPoint в полёте"
            className="fp-fixi-fly"
          />
          <span className="fp-contact-stamp">
            FIX
            <br />
            POINT
          </span>
        </div>
      </section>

      {/* подвал */}
      <footer className="fp-footer">
        <a href="#home" className="fp-footer-logo">
          <img src={logo} alt="" />
          <span>FixPoint</span>
        </a>

        <span className="fp-footer-copy">© 2026 FIXPOINT SERVICE</span>

        <nav className="fp-footer-nav">
          <a href="#services">Услуги</a>
          <a href="#process">Как мы работаем</a>
          <a href="#contacts">Контакты</a>
        </nav>

        <button onClick={onEmployeeClick}>Для сотрудников ↗</button>
      </footer>
    </main>
  )
}

export default HomePage