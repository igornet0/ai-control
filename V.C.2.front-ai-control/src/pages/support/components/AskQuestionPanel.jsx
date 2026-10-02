import React, { useState } from 'react';
import { supportService } from '../../../services/supportService';
import { formatApiError } from '../../../utils/formatApiError';
import { SUPPORT_CATEGORIES } from '../content';
import styles from '../Support.module.css';

export default function AskQuestionPanel({ defaultCategory, onClose }) {
  const [category, setCategory] = useState(defaultCategory || SUPPORT_CATEGORIES[0].id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await supportService.createQuestion({
        category,
        title: title.trim(),
        body: body.trim(),
      });
      setSuccess(result);
      setTitle('');
      setBody('');
    } catch (err) {
      setError(formatApiError(err, 'Не удалось отправить вопрос'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.askPanel} aria-label="Задать вопрос">
      <div className={styles.askHeader}>
        <div>
          <h2 className={styles.askTitle}>Задать вопрос</h2>
          <p className={styles.askHint}>
            Вопрос увидит отдел поддержки. По нему будет создана задача.
          </p>
        </div>
        {onClose ? (
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Свернуть
          </button>
        ) : null}
      </div>

      <form className={styles.askForm} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Категория</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={styles.input}
          >
            {SUPPORT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Тема</span>
          <input
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.input}
            placeholder="Кратко сформулируйте вопрос"
          />
        </label>

        <label className={styles.field}>
          <span>Текст вопроса</span>
          <textarea
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={styles.textarea}
            placeholder="Опишите проблему или что нужно уточнить"
          />
        </label>

        {error ? <p className={styles.formError}>{error}</p> : null}
        {success ? (
          <p className={styles.formSuccess}>
            Вопрос отправлен
            {success.task_id ? ` (задача #${success.task_id})` : ''}.
          </p>
        ) : null}

        <div className={styles.askActions}>
          <button type="submit" className={styles.primaryButton} disabled={submitting}>
            {submitting ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </form>
    </section>
  );
}
