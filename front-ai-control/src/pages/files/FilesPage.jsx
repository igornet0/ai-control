import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { listProjectFiles, toggleFavoriteFile, downloadProjectFile } from '../../services/filesService';
import { projectService } from '../../services/projectService';

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [tab, setTab] = useState('all'); // all | my
  const [globalView, setGlobalView] = useState(false); // list across all projects
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filesToUpload, setFilesToUpload] = useState(null);

  const fetchData = async () => {
    setItems([]);
    if (!globalView && !projectId) return;
    setLoading(true);
    try {
      if (globalView) {
        // global list via /api/projects/attachments
        const base = process.env.REACT_APP_API_URL || '';
        const token = localStorage.getItem('access_token');
        const params = new URLSearchParams();
        if (query) params.set('search', query);
        params.set('sort_by', sortBy === 'type' ? 'type' : sortBy === 'size' ? 'size' : 'uploaded_at');
        params.set('sort_order', sortOrder);
        if (tab === 'my') params.set('only_my', 'true');
        params.set('limit', '10');
        const res = await fetch(`${base}/api/projects/attachments?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const data = await res.json();
        setItems(data.items || []);
      } else {
        const data = await listProjectFiles({ projectId, search: query, sortBy, sortOrder, onlyMy: tab === 'my' });
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line
  }, [projectId, query, sortBy, sortOrder, tab, globalView]);

  const onToggleFavorite = async (filename, isFav) => {
    if (globalView) return;
    await toggleFavoriteFile({ projectId, filename, favorite: !isFav });
    fetchData();
  };

  const onDownload = (filename, pid) => {
    downloadProjectFile({ projectId: pid || projectId, filename });
  };

  const onUpload = async () => {
    if (!projectId || !filesToUpload || filesToUpload.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      // use axios instance in projectService via api which supports onUploadProgress
      await projectService.uploadProjectAttachments(projectId, Array.from(filesToUpload), (e) => {
        if (e.total) {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      });
      setFilesToUpload(null);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm text-gray-100">
      <div className="bg-[#0F1717] rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <button className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded" onClick={()=>navigate('/tasks')}>← К задачам</button>
          <div className="header-tabs ml-3">
            <button className={`tab-button ${tab==='all'?'active':''}`} onClick={() => setTab('all')}>Все файлы</button>
            <button className={`tab-button ${tab==='my'?'active':''}`} onClick={() => setTab('my')}>Мои файлы</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 items-center">
                      <label className="flex items-center gap-2 text-gray-300">
              <input type="checkbox" checked={globalView} onChange={(e)=>setGlobalView(e.target.checked)} /> Глобальный вид (все проекты)
            </label>
          {!globalView && (
            <input
              className="bg-[#0D1414] border border-gray-700 rounded px-3 py-2"
              placeholder="ID проекта"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          )}
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
          {!globalView && (
            <>
              <input type="file" multiple onChange={(e)=>setFilesToUpload(e.target.files)} className="text-gray-300" />
              <button onClick={onUpload} disabled={uploading || !filesToUpload || filesToUpload.length===0} className="bg-green-600 px-4 py-2 rounded disabled:opacity-50">
                {uploading ? `Загрузка ${uploadProgress}%` : 'Загрузить'}
              </button>
            </>
          )}
          <button onClick={fetchData} className="bg-green-700 px-4 py-2 rounded">Обновить</button>
        </div>

        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-gray-200">
              <thead>
                <tr className="text-gray-400">
                  {!globalView && <th className="py-2">Избранное</th>}
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
                  <tr key={(f.project_id||projectId)+'/'+f.filename} className="border-t border-gray-800">
                    {!globalView && (
                      <td className="py-2">
                        <button onClick={()=>onToggleFavorite(f.filename, f.is_favorite)} title={f.is_favorite? 'Убрать из избранного':'Добавить в избранное'}>
                          {f.is_favorite ? '★' : '☆'}
                        </button>
                      </td>
                    )}
                    <td className="py-2">{f.project_name || projectId}</td>
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
