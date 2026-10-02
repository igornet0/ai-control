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
import styles from './InviteAcceptPage.module.css';

function generatePassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (src) => src[Math.floor(Math.random() * src.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const fieldId = useId();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', login: '', password: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    inviteService
      .getInviteByToken(token)
      .then((data) => {
        setInvite(data);
        setForm((prev) => ({ ...prev, name: data.name || '' }));
      })
      .catch((err) => {
        setLoadError(formatApiError(err, 'Приглашение недоступно'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const validate = () => {
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      next.name = 'Имя должно быть не менее 2 символов';
    }
    if (!form.login.trim()) {
      next.login = 'Логин обязателен';
    } else if (form.login.length < 3) {
      next.login = 'Логин должен быть не менее 3 символов';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.login)) {
      next.login = 'Логин может содержать только буквы, цифры и _';
    }
    if (!form.password) {
      next.password = 'Пароль обязателен';
    } else if (form.password.length < 6) {
      next.password = 'Пароль должен быть не менее 6 символов';
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
      await inviteService.acceptInvite(token, {
        name: form.name.trim(),
        login: form.login.trim(),
        password: form.password,
      });
      navigate('/signin', { state: { message: 'Аккаунт создан, войдите' } });
    } catch (err) {
      setErrors({ general: formatApiError(err, 'Не удалось создать аккаунт') });
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
          <p className={authStyles.subtitle}>Приглашение в организацию</p>
        </div>
        <div className={authStyles.authCard}>
          <div className={formStyles.formContainer}>
            <div className={formStyles.formHeader}>
              <h2 className={formStyles.formTitle}>Завершите регистрацию</h2>
              <p className={formStyles.formSubtitle}>
                Проверьте данные и задайте логин с паролем
              </p>
            </div>

            {loading && <p className={formStyles.formSubtitle}>Загрузка приглашения...</p>}
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
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className={`${formStyles.input} ${errors.name ? formStyles.error : ''}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-name`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><UserIcon size="xs" /></span>
                      Имя
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                  {errors.name && <div className={formStyles.fieldError}>{errors.name}</div>}
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
                      type="text"
                      id={`${fieldId}-role`}
                      value={invite.team_role}
                      disabled
                      className={`${formStyles.input} ${styles.readonly}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-role`} className={formStyles.label}>
                      Роль
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type="text"
                      id={`${fieldId}-department`}
                      value={invite.department_name || '—'}
                      disabled
                      className={`${formStyles.input} ${styles.readonly}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-department`} className={formStyles.label}>
                      Отдел
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                </div>

                <div className={formStyles.inputGroup}>
                  <div className={formStyles.inputContainer}>
                    <input
                      type="text"
                      id={`${fieldId}-login`}
                      value={form.login}
                      onChange={(e) => setForm({ ...form, login: e.target.value })}
                      required
                      className={`${formStyles.input} ${errors.login ? formStyles.error : ''}`}
                      placeholder=" "
                    />
                    <label htmlFor={`${fieldId}-login`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><TagIcon size="xs" /></span>
                      Логин
                    </label>
                    <div className={formStyles.inputBorder}></div>
                  </div>
                  {errors.login && <div className={formStyles.fieldError}>{errors.login}</div>}
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
                    />
                    <label htmlFor={`${fieldId}-password`} className={formStyles.label}>
                      <span className={formStyles.labelIcon}><LockIcon size="xs" /></span>
                      Пароль
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
                  <button
                    type="button"
                    className={styles.generateButton}
                    onClick={() => {
                      const next = generatePassword();
                      setForm({ ...form, password: next });
                      setShowPassword(true);
                    }}
                  >
                    Сгенерировать
                  </button>
                  {errors.password && <div className={formStyles.fieldError}>{errors.password}</div>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`${formStyles.submitButton} ${submitting ? formStyles.loading : ''}`}
                >
                  {submitting ? 'Сохранение...' : (
                    <>
                      <span className={formStyles.buttonIcon}><SparklesIcon size="md" /></span>
                      Сохранить и перейти ко входу
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
