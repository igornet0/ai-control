import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../../hooks/useAuth';
import { listProjectFiles, addFileToFavorites, removeFileFromFavorites, listFavoriteFiles, downloadProjectFile } from '../../../../services/filesService';
import { authFetch } from '../../../../services/http';

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: 'name', direction: 'asc' });
  const [tab, setTab] = useState('all'); // all | my | favorites



  const handleSort = (field) => {
    setSortConfig((prev) => {
      // Если кликаем на то же поле, меняем направление
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      // Если кликаем на новое поле, начинаем с возрастания
      return {
        field,
        direction: "asc",
      };
    });
  };

  const fetchData = async () => {
    setItems([]);
    setLoading(true);
    try {
      let data;
      
      if (tab === 'favorites') {
        // Загружаем избранные файлы
        data = await listFavoriteFiles({
          search: query,
          sortBy: sortConfig.field === 'type' ? 'type' : sortConfig.field === 'size' ? 'size' : sortConfig.field === 'name' ? 'name' : 'added_at',
          sortOrder: sortConfig.direction,
          limit: 10
        });
      } else {
        // Загружаем все файлы или только мои файлы
        const params = new URLSearchParams();
        if (query) params.set('search', query);
        params.set('sort_by', sortConfig.field === 'type' ? 'type' : sortConfig.field === 'size' ? 'size' : sortConfig.field === 'name' ? 'name' : 'uploaded_at');
        params.set('sort_order', sortConfig.direction);
        if (tab === 'my') params.set('only_my', 'true');
        params.set('limit', '50'); // Увеличиваем лимит для лучшего отображения
        
        try {
          data = await authFetch(`/api/projects/all-attachments?${params.toString()}`);
          console.log('Files data loaded:', data);
        } catch (apiError) {
          console.error('API Error:', apiError);
          // Если это 401 или 403, показываем понятное сообщение
          if (apiError.response?.status === 401) {
            throw new Error('Необходимо авторизоваться для просмотра файлов');
          } else if (apiError.response?.status === 403) {
            throw new Error('Недостаточно прав для просмотра файлов');
          } else {
            throw new Error('Ошибка загрузки файлов. Попробуйте обновить страницу.');
          }
        }
      }
      
      const items = (data && data.items) || [];
      setItems(items);
      console.log(`Loaded ${items.length} files for tab "${tab}"`);
      
    } catch (error) {
      console.error('Error fetching files:', error);
      setItems([]);
      // Показываем понятное сообщение пользователю
      if (error.message) {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line
  }, [query, sortConfig.field, sortConfig.direction, tab]);

  const onToggleFavorite = async (projectId, filename, isFav) => {
    try {
      if (isFav) {
        await removeFileFromFavorites({ projectId, filename });
      } else {
        await addFileToFavorites({ projectId, filename });
      }
      
      // Обновляем список файлов
      await fetchData();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Ошибка при изменении избранного');
    }
  };

  const onDownload = (filename, pid) => {
    downloadProjectFile({ projectId: pid, filename });
  };



  return (
    <div className="mt-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-100">Файлы</h1>
      </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="header-tabs ml-3">
            <button className={`tab-button ${tab==='all'?'active':''}`} onClick={() => setTab('all')}>Все файлы</button>
            <button className={`tab-button ${tab==='my'?'active':''}`} onClick={() => setTab('my')}>Мои файлы</button>
            <button className={`tab-button ${tab==='favorites'?'active':''}`} onClick={() => setTab('favorites')}>Избранные файлы</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <input
            className="flex-1 bg-[#0D1414] border border-gray-700 rounded px-3 py-2"
            placeholder="Поиск файлов"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={fetchData} className="bg-green-700 px-4 py-2 rounded">Обновить</button>
        </div>

        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <div className="overflow-auto">
            <div className="text-xs text-gray-400 mb-2 px-2">
              💡 Нажмите на заголовки колонок для сортировки файлов. Нажмите еще раз для изменения порядка.
              {sortConfig.field && (
                <span className="ml-2 text-green-400">
                  Сортировка по: <strong>{sortConfig.field}</strong> ({sortConfig.direction === "asc" ? "по возрастанию" : "по убыванию"})
                </span>
              )}
            </div>
            <table className="w-full text-left text-gray-200">
              <thead>
                <tr className="text-gray-400">
                  <th className="py-2">Проект</th>
                  <th 
                    className="py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center justify-between">
                      Имя
                      <span className="ml-2 text-green-400">
                        {sortConfig.field === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center justify-between">
                      Тип
                      <span className="ml-2 text-green-400">
                        {sortConfig.field === "type" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center justify-between">
                      Размер
                      <span className="ml-2 text-green-400">
                        {sortConfig.field === "size" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th className="py-2">Загружено</th>
                  <th 
                    className="py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
                    onClick={() => handleSort("uploaded_at")}
                  >
                    <div className="flex items-center justify-between">
                      Дата загрузки
                      <span className="ml-2 text-green-400">
                        {sortConfig.field === "uploaded_at" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th className="py-2">Избранное</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-400">
                      {tab === 'favorites' && 'Нет избранных файлов'}
                      {tab === 'my' && 'У вас нет загруженных файлов'}
                      {tab === 'all' && 'Файлы не найдены'}
                      <div className="mt-2 text-sm">
                        {tab === 'all' && 'Файлы загружаются при создании или редактировании проектов'}
                        {tab === 'my' && 'Загрузите файлы в проектах, чтобы увидеть их здесь'}
                        {tab === 'favorites' && 'Добавьте файлы в избранное, чтобы увидеть их здесь'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((f)=> (
                    <tr key={f.project_id+'/'+f.filename} className="border-t border-gray-800">
                      <td className="py-2">{f.project_name || f.project_id}</td>
                      <td className="py-2 break-all">{f.filename}</td>
                      <td className="py-2">{f.content_type || '-'}</td>
                      <td className="py-2">{(f.size || 0).toLocaleString()} B</td>
                      <td className="py-2">{f.uploaded_by || '-'}</td>
                      <td className="py-2">{f.uploaded_at || '-'}</td>
                      <td className="py-2">
                        <button 
                          onClick={() => onToggleFavorite(f.project_id, f.filename, f.is_favorite)}
                          className={`px-3 py-1 rounded text-sm ${f.is_favorite ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                          title={f.is_favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                          disabled={tab === 'favorites'} // Временно отключаем для избранных
                        >
                          {f.is_favorite ? '★' : '☆'}
                        </button>
                      </td>
                      <td className="py-2">
                        <button onClick={()=>onDownload(f.filename, f.project_id)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors">Скачать</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
