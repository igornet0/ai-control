import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from '../../assets/logo.png';
import {
  EmailIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  LockIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  WarningIcon,
} from '../../components/icons/AppIcons';
import { inviteService } from '../../services/inviteService';
import { formatApiError } from '../../utils/formatApiError';
import authStyles from '../../components/auth/ModernAuth.module.css';
import formStyles from '../../components/auth/ModernForm.module.css';
import styles from '../invite/InviteAcceptPage.module.css';

export default function PasswordResetAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const fieldId = useId();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ password: '', password_confirm: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    inviteService
      .getPasswordResetInvite(token)
      .then((data) => setInvite(data))
      .catch((err) => {
        setLoadError(formatApiError(err, 'Ссылка для сброса пароля недоступна'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const validate = () => {
    const next = {};
    if (!form.password) {
      next.password = 'Пароль обязателен';
    } else if (form.password.length < 6) {
      next.password = 'Пароль должен быть не менее 6 символов';
    }
    if (!form.password_confirm) {
      next.password_confirm = 'Подтвердите пароль';
    } else if (form.password !== form.password_confirm) {
      next.password_confirm = 'Пароли не совпадают';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await inviteService.acceptPasswordResetInvite(token, {
        password: form.password,
        password_confirm: form.password_confirm,
      });
      navigate('/signin', { state: { message: 'Пароль обновлён, войдите' } });
    } catch (err) {
      setErrors({ general: formatApiError(err, 'Не удалось сбросить пароль') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={authStyles.authContainer}>
      <div className={authStyles.backgroundAnimation}>
        <div className={authStyles.gradientOrb}></div>
        <div className={authStyles.gradientOrb}></div>
        <div className={authStyles.gradientOrb}></div>
      </div>
      <div className={authStyles.authContent}>
        <div className={authStyles.logoSection} onClick={() => navigate('/')}>
          <div className={authStyles.logoContainer}>
            <img src={logo} alt="AI-Control Logo" className={authStyles.logo} />
          </div>
          <p className={authStyles.subtitle}>Сброс пароля</p>
        </div>
        <div className={authStyles.authCard}>
          <div className={formStyles.formContainer}>
            <div className={formStyles.formHeader}>
              <h2 className={formStyles.formTitle}>Задайте новый пароль</h2>
              <p className={formStyles.formSubtitle}>
                Введите новый пароль и подтвердите его
              </p>
            </div>

            {loading && <p className={formStyles.formSubtitle}>Загрузка ссылки...</p>}
            {loadError && (
              <div className={formStyles.errorMessage}>
                <div className={formStyles.errorIcon}><WarningIcon size="md" /></div>
                <span>{loadError}</span>
              </div>
            )}
            {errors.general && (
              <div className={formStyles.errorMessage}>
                <div className={formStyles.errorIcon}><WarningIcon size="md" /></div>
                <span>{errors.general}</span>
              </div>
            )}

            {!loading && invite && (
              <form onSubmit={handleSubmit} className={formStyles.form}>
                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type="text"
                      id={`${fieldId}-name`}
                      value={invite.name}
                      disabled
                      className={`${formStyles.input} ${styles.readonly}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-name`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><UserIcon size="xs" /></span>
                      Имя
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type="text"
                      id={`${fieldId}-login`}
                      value={invite.login}
                      disabled
                      className={`${formStyles.input} ${styles.readonly}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-login`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><TagIcon size="xs" /></span>
                      Логин
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type="email"
                      id={`${fieldId}-email`}
                      value={invite.email}
                      disabled
                      className={`${formStyles.input} ${styles.readonly}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-email`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><EmailIcon size="xs" /></span>
                      Почта
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id={`${fieldId}-password`}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      className={`${formStyles.input} ${styles.passwordInput} ${errors.password ? formStyles.error : ''}`}
                      placeholder=" "
                      autoComplete="new-password"
                    />
                    <label htmlFor={`${fieldId}-password`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><LockIcon size="xs" /></span>
                      Новый пароль
                    </label>
                    <button
                      type="button"
                      className={formStyles.passwordToggle}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeClosedIcon size="md" /> : <EyeOpenIcon size="md" />}
                    </button>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                  {errors.password && <div className={formStyles.fieldError}>{errors.password}</div>}
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      id={`${fieldId}-confirm`}
                      value={form.password_confirm}
                      onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                      required
                      className={`${formStyles.input} ${styles.passwordInput} ${errors.password_confirm ? formStyles.error : ''}`}
                      placeholder=" "
                      autoComplete="new-password"
                    />
                    <label htmlFor={`${fieldId}-confirm`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><LockIcon size="xs" /></span>
                      Подтверждение пароля
                    </label>
                    <button
                      type="button"
                      className={formStyles.passwordToggle}
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? <EyeClosedIcon size="md" /> : <EyeOpenIcon size="md" />}
                    </button>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                  {errors.password_confirm && (
                    <div className={formStyles.fieldError}>{errors.password_confirm}</div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`${formStyles.submitButton} ${submitting ? formStyles.loading : ''}`}
                >
                  {submitting ? 'Сохранение...' : (
                    <>
                      <span className={formStyles.buttonIcon}><SparklesIcon size="md" /></span>
                      Сохранить пароль
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
