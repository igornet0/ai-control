import { dataModelsArticles } from './dataModels';
import { controlPanelArticles } from './controlPanel';
import { documentsArticles } from './documents';
import { tasksArticles } from './tasks';

export const SUPPORT_CATEGORIES = [
  {
    id: 'data_models',
    label: 'Модели данных',
    description: 'Создание моделей, источники, DataCode и доступ',
    articles: dataModelsArticles,
  },
  {
    id: 'control_panel',
    label: 'Панель управления',
    description: 'Дашборды, виджеты, потоки и публикация',
    articles: controlPanelArticles,
  },
  {
    id: 'documents',
    label: 'Документы',
    description: 'Текстовые и табличные шаблоны, экземпляры и настройки',
    articles: documentsArticles,
  },
  {
    id: 'tasks',
    label: 'Задачи',
    description: 'Создание задач, статусы, проекты и команды',
    articles: tasksArticles,
  },
];

export function getCategoryById(categoryId) {
  return SUPPORT_CATEGORIES.find((c) => c.id === categoryId) || SUPPORT_CATEGORIES[0];
}

export function getArticle(categoryId, articleId) {
  const category = getCategoryById(categoryId);
  if (!category?.articles?.length) return null;
  return (
    category.articles.find((a) => a.id === articleId) || category.articles[0] || null
  );
}
