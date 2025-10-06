import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEditMode } from '../../context/EditModeContext';
import styles from './Header.module.css';

const DashboardHeader = ({ isAuthenticated }) => {
  const { isEditing, setIsEditing } = useEditMode();
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.split('/');
  const id = pathParts[2];
  const sheetId = pathParts[4];

  // Mock sheet options
  const sheets = [
    { id: '1', name: 'Overview' },
    { id: '2', name: 'Sales' },
    { id: '3', name: 'Marketing' },
  ];

  const handleSheetChange = (e) => {
    const newSheetId = e.target.value;
    navigate(`/dashboard/${id}/sheet/${newSheetId}`);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ 
      background: 'rgba(15, 23, 42, 0.8)', 
      borderColor: 'var(--color-border-muted)' 
    }}>
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <a href="/" className="text-2xl font-bold text-gradient hover:opacity-80 transition-opacity">
              AI-CONTROL
            </a>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsEditing((prev) => !prev)}
                className={`btn btn-sm ${
                  isEditing 
                    ? 'btn-danger' 
                    : 'btn-primary'
                }`}
              >
                <span>{isEditing ? '💾' : '✏️'}</span>
                {isEditing ? 'Save' : 'Edit'}
              </button>

              <h3 className="text-xl font-semibold text-gradient">Dashboard {id}</h3>
              <select
                value={sheetId}
                onChange={handleSheetChange}
                className="form-input w-auto min-w-32"
              >
                {sheets.map(sheet => (
                  <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
                ))}
              </select>
            </div>
          </div>

          <ul className="hidden md:flex items-center space-x-6">
            <li>
              <a 
                href="/dashboard" 
                className="text-sm font-medium transition-colors hover:text-gradient"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                📊 Dashboard
              </a>
            </li>
            <li>
              <a 
                href="/tasks" 
                className="text-sm font-medium transition-colors hover:text-gradient"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                📋 Tasks
              </a>
            </li>
            <li>
              <a 
                href="/support" 
                className="text-sm font-medium transition-colors hover:text-gradient"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                🆘 Support
              </a>
            </li>
            <li>
              {isAuthenticated ? (
                <a 
                  href="/profile" 
                  className="btn btn-outline btn-sm"
                >
                  <span>👤</span>
                  Profile
                </a>
              ) : (
                <a 
                  href="/signin" 
                  className="btn btn-primary btn-sm"
                >
                  <span>🔐</span>
                  Sign In
                </a>
              )}
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default DashboardHeader;