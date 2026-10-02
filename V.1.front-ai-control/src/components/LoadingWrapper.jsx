import React from 'react';
import LoadingPage from './LoadingPage';
import PageLoader from './PageLoader';

/**
 * Компонент-обертка для условного отображения загрузки
 * @param {boolean} loading - состояние загрузки
 * @param {string} message - сообщение загрузки
 * @param {string} type - тип загрузки ('fullscreen' | 'inline')
 * @param {string} size - размер загрузчика (для inline типа)
 * @param {React.ReactNode} children - дочерние элементы
 */
const LoadingWrapper = ({ 
  loading, 
  message = 'Загрузка...', 
  type = 'fullscreen',
  size = 'medium',
  children 
}) => {
  if (!loading) {
    return children;
  }

  if (type === 'fullscreen') {
    return <LoadingPage message={message} />;
  }

  if (type === 'inline') {
    return <PageLoader message={message} size={size} />;
  }

  return children;
};

export default LoadingWrapper;
