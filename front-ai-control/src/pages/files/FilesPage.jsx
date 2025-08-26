import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { listProjectFiles, toggleFavoriteFile, downloadProjectFile } from '../../services/filesService';
import { authFetch } from '../../services/http';
import HeaderTabs from '../taskManager/components/HeaderTabs';

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: 'name', direction: 'asc' });
  const [tab, setTab] = useState('all'); // all | my



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
      // global list via /api/projects/attachments
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('sort_by', sortConfig.field === 'type' ? 'type' : sortConfig.field === 'size' ? 'size' : sortConfig.field === 'name' ? 'name' : 'uploaded_at');
      params.set('sort_order', sortConfig.direction);
      if (tab === 'my') params.set('only_my', 'true');
      params.set('limit', '10');
      const data = await authFetch(`/api/projects/attachments?${params.toString()}`);
      setItems((data && data.items) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line
  }, [query, sortConfig.field, sortConfig.direction, tab]);

  const onToggleFavorite = async (filename, isFav) => {
    // Favorites functionality removed - files are view-only
  };

  const onDownload = (filename, pid) => {
    downloadProjectFile({ projectId: pid, filename });
  };



  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm text-gray-100">
      <div className="bg-[#0F1717] rounded-xl shadow-md p-6">
        <HeaderTabs />
        <div className="mt-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-100">Файлы</h1>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="header-tabs ml-3">
            <button className={`tab-button ${tab==='all'?'active':''}`} onClick={() => setTab('all')}>Все файлы</button>
            <button className={`tab-button ${tab==='my'?'active':''}`} onClick={() => setTab('my')}>Мои файлы</button>
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
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f)=> (
                  <tr key={f.project_id+'/'+f.filename} className="border-t border-gray-800">
                    <td className="py-2">{f.project_name || f.project_id}</td>
                    <td className="py-2">{f.filename}</td>
                    <td className="py-2">{f.content_type || '-'}</td>
                    <td className="py-2">{(f.size || 0).toLocaleString()} B</td>
                    <td className="py-2">{f.uploaded_by || '-'}</td>
                    <td className="py-2">{f.uploaded_at || '-'}</td>
                    <td className="py-2">
                      <button onClick={()=>onDownload(f.filename, f.project_id)} className="bg-blue-600 px-3 py-1 rounded">Скачать</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
