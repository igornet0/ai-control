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
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [tab, setTab] = useState('all'); // all | my



  const fetchData = async () => {
    setItems([]);
    setLoading(true);
    try {
      // global list via /api/projects/attachments
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('sort_by', sortBy === 'type' ? 'type' : sortBy === 'size' ? 'size' : sortBy === 'name' ? 'name' : 'uploaded_at');
      params.set('sort_order', sortOrder);
      if (tab === 'my') params.set('only_my', 'true');
      params.set('limit', '10');
      const data = await authFetch(`/api/projects/attachments?${params.toString()}`);
      setItems((data && data.items) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line
  }, [query, sortBy, sortOrder, tab]);

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
        <div className="mt-6 flex items-center gap-3 mb-4">
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
          <select className="bg-[#0D1414] border border-gray-700 rounded px-2" value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
            <option value="name">Имя</option>
            <option value="size">Размер</option>
            <option value="type">Тип</option>
          </select>
          <select className="bg-[#0D1414] border border-gray-700 rounded px-2" value={sortOrder} onChange={(e)=>setSortOrder(e.target.value)}>
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>

          <button onClick={fetchData} className="bg-green-700 px-4 py-2 rounded">Обновить</button>
        </div>

        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-gray-200">
              <thead>
                <tr className="text-gray-400">
                  <th className="py-2">Проект</th>
                  <th className="py-2">Имя</th>
                  <th className="py-2">Тип</th>
                  <th className="py-2">Размер</th>
                  <th className="py-2">Загружено</th>
                  <th className="py-2">Дата загрузки</th>
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
