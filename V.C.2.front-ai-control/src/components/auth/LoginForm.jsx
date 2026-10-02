import React, { useState } from 'react';
import { login as loginService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { KeyIcon, RefreshIcon, WarningIcon } from '../icons/AppIcons';
import styles from './Form.module.css';

const LoginForm = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginService(formData);
      
      if (response?.access_token) {
        await login(response.access_token, { csrf_token: response.csrf_token });
        onLogin();
      } else {
        setError('Login failed - no token received');
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data.map(err => err.msg || err.message || err).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--gradient-secondary)' }}>
      <div className="card max-w-md w-full animate-scaleIn">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gradient mb-2">Sign In</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Welcome back! Please sign in to your account.
            </p>
          </div>
          
          {error && (
            <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <WarningIcon size="md" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your username"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your password"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>
                <RefreshIcon size="sm" className="animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <KeyIcon size="sm" />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;