import React, { useEffect, useRef, useState } from 'react';
import './AnimatedBackground.css';

function useMediaQueryMatch(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const AnimatedBackground = () => {
  const reducedMotion = useMediaQueryMatch('(prefers-reduced-motion: reduce)');
  const coarsePointer = useMediaQueryMatch('(pointer: coarse)');
  const pieChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const barChartRef = useRef(null);
  const containerRef = useRef(null);

  // Оптимизированный параллакс эффект при движении мыши
  useEffect(() => {
    if (reducedMotion || coarsePointer) {
      return undefined;
    }

    let rafId = null;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      targetX = (clientX / innerWidth - 0.5) * 2;
      targetY = (clientY / innerHeight - 0.5) * 2;
    };

    const animateParallax = () => {
      // Плавная интерполяция для более smooth движения
      mouseX += (targetX - mouseX) * 0.1;
      mouseY += (targetY - mouseY) * 0.1;

      if (!containerRef.current) {
        rafId = requestAnimationFrame(animateParallax);
        return;
      }

      const layers = containerRef.current.querySelectorAll('[class*="parallax-layer"]');
      layers.forEach((layer, index) => {
        const depth = (index % 3) + 1;
        const moveX = mouseX * depth * 8;
        const moveY = mouseY * depth * 8;
        
        // Используем transform3d для GPU-ускорения
        layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
      });

      rafId = requestAnimationFrame(animateParallax);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animateParallax);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, coarsePointer]);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    // Круговая диаграмма (верхняя большая)
    const drawPieChart = (ctx, x, y, radius, progress, rotation) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      const segments = [
        { start: 0, end: Math.PI / 2, color: '#3b82f6' },
        { start: Math.PI / 2, end: Math.PI, color: '#8b5cf6' },
        { start: Math.PI, end: Math.PI * 1.5, color: '#ec4899' },
        { start: Math.PI * 1.5, end: Math.PI * 2, color: '#8b5cf6' }
      ];

      segments.forEach((segment, index) => {
        const startAngle = segment.start;
        const endAngle = segment.start + (segment.end - segment.start) * progress;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
        gradient.addColorStop(0, segment.color);
        gradient.addColorStop(1, segment.color + '80');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Свечение контура
        ctx.strokeStyle = segment.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = segment.color;
        ctx.stroke();
      });
      
      ctx.restore();
    };

    // Линейный график
    const drawLineChart = (ctx, x, y, width, height, progress) => {
      const points = [
        { x: 0, y: height * 0.8 },
        { x: width * 0.2, y: height * 0.6 },
        { x: width * 0.4, y: height * 0.4 },
        { x: width * 0.6, y: height * 0.3 },
        { x: width * 0.8, y: height * 0.5 },
        { x: width, y: height * 0.2 }
      ];

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#3b82f6';
      ctx.beginPath();

      const visiblePoints = Math.floor(points.length * progress);
      for (let i = 0; i < visiblePoints; i++) {
        const point = points[i];
        if (i === 0) {
          ctx.moveTo(x + point.x, y + point.y);
        } else {
          ctx.lineTo(x + point.x, y + point.y);
        }
      }
      ctx.stroke();

      // Светящаяся точка
      if (visiblePoints > 0) {
        const currentPoint = points[visiblePoints - 1];
        ctx.beginPath();
        ctx.arc(x + currentPoint.x, y + currentPoint.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#3b82f6';
        ctx.fill();
      }
    };

    // Столбиковая диаграмма
    const drawBarChart = (ctx, x, y, width, height, progress) => {
      const bars = [
        { x: 0, height: 0.7, color: '#3b82f6' },
        { x: 0.15, height: 0.5, color: '#8b5cf6' },
        { x: 0.3, height: 0.9, color: '#ec4899' },
        { x: 0.45, height: 0.6, color: '#8b5cf6' },
        { x: 0.6, height: 0.8, color: '#3b82f6' },
        { x: 0.75, height: 0.4, color: '#ec4899' }
      ];

      bars.forEach((bar, index) => {
        const barProgress = Math.min(1, (progress - index * 0.15) / 0.15);
        if (barProgress > 0) {
          const barHeight = height * bar.height * barProgress;
          const barX = x + bar.x * width;
          const barWidth = width * 0.12;

          const gradient = ctx.createLinearGradient(barX, y + height, barX, y + height - barHeight);
          gradient.addColorStop(0, bar.color);
          gradient.addColorStop(1, bar.color + 'CC');

          ctx.fillStyle = gradient;
          ctx.shadowBlur = 15;
          ctx.shadowColor = bar.color;
          ctx.fillRect(barX, y + height - barHeight, barWidth, barHeight);
        }
      });
    };

    // Оптимизированная анимация для canvas элементов (~30fps cap)
    let lastDrawMs = 0;
    let animationId;
    const MIN_FRAME_MS = 33;

    const animate = (currentTime) => {
      if (currentTime - lastDrawMs < MIN_FRAME_MS) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastDrawMs = currentTime;

      const time = currentTime * 0.001;
      const progress = (Math.sin(time * 0.5) + 1) / 2;
      const pieProgress = 0.6 + Math.sin(time * 0.3) * 0.4;
      const rotation = time * 0.1;

      if (pieChartRef.current) {
        const ctx = pieChartRef.current.getContext('2d', { alpha: true });
        // Оптимизация: очищаем только нужную область
        ctx.clearRect(0, 0, pieChartRef.current.width, pieChartRef.current.height);
        ctx.shadowBlur = 20;
        drawPieChart(ctx, 100, 100, 80, pieProgress, rotation);
      }

      if (lineChartRef.current) {
        const ctx = lineChartRef.current.getContext('2d', { alpha: true });
        ctx.clearRect(0, 0, lineChartRef.current.width, lineChartRef.current.height);
        drawLineChart(ctx, 0, 0, 300, 150, progress);
      }

      if (barChartRef.current) {
        const ctx = barChartRef.current.getContext('2d', { alpha: true });
        ctx.clearRect(0, 0, barChartRef.current.width, barChartRef.current.height);
        drawBarChart(ctx, 0, 0, 250, 120, progress);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        className="animated-background animated-background--static"
        aria-hidden
      />
    );
  }

  return (
    <div className="animated-background" ref={containerRef}>
      {/* Радиальные градиенты для глубины и читабельности */}
      <div className="radial-gradient-center"></div>
      <div className="radial-gradient-top-left"></div>
      <div className="radial-gradient-bottom-right"></div>
      
      {/* Размытые неоновые пятна (glow blobs) - уменьшено количество */}
      <div className="glow-blob blob-1"></div>
      <div className="glow-blob blob-2"></div>
      <div className="glow-blob blob-3"></div>
      
      {/* Улучшенный шум/текстура */}
      <div className="background-noise"></div>
      <div className="background-texture"></div>
      <div className="background-glitch"></div>
      
      {/* Улучшенные частицы с логической композицией - уменьшено количество */}
      <div className="particles-container">
        {Array.from({ length: 12 }).map((_, i) => {
          const size = [3, 4, 5][i % 3]; // Разные размеры
          const diagonal = i % 2 === 0; // Чередование направления
          return (
            <div 
              key={i} 
              className={`particle particle-${i % 4}`}
              style={{
                left: `${15 + (i * 6) % 70}%`,
                top: `${15 + (i * 5) % 70}%`,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${(i * 0.3) % 3}s`,
                animationDuration: `${2 + (i % 3)}s`,
                '--diagonal': diagonal ? '1' : '-1'
              }}
            ></div>
          );
        })}
      </div>

      {/* Круговые диаграммы с параллаксом */}
      <div className="chart-container pie-chart-large parallax-layer-1">
        <canvas ref={pieChartRef} width="200" height="200" className="chart-canvas"></canvas>
        <div className="chart-glow"></div>
      </div>

      <div className="chart-container pie-chart-small parallax-layer-2">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="url(#gradient-small)"
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * 0.3}`}
            className="pie-small-animation"
          />
          <defs>
            <linearGradient id="gradient-small" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Линейные графики с параллаксом */}
      <div className="chart-container line-chart-large parallax-layer-2">
        <canvas ref={lineChartRef} width="300" height="150" className="chart-canvas"></canvas>
      </div>

      <div className="chart-container line-chart-small parallax-layer-1">
        <svg width="200" height="100" viewBox="0 0 200 100">
          <polyline
            points="0,80 40,60 80,40 120,30 160,50 200,20"
            fill="none"
            stroke="url(#gradient-line)"
            strokeWidth="3"
            className="line-small-animation"
          />
          <defs>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Столбиковые диаграммы с параллаксом */}
      <div className="chart-container bar-chart-1 parallax-layer-1">
        <canvas ref={barChartRef} width="250" height="120" className="chart-canvas"></canvas>
      </div>

      <div className="chart-container bar-chart-2 parallax-layer-2">
          <div className="bar-chart-bars">
          {[0.6, 0.8, 0.4, 0.9, 0.5, 0.7].map((height, i) => (
            <div
              key={i}
              className="bar"
              style={{
                height: `${height * 100}%`,
                animationDelay: `${i * 0.1}s`,
                background: 'linear-gradient(to top, #3b82f6, #8b5cf6, #ec4899)'
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Блок Datasets с параллаксом */}
      <div className="widget-container datasets-widget parallax-layer-2">
        <div className="widget-border"></div>
        <div className="widget-content">
          <div className="widget-header">
            <div className="widget-icon datasets-icon"></div>
            <h3 className="widget-title neon-text" data-text="Datasets">Datasets</h3>
          </div>
          <div className="datasets-list">
            {['Dataset 1', 'Dataset 2', 'Dataset 3'].map((item, i) => (
              <div key={i} className="dataset-item" style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="checkmark"></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Блок Tasks с параллаксом */}
      <div className="widget-container tasks-widget parallax-layer-1">
        <div className="widget-border"></div>
        <div className="widget-content">
          <div className="widget-header">
            <div className="widget-icon tasks-icon"></div>
            <h3 className="widget-title neon-text" data-text="Tasks">Tasks</h3>
          </div>
          <div className="tasks-list">
            {[
              { text: 'Task 1', completed: true },
              { text: 'Task 2', completed: false },
              { text: 'Task 3', completed: true }
            ].map((task, i) => (
              <div key={i} className="task-item" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className={`task-checkmark ${task.completed ? 'completed' : ''}`}></div>
                <span>{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Контурные рамки с параллаксом */}
      <div className="glow-border border-1 parallax-layer-3"></div>
      <div className="glow-border border-2 parallax-layer-2"></div>
      <div className="glow-border border-3 parallax-layer-1"></div>

      {/* Иконка Dashboard с параллаксом */}
      <div className="dashboard-icon-container parallax-layer-2">
        <div className="dashboard-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 5 L35 12 L35 28 L20 35 L5 28 L5 12 Z"
              fill="url(#dashboardGradient)"
              stroke="url(#dashboardGradient)"
              strokeWidth="2"
            />
            <defs>
              <linearGradient id="dashboardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Дополнительные детали: сетка */}
      <div className="grid-overlay"></div>
      
      {/* Дополнительные детали: линии соединения */}
      <div className="connection-lines">
        <svg className="connection-svg" width="100%" height="100%">
          <defs>
            <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <line x1="15%" y1="20%" x2="25%" y2="30%" stroke="url(#lineGradient1)" strokeWidth="1" className="connection-line" />
          <line x1="75%" y1="15%" x2="85%" y2="25%" stroke="url(#lineGradient1)" strokeWidth="1" className="connection-line" />
          <line x1="20%" y1="70%" x2="30%" y2="80%" stroke="url(#lineGradient2)" strokeWidth="1" className="connection-line" />
          <line x1="70%" y1="60%" x2="80%" y2="70%" stroke="url(#lineGradient2)" strokeWidth="1" className="connection-line" />
        </svg>
      </div>

      {/* Дополнительные детали: декоративные круги - уменьшено количество */}
      <div className="decorative-circles">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className={`decorative-circle circle-${i + 1}`}
            style={{
              left: `${20 + (i * 15) % 60}%`,
              top: `${15 + (i * 18) % 70}%`,
              animationDelay: `${i * 0.4}s`
            }}
          ></div>
        ))}
      </div>

      {/* Дополнительные детали: световые лучи */}
      <div className="light-rays">
        <div className="light-ray ray-1"></div>
        <div className="light-ray ray-2"></div>
        <div className="light-ray ray-3"></div>
      </div>
    </div>
  );
};

export default AnimatedBackground;

