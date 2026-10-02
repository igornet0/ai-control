import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchPublicHeroDemo } from '../../services/publicHeroDemoApi';
import styles from './Hero.module.css';
import logoPng from '../../assets/logo.png';
import logoWebp from '../../assets/logo.webp';
import dashboardPng from '../../assets/dashboard.png';
import dashboardWebp from '../../assets/dashboard.webp';
import SiteFooter from './SiteFooter';

const iconClass = 'w-5 h-5 shrink-0';

const HeroIcons = {
  sparkles: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  rocket: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="hero-rocket-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        stroke="url(#hero-rocket-gradient)"
        d="M12 1.5 L9.5 5 L9 5 L9 17 L6 21 L10 18 L12 21 L14 18 L18 21 L15 17 L15 5 L14.5 5 Z"
      />
      <circle cx="12" cy="10" r="1.25" stroke="url(#hero-rocket-gradient)" />
      <path stroke="url(#hero-rocket-gradient)" d="M10 18Q12 24 14 18" />
      <path stroke="url(#hero-rocket-gradient)" d="M11 18Q12 21 13 18" />
    </svg>
  ),
  chart: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
      <defs>
        <linearGradient id="hero-chart-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <path stroke="url(#hero-chart-gradient)" strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

const BrandLockIcon = () => (
  <svg className={styles.lockIcon} viewBox="0 0 48 56" fill="none" aria-hidden>
    <defs>
      <linearGradient id="hero-lock-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="50%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#f472b6" />
      </linearGradient>
      <linearGradient id="hero-lock-shine" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <filter id="hero-lock-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#hero-lock-glow)">
      <path
        className={styles.lockShackle}
        d="M14 25V18.5C14 12.7 18.7 8 24.5 8S35 12.7 35 18.5V25"
        stroke="url(#hero-lock-gradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <rect x="9" y="25" width="30" height="26" rx="8" fill="url(#hero-lock-gradient)" />
      <rect x="11" y="27" width="26" height="12" rx="6" fill="url(#hero-lock-shine)" />
      <circle cx="24" cy="36" r="3.25" fill="#0f172a" />
      <rect x="22.4" y="36" width="3.2" height="8.5" rx="1.6" fill="#0f172a" />
    </g>
  </svg>
);

const Hero = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState('');

  const openDemo = useCallback(async () => {
    setDemoBusy(true);
    setDemoError('');
    try {
      const cfg = await fetchPublicHeroDemo();
      if (cfg?.enabled && cfg?.share_path) {
        navigate(cfg.share_path);
        return;
      }
      setDemoError('Демо пока не настроено. Загляните позже или войдите в систему.');
    } catch {
      setDemoError('Не удалось открыть демо. Попробуйте позже.');
    } finally {
      setDemoBusy(false);
    }
  }, [navigate]);

  return (
    <>
    <section className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/15 via-transparent to-pink-900/15"></div>
      <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-purple-900/10 to-transparent"></div>
      <div className={`absolute inset-0 ${styles.simpleBackground}`} aria-hidden>
        <div className={`${styles.auroraOrb} ${styles.auroraOrbBlue}`}></div>
        <div className={`${styles.auroraOrb} ${styles.auroraOrbPurple}`}></div>
        <div className={`${styles.auroraOrb} ${styles.auroraOrbPink}`}></div>
        <div className={styles.gridFade}></div>
      </div>

      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-30"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-20" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse opacity-25" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 hero-dashboard-container">
        <div className={styles.heroContent}>
          <div className="mb-8">
            <picture>
              <source srcSet={logoWebp} type="image/webp" />
              <img
                src={logoPng}
                alt="Логотип AI-Control"
                width={128}
                height={128}
                decoding="async"
                className="w-32 h-auto mb-6"
              />
            </picture>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-full backdrop-blur-sm">
              <span className="text-blue-300 [&_svg]:text-current">{HeroIcons.sparkles}</span>
              <span className="text-sm font-medium text-blue-300">Платформа аналитики нового поколения</span>
            </div>
          </div>

          <h1 className={`text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-tight ${styles.heroTitle}`}>
            <span className={styles.brandPrefix}>2A</span>
            <span className={styles.brandStage}>
              <span className={styles.brandWord}>Данные</span>
              <span className={styles.brandLock} aria-hidden>
                <BrandLockIcon />
              </span>
            </span>
          </h1>

          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-semibold mb-6 sm:mb-8 text-white leading-tight" style={{
            textShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
            letterSpacing: '-0.01em'
          }}>
            Повышаем продуктивность<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              с помощью умной аналитики
            </span>
          </h2>

          <p className="text-base sm:text-xl mb-8 sm:mb-10 text-slate-200 leading-relaxed max-w-lg" style={{
            lineHeight: '1.8'
          }}>
            «2A Данные» помогает анализировать данные и настраивать дашборды под свои процессы, для повышения продуктивности.
          </p>

          <div className="flex flex-col sm:flex-row gap-5">
            <Link to={isAuthenticated ? `/profile` : `/signin`}>
              <button className="btn btn-primary btn-lg group relative" style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 4px 15px rgba(0, 0, 0, 0.2)'
              }}>
                <span className="inline-flex items-center mr-2 group-hover:animate-bounce [&_svg]:w-7 [&_svg]:h-7">{HeroIcons.rocket}</span>
                Начать
              </button>
            </Link>
            <button
              type="button"
              className="btn btn-outline btn-lg group relative"
              style={{
                boxShadow: '0 0 15px rgba(59, 130, 246, 0.2), 0 4px 10px rgba(0, 0, 0, 0.15)'
              }}
              disabled={demoBusy}
              onClick={() => void openDemo()}
            >
              <span className="inline-flex items-center mr-2 group-hover:animate-pulse [&_svg]:w-5 [&_svg]:h-5">{HeroIcons.chart}</span>
              {demoBusy ? 'Открытие…' : 'Смотреть демо'}
            </button>
          </div>
          {demoError ? (
            <p className="mt-3 text-sm text-amber-200/90 max-w-lg">{demoError}</p>
          ) : null}

          <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
            <div className="text-center border border-blue-400/30 rounded-xl py-4 px-3 bg-slate-900/20 backdrop-blur-sm">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">10K+</div>
              <div className="text-sm text-slate-300 mt-1">Активных пользователей</div>
            </div>
            <div className="text-center border border-purple-400/30 rounded-xl py-4 px-3 bg-slate-900/20 backdrop-blur-sm">
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">99.9%</div>
              <div className="text-sm text-slate-300 mt-1">Доступность</div>
            </div>
            <div className="text-center border border-pink-400/30 rounded-xl py-4 px-3 bg-slate-900/20 backdrop-blur-sm">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">24/7</div>
              <div className="text-sm text-slate-300 mt-1">Поддержка</div>
            </div>
          </div>
        </div>

        <div className="hero-dashboard-section" style={{ opacity: 0.75 }}>
          <div className="relative overflow-visible">
            <div className="relative transform scale-100" style={{ filter: 'brightness(0.85) contrast(1.05)' }}>
              <picture>
                <source srcSet={dashboardWebp} type="image/webp" />
                <img
                  src={dashboardPng}
                  alt="Панель управления"
                  width={1024}
                  height={1536}
                  decoding="async"
                  fetchPriority="high"
                  className="w-full h-auto rounded-lg transform hover:scale-105 transition-transform"
                  style={{
                    filter: 'drop-shadow(0 10px 25px rgba(59, 130, 246, 0.15))',
                    opacity: 0.9
                  }}
                />
              </picture>
            </div>

            <div className="absolute -top-4 -left-4 w-8 h-8 bg-blue-500/15 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-purple-500/15 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 -right-6 w-5 h-5 bg-pink-500/15 rounded-full animate-float" style={{ animationDelay: '1.5s' }}></div>
          </div>
        </div>
      </div>
    </section>
    <SiteFooter />
    </>
  );
};

export default Hero;
