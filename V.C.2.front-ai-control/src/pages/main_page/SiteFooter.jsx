import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SiteFooter.module.css';

const PRODUCT_LINKS = [
  { label: 'Дашборды', to: '/dashboard' },
  { label: 'Источники данных', to: '/data-models' },
  { label: 'API', to: '/developer-api-docs' },
];

const RESOURCE_LINKS = [
  { label: 'Документация', to: '/datacode-docs' },
  { label: 'API Documentation', to: '/developer-api-docs' },
  { label: 'FAQ', to: '/legal' },
  { label: 'Поддержка', to: '/support' },
];

const COMPANY_LINKS = [
  { label: 'Контакты', to: '/support' },
  { label: 'Для разработчиков', to: '/developer-api-docs' },
  { label: 'Партнёрам', to: '/support' },
];

const LEGAL_LINKS = [
  { label: 'Пользовательское соглашение', to: '/legal/agreement' },
  { label: 'Конфиденциальность', to: '/legal/privacy' },
  { label: 'Обработка данных', to: '/legal/data-processing' },
  { label: 'Условия использования', to: '/legal/terms' },
  { label: 'Cookies', to: '/legal/cookies' },
];

const FooterColumn = ({ title, links }) => (
  <div className={styles.column}>
    <h3 className={styles.columnTitle}>{title}</h3>
    <ul className={styles.linkList}>
      {links.map((link) => (
        <li key={link.label}>
          <Link to={link.to} className={styles.link}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const SiteFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Подвал сайта">
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link to="/" className={styles.brandName}>
              2A <span className={styles.brandAccent}>ДАННЫЕ</span>
            </Link>
            <p className={styles.brandText}>
              Современная платформа для анализа данных, создания дашбордов и автоматизации
              отчётности.
            </p>
            <p className={styles.status} role="status">
              <span className={styles.statusDot} aria-hidden="true" />
              Все системы работают
            </p>
          </div>

          <nav className={styles.nav} aria-label="Навигация в подвале">
            <FooterColumn title="Продукт" links={PRODUCT_LINKS} />
            <FooterColumn title="Ресурсы" links={RESOURCE_LINKS} />
            <FooterColumn title="Компания" links={COMPANY_LINKS} />
          </nav>
        </div>

        <div className={styles.help}>
          <div className={styles.helpCopy}>
            <h3 className={styles.helpTitle}>Нужна помощь?</h3>
            <p className={styles.helpText}>
              Мы поможем подобрать решение для вашей задачи — от первого дашборда до Enterprise.
            </p>
          </div>
          <div className={styles.helpActions}>
            <Link to="/support" className={styles.helpPrimary}>
              Открыть поддержку
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>© {year} 2A ДАННЫЕ. Все права защищены.</p>

          <nav className={styles.legal} aria-label="Юридическая информация">
            {LEGAL_LINKS.map((item) => (
              <Link key={item.to} to={item.to} className={styles.legalLink}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.meta}>
            <button type="button" className={styles.lang} aria-label="Язык интерфейса: русский" disabled>
              RU
              <span className={styles.langCaret} aria-hidden="true">
                ▾
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
