# Компоненты загрузки

Этот набор компонентов предоставляет красивые и функциональные индикаторы загрузки в стиле всего сайта.

## Компоненты

### 1. LoadingPage
Полноэкранная страница загрузки для инициализации приложения.

**Использование:**
```jsx
import LoadingPage from './components/LoadingPage';

<LoadingPage message="Инициализация приложения..." />
```

**Пропсы:**
- `message` (string, optional) - сообщение загрузки (по умолчанию: "Загрузка...")

### 2. PageLoader
Встроенный загрузчик для использования внутри страниц.

**Использование:**
```jsx
import PageLoader from './components/PageLoader';

<PageLoader message="Загрузка данных..." size="medium" />
```

**Пропсы:**
- `message` (string, optional) - сообщение загрузки (по умолчанию: "Загрузка страницы...")
- `size` (string, optional) - размер загрузчика: "small", "medium", "large" (по умолчанию: "medium")

### 3. LoadingWrapper
Универсальная обертка для условного отображения загрузки.

**Использование:**
```jsx
import LoadingWrapper from './components/LoadingWrapper';

<LoadingWrapper 
  loading={isLoading} 
  message="Загрузка контента..."
  type="fullscreen"
>
  <YourContent />
</LoadingWrapper>
```

**Пропсы:**
- `loading` (boolean, required) - состояние загрузки
- `message` (string, optional) - сообщение загрузки
- `type` (string, optional) - тип загрузки: "fullscreen" | "inline" (по умолчанию: "fullscreen")
- `size` (string, optional) - размер для inline типа: "small", "medium", "large"
- `children` (React.ReactNode, required) - дочерние элементы

## Хуки

### useLoading
Хук для управления состоянием загрузки.

**Использование:**
```jsx
import useLoading from '../hooks/useLoading';

const MyComponent = () => {
  const { 
    loading, 
    loadingMessage, 
    startLoading, 
    stopLoading, 
    withLoading, 
    updateMessage 
  } = useLoading(false);

  const loadData = async () => {
    await withLoading(async () => {
      const data = await fetchData();
      setData(data);
    }, 'Загрузка данных...');
  };

  return (
    <LoadingWrapper loading={loading} message={loadingMessage}>
      <div>Ваш контент</div>
    </LoadingWrapper>
  );
};
```

**Возвращаемые значения:**
- `loading` (boolean) - текущее состояние загрузки
- `loadingMessage` (string) - текущее сообщение загрузки
- `startLoading(message)` - начать загрузку с сообщением
- `stopLoading()` - завершить загрузку
- `withLoading(asyncFunction, message)` - выполнить асинхронную функцию с индикатором загрузки
- `updateMessage(message)` - обновить сообщение загрузки

## Примеры использования

### Базовая загрузка страницы
```jsx
const DashboardPage = () => {
  const [data, setData] = useState(null);
  const { loading, withLoading } = useLoading(true);

  useEffect(() => {
    withLoading(async () => {
      const result = await fetchDashboardData();
      setData(result);
    }, 'Загрузка дашборда...');
  }, []);

  return (
    <LoadingWrapper loading={loading} type="fullscreen">
      <div>Содержимое дашборда</div>
    </LoadingWrapper>
  );
};
```

### Встроенная загрузка
```jsx
const DataTable = () => {
  const [data, setData] = useState([]);
  const { loading, withLoading } = useLoading(false);

  const refreshData = async () => {
    await withLoading(async () => {
      const newData = await fetchData();
      setData(newData);
    }, 'Обновление данных...');
  };

  return (
    <div>
      <button onClick={refreshData}>Обновить</button>
      <LoadingWrapper loading={loading} type="inline" size="medium">
        <table>
          {/* Содержимое таблицы */}
        </table>
      </LoadingWrapper>
    </div>
  );
};
```

### Множественные состояния загрузки
```jsx
const ComplexComponent = () => {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const usersLoading = useLoading(false);
  const postsLoading = useLoading(false);

  const loadUsers = async () => {
    await usersLoading.withLoading(async () => {
      const data = await fetchUsers();
      setUsers(data);
    }, 'Загрузка пользователей...');
  };

  const loadPosts = async () => {
    await postsLoading.withLoading(async () => {
      const data = await fetchPosts();
      setPosts(data);
    }, 'Загрузка постов...');
  };

  return (
    <div>
      <LoadingWrapper loading={usersLoading.loading} type="inline" size="small">
        <UserList users={users} />
      </LoadingWrapper>
      
      <LoadingWrapper loading={postsLoading.loading} type="inline" size="small">
        <PostList posts={posts} />
      </LoadingWrapper>
    </div>
  );
};
```

## Стилизация

Все компоненты используют CSS-переменные из `index.css` и полностью интегрированы в дизайн-систему приложения:

- Цвета: `--color-accent-primary`, `--color-accent-secondary`
- Градиенты: `--gradient-accent`, `--gradient-secondary`
- Анимации: `fadeIn`, `bounce`, `glow`, `float`
- Отступы и размеры: `--spacing-*`, `--radius-*`

## Адаптивность

Все компоненты адаптивны и корректно отображаются на различных размерах экрана:
- Desktop: полный размер с анимациями
- Tablet: уменьшенные размеры элементов
- Mobile: компактная версия с сохранением функциональности
