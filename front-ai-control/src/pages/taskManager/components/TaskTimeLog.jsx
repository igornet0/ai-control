import React, { useState, useEffect } from 'react';

export default function TaskTimeLog({ taskId, currentUser, onTimeUpdate }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeLogs, setTimeLogs] = useState([]);
  const [newLog, setNewLog] = useState({ hours: '', description: '' });
  const [apiAvailable, setApiAvailable] = useState(false); // По умолчанию API недоступен

  useEffect(() => {
    let interval;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
    setElapsedTime(0);
  };

  const stopTracking = () => {
    setIsTracking(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  const addTimeLog = () => {
    if (!newLog.hours || !newLog.description.trim()) return;

    const log = {
      id: Date.now(),
      hours: parseFloat(newLog.hours),
      description: newLog.description.trim(),
      date: new Date().toISOString(),
      user: currentUser?.name || 'Unknown'
    };

    setTimeLogs(prev => [log, ...prev]);
    setNewLog({ hours: '', description: '' });
    
    if (onTimeUpdate) {
      onTimeUpdate(log);
    }
  };

  const removeTimeLog = (logId) => {
    setTimeLogs(prev => prev.filter(log => log.id !== logId));
  };

  const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);

  // Показываем заглушку так как API временных логов недоступен
  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Time Tracking</h3>
      <div className="text-center text-gray-400 text-sm py-4">
        Time tracking feature is not available yet
      </div>
    </div>
  );
}
