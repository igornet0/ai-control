import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Hero.module.css';
import logo from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png';
import Button from './Button';

const Hero = () => {

   const { user, isAuthenticated, loading, login, logout } = useAuth();

  return (
    <section className="min-h-screen flex items-center justify-center p-6 relative overflow-visible" style={{ paddingRight: '0' }}>
      {/* Динамический градиентный фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-transparent to-indigo-900/20"></div>
      
      {/* Анимированные частицы */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-20 w-1 h-1 bg-cyan-400 rounded-full animate-pulse opacity-30" style={{ animationDelay: '0.5s' }}></div>
      </div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 hero-dashboard-container">
        <div className="animate-slideInLeft">
          <div className="mb-8">
            <img src={logo} alt="AI-Control Logo" className="w-32 h-auto mb-6 animate-bounce" />
            <div className="inline-block px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-full backdrop-blur-sm">
              <span className="text-sm font-medium text-blue-300">✨ Next-Gen Analytics Platform</span>
            </div>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
            AI-CONTROL
          </h1>
          
          <h2 className="text-4xl font-semibold mb-6 text-white leading-tight">
            Optimizing Productivity<br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Through Smart Analytics
            </span>
          </h2>
          
          <p className="text-xl mb-8 text-slate-300 leading-relaxed max-w-lg">
            AI-Control provides businesses with efficient employee performance analysis and customizable dashboards to optimize your workflow and boost productivity.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to={isAuthenticated ? `/profile` : `/signin`}>
              <button className="btn btn-primary btn-lg group">
                <span className="group-hover:animate-bounce">🚀</span>
                Get Started
              </button>
            </Link>
            <button className="btn btn-outline btn-lg group">
              <span className="group-hover:animate-pulse">📊</span>
              View Demo
            </button>
          </div>
          
          {/* Статистика */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">10K+</div>
              <div className="text-sm text-slate-400">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">99.9%</div>
              <div className="text-sm text-slate-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">24/7</div>
              <div className="text-sm text-slate-400">Support</div>
            </div>
          </div>
        </div>
        
        <div className="animate-slideInRight hero-dashboard-section">
          <div className="relative overflow-visible">
            {/* Светящийся эффект вокруг изображения */}
            {/* <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/20 via-purple-400/20 to-cyan-300/20 rounded-3xl blur-xl"></div> */}
            
            {/* Только изображение без обводки */}
            <div className="relative transform scale-100">
              <img 
                src={dashboard} 
                alt="Dashboard" 
                className="w-full h-auto rounded-lg transform hover:scale-105 transition-transform" 
              />
              
              {/* Светящиеся эффекты на изображении */}
              {/* <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent rounded-lg"></div> */}
              
              {/* Индикатор активности */}
              {/* <div className="absolute top-4 right-4 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div> */}
            </div>
            
            {/* Плавающие элементы вокруг изображения */}
            <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-500/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-purple-500/30 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 -right-6 w-6 h-6 bg-cyan-500/30 rounded-full animate-float" style={{ animationDelay: '1.5s' }}></div>
            
            {/* Дополнительные декоративные элементы */}
            <div className="absolute top-12 -left-3 w-3 h-3 bg-yellow-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-12 -left-2 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '2.5s' }}></div>
            <div className="absolute top-1/4 -right-8 w-4 h-4 bg-indigo-500/30 rounded-full animate-float" style={{ animationDelay: '3s' }}></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;