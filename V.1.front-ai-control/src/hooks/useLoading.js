import { useState, useCallback } from 'react';

/**
 * Хук для управления состоянием загрузки
 * @param {boolean} initialLoading - начальное состояние загрузки
 * @returns {Object} объект с состоянием загрузки и методами управления
 */
export const useLoading = (initialLoading = false) => {
  const [loading, setLoading] = useState(initialLoading);
  const [loadingMessage, setLoadingMessage] = useState('Загрузка...');

  /**
   * Начать загрузку
   * @param {string} message - сообщение загрузки
   */
  const startLoading = useCallback((message = 'Загрузка...') => {
    setLoadingMessage(message);
    setLoading(true);
  }, []);

  /**
   * Завершить загрузку
   */
  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  /**
   * Выполнить асинхронную операцию с индикатором загрузки
   * @param {Function} asyncFunction - асинхронная функция
   * @param {string} message - сообщение загрузки
   * @returns {Promise} результат выполнения функции
   */
  const withLoading = useCallback(async (asyncFunction, message = 'Загрузка...') => {
    try {
      startLoading(message);
      const result = await asyncFunction();
      return result;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  /**
   * Обновить сообщение загрузки
   * @param {string} message - новое сообщение
   */
  const updateMessage = useCallback((message) => {
    setLoadingMessage(message);
  }, []);

  return {
    loading,
    loadingMessage,
    startLoading,
    stopLoading,
    withLoading,
    updateMessage
  };
};

export default useLoading;
