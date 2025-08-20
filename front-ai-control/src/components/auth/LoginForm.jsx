import React, { useState } from 'react';
import styles from './Form.module.css';
import { login } from '../../services/authService';

const LoginForm = ({ onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const access_token = await login(formData);
      localStorage.setItem('access_token', access_token);
      onLogin();
    } catch (err) {
      console.log(err);
      setError('Неверное имя пользователя или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
    {error && (
      <div>
        {error}
      </div>
    )}
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input
        name="username"
        id="text"
        type="text"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        placeholder="Email/Login"
        value={formData.username}
        onChange={handleChange}
        required
        disabled={isLoading}
      />
      <input
        name="password"
        id="password"
        type="password"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        required
        disabled={isLoading}
      />

      <button
        type="submit"
        className={`w-full flex justify-center items-center py-3 px-4 rounded-lg text-white font-medium transition ${
          isLoading 
            ? 'bg-blue-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
        }`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            Sign In...
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
    </div>
  );
};

export default LoginForm;