import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { projectService } from '../../services/projectService';
import ProjectCard from './components/ProjectCard';
import CreateProjectModal from './components/CreateProjectModal';
import ProjectsCalendar from './components/ProjectsCalendar';
import HeaderTabs from '../taskManager/components/HeaderTabs';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // list | calendar
  
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();

  // Загрузка проектов
  const loadProjects = async () => {
    try {
      setLoading(true);
      console.log('Loading projects...');
      const projectsData = await projectService.getProjects();
      console.log('Projects loaded:', projectsData);
      
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

  // Фильтрация проектов
  useEffect(() => {
    console.log('Filtering projects...', { projects, searchTerm, statusFilter, priorityFilter });
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

    console.log('Filtered projects:', filtered);
    setFilteredProjects(filtered);
  }, [projects, searchTerm, statusFilter, priorityFilter]);

  // Создание проекта
  const handleCreateProject = async (projectData, files = [], onProgress) => {
    try {
      const newProject = await projectService.createProject(projectData);
      let projectWithAttachments = newProject;
      if (newProject && newProject.id && files && files.length > 0) {
        try {
          // загрузим вложения и получим обновленный проект с attachments
          projectWithAttachments = await projectService.uploadProjectAttachments(newProject.id, files, onProgress);
        } catch (e) {
          console.error('Failed to upload attachments for new project:', e);
        }
      }
      setProjects(prev => [projectWithAttachments, ...prev]);
      setError(null);
      return projectWithAttachments;
    } catch (err) {
      setError('Ошибка при создании проекта');
      console.error('Error creating project:', err);
    }
  };

  // Удаление проекта
  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.')) {
      try {
        await projectService.deleteProject(projectId);
        setProjects(prev => prev.filter(project => project.id !== projectId));
        setError(null);
      } catch (err) {
        setError('Ошибка при удалении проекта');
        console.error('Error deleting project:', err);
      }
    }
  };

  // Обновление проекта
  const handleUpdateProject = async (projectId, projectData) => {
    try {
      const updatedProject = await projectService.updateProject(projectId, projectData);
      setProjects(prev => prev.map(project => 
        project.id === projectId ? updatedProject : project
      ));
      setError(null);
    } catch (err) {
      setError('Ошибка при обновлении проекта');
      console.error('Error updating project:', err);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="projects-container">
        <div className="loading">Загрузка проектов...</div>
      </div>
    );
  }

  return (
    <div className="projects-container">
      <HeaderTabs />
      <div className="projects-header">
        <div className="header-left">
          <div className="title-section">
            <h1 className="text-2xl font-bold text-gray-100">Проекты</h1>
            <div className="projects-counter">
              <span className="counter-label">Всего проектов:</span>
              <span className="counter-value">
                {projects.length}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="create-project-btn"
            onClick={() => setShowCreateModal(true)}
          >
            Создать проект
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="projects-tabs">
        <button className={`tab-btn ${activeTab === 'list' ? 'tab-active' : ''}`} onClick={() => setActiveTab('list')}>Список</button>
        <button className={`tab-btn ${activeTab === 'calendar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('calendar')}>Календарь</button>
      </div>

      <div className="projects-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-select"
          >
            <option value="">Все статусы</option>
            <option value="planning">Планирование</option>
            <option value="active">Активные</option>
            <option value="on_hold">На паузе</option>
            <option value="completed">Завершенные</option>
            <option value="cancelled">Отмененные</option>
            <option value="archived">Архивные</option>
          </select>
        </div>

        <div className="priority-filter">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="priority-select"
          >
            <option value="">Все приоритеты</option>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
            <option value="urgent">Срочный</option>
          </select>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="projects-grid">
          {filteredProjects.length === 0 ? (
            <div className="no-projects">
              {searchTerm || statusFilter || priorityFilter 
                ? 'Проекты не найдены' 
                : 'Проекты не созданы'
              }
            </div>
          ) : (
            filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
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
