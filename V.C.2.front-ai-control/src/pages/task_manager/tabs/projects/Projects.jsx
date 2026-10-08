import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../../hooks/useAuth';
import { projectService } from '../../../../services/projectService';
import ProjectCard from './components/ProjectCard';
import CreateProjectModal from './components/CreateProjectModal';
import ProjectsCalendar from './components/ProjectsCalendar';
import './Projects.css';
import { CloseIcon, PlusIconSm, ProjectsIcon, SearchIcon } from '../../components/TaskManagerIcons';
import '../tmPage.css';

const pluralize = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const Projects = ({ deepLinkProjectId = null }) => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // list | calendar
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();

  // Загрузка проектов
  const loadProjects = async () => {
    try {
      setLoading(true);
            const projectsData = await projectService.getProjects();
            
      // Проверяем, что projectsData это массив
      if (Array.isArray(projectsData)) {
        setProjects(projectsData);
        setFilteredProjects(projectsData);
        setError(null);
      } else {
        console.error('Projects data is not an array:', projectsData);
        setError('Неверный формат данных проектов');
        setProjects([]);
        setFilteredProjects([]);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(`Ошибка при загрузке проектов: ${err.message}`);
      setProjects([]);
      setFilteredProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!deepLinkProjectId) return;
    setActiveTab('list');
    setExpandedProjectId(Number(deepLinkProjectId));
  }, [deepLinkProjectId]);

  // Фильтрация проектов
  useEffect(() => {
        let filtered = projects;

    if (searchTerm) {
      filtered = filtered.filter(project =>
        (project.name && project.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    if (priorityFilter) {
      filtered = filtered.filter(project => project.priority === priorityFilter);
    }

        setFilteredProjects(filtered);
  }, [projects, searchTerm, statusFilter, priorityFilter]);

  useEffect(() => {
    if (loading || !expandedProjectId || filteredProjects.length === 0) return;
    if (!filteredProjects.some((project) => Number(project.id) === Number(expandedProjectId))) {
      setExpandedProjectId(null);
    }
  }, [filteredProjects, expandedProjectId, loading]);

  const displayedProjects = useMemo(() => {
    if (!expandedProjectId) return filteredProjects;
    const expanded = filteredProjects.find((project) => Number(project.id) === Number(expandedProjectId));
    if (!expanded) return filteredProjects;
    return [expanded, ...filteredProjects.filter((project) => project.id !== expandedProjectId)];
  }, [filteredProjects, expandedProjectId]);

  const handleProjectExpandChange = (projectId, expanded) => {
    setExpandedProjectId(expanded ? projectId : null);
  };

  // Создание проекта
  const handleCreateProject = async (projectData, files = [], onProgress) => {
    let createdProject = null;
    try {
      // Сначала создаем проект
      createdProject = await projectService.createProject(projectData);
      
      // Если есть файлы, обязательно загружаем их
      if (createdProject && createdProject.id && files && files.length > 0) {
        try {
          // Загружаем вложения - КРИТИЧНО для успешного создания
          const projectWithAttachments = await projectService.uploadProjectAttachments(createdProject.id, files, onProgress);
          
          // Только если все файлы загрузились успешно, добавляем проект в список
          setProjects(prev => [projectWithAttachments, ...prev]);
          setError(null);
          return projectWithAttachments;
        } catch (uploadError) {
          console.error('Failed to upload files for new project:', uploadError);
          
          // Если файлы не загрузились, удаляем созданный проект
          try {
            await projectService.deleteProject(createdProject.id);
                      } catch (deleteError) {
            console.error('Failed to cleanup project after upload failure:', deleteError);
          }
          
          // Показываем ошибку пользователю
          setError('Ошибка при загрузке файлов. Проект не был создан.');
          throw new Error('Файлы не были загружены');
        }
      } else {
        // Нет файлов - просто добавляем проект
        setProjects(prev => [createdProject, ...prev]);
        setError(null);
        return createdProject;
      }
    } catch (err) {
      if (err.message !== 'Файлы не были загружены') {
        setError('Ошибка при создании проекта');
      }
      console.error('Error creating project:', err);
      throw err;
    }
  };

  // Удаление проекта
  const handleDeleteProject = async (projectId) => {
    try {
      await projectService.deleteProject(projectId);
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      setError(null);
    } catch (err) {
      setError('Ошибка при удалении проекта');
      console.error('Error deleting project:', err);
      throw err;
    }
  };

  // Обновление проекта
  const handleUpdateProject = async (projectId, updatedProjectData = {}) => {
    try {
      const isFullProject = updatedProjectData?.id === projectId
        && typeof updatedProjectData?.name === 'string';
      const isRefreshOnly = !updatedProjectData || Object.keys(updatedProjectData).length === 0;

      const updatedProject = isFullProject
        ? updatedProjectData
        : isRefreshOnly
          ? await projectService.getProject(projectId)
          : await projectService.updateProject(projectId, updatedProjectData);

      setProjects((prev) => prev.map((project) =>
        project.id === projectId ? updatedProject : project,
      ));
      setError(null);
      return updatedProject;
    } catch (err) {
      setError('Ошибка при обновлении проекта');
      console.error('Error updating project:', err);
      throw err;
    }
  };

  if (loading || userLoading) {
    return <div className="tm-loading">Загрузка проектов…</div>;
  }

  const activeCount = projects.filter((project) => project.status === 'active').length;
  const hasFilters = Boolean(searchTerm || statusFilter || priorityFilter);

  return (
    <div className="projects-page">
      <header className="tm-page-header">
        <div>
          <h1 className="tm-page-header__title">
            <ProjectsIcon size="lg" className="text-violet-400" />
            Проекты
          </h1>
          <p className="tm-page-header__subtitle">
            <strong>{projects.length}</strong> {pluralize(projects.length, 'проект', 'проекта', 'проектов')}
            {activeCount > 0 && <> · <strong>{activeCount}</strong> в работе</>}
          </p>
        </div>
        <div className="tm-page-header__actions">
          <button type="button" className="tm-btn tm-btn--primary" onClick={() => setShowCreateModal(true)}>
            <PlusIconSm size="sm" />
            Новый проект
          </button>
        </div>
      </header>

      {error && (
        <div className="tm-banner tm-banner--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Скрыть"><CloseIcon size="sm" /></button>
        </div>
      )}

      <div className="tm-toolbar">
        <div className="tm-segmented" role="tablist" aria-label="Вид">
          {[
            { id: 'list', label: 'Список' },
            { id: 'calendar', label: 'Календарь' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tm-segmented__btn ${activeTab === tab.id ? 'tm-segmented__btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tm-search">
          <SearchIcon size="sm" className="tm-search__icon" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="tm-input"
            aria-label="Поиск проектов"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`tm-select ${statusFilter ? 'tm-select--active' : ''}`}
          aria-label="Статус"
        >
          <option value="">Все статусы</option>
          <option value="planning">Планирование</option>
          <option value="active">Активные</option>
          <option value="on_hold">На паузе</option>
          <option value="completed">Завершённые</option>
          <option value="cancelled">Отменённые</option>
          <option value="archived">Архивные</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={`tm-select ${priorityFilter ? 'tm-select--active' : ''}`}
          aria-label="Приоритет"
        >
          <option value="">Все приоритеты</option>
          <option value="low">Низкий</option>
          <option value="medium">Средний</option>
          <option value="high">Высокий</option>
          <option value="critical">Критичный</option>
          <option value="urgent">Срочный</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            className="tm-toolbar__reset"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setPriorityFilter('');
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      {activeTab === 'list' ? (
        <div className="projects-grid">
          {displayedProjects.length === 0 ? (
            <div className="tm-empty">
              <ProjectsIcon size="2xl" className="text-slate-500" />
              <span>{hasFilters ? 'Ничего не найдено' : 'Проектов пока нет'}</span>
              <span className="tm-empty__hint">
                {hasFilters ? 'Измените поиск или сбросьте фильтры' : 'Создайте первый проект — кнопка «Новый проект» вверху'}
              </span>
            </div>
          ) : (
            displayedProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                isExpanded={Number(expandedProjectId) === Number(project.id)}
                onExpandChange={(expanded) => handleProjectExpandChange(project.id, expanded)}
                onDelete={handleDeleteProject}
                onUpdate={handleUpdateProject}
              />
            ))
          )}
        </div>
      ) : (
        <ProjectsCalendar projects={filteredProjects} />
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProject}
        />
      )}
    </div>
  );
};

export default Projects;
