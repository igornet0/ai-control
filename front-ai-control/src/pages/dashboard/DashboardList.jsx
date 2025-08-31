import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import styles from './Dashboard.module.css';

const DashboardList = () => {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('My');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState(null);
  const [newDashboard, setNewDashboard] = useState({
    name: '',
    description: '',
    is_template: false
  });

  const loadDashboards = async () => {
    try {
      const [dashboardsData, templatesData, statsData] = await Promise.all([
        dashboardService.getDashboards(),
        dashboardService.getTemplates(),
        dashboardService.getStats()
      ]);
      
      setDashboards(dashboardsData);
      setTemplates(templatesData);
      setStats(statsData);
    } catch (error) {
      setError('Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboards();
    }
  }, [user]);

  const handleCreateDashboard = async (e) => {
    e.preventDefault();
    
    try {
      await dashboardService.createDashboard(newDashboard);
      setNewDashboard({ name: '', description: '', is_template: false });
      setShowCreateForm(false);
      await loadDashboards(); // Reload dashboards after creation
    } catch (error) {
      setError('Failed to create dashboard');
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (window.confirm('Are you sure you want to delete this dashboard?')) {
      try {
        await dashboardService.deleteDashboard(id);
        await loadDashboards();
      } catch (error) {
        setError('Failed to delete dashboard');
      }
    }
  };

  if (loading || !user) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const filteredDashboards = {
    My: dashboards.filter(d => !d.is_template && d.user_id === user.id),
    Templates: templates,
    All: dashboards
  };

  const currentDashboards = filteredDashboards[activeTab] || [];

  return (
    <div className={styles.dashboardList}>
      <div className={styles.header}>
        <h1>Dashboards</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className={styles.createButton}
        >
          Create Dashboard
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className={styles.tabs}>
        {Object.keys(filteredDashboards).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
          >
            {tab} ({filteredDashboards[tab]?.length || 0})
          </button>
        ))}
      </div>

      {showCreateForm && (
        <div className={styles.createForm}>
          <h3>Create New Dashboard</h3>
          <form onSubmit={handleCreateDashboard}>
            <input
              type="text"
              placeholder="Dashboard Name"
              value={newDashboard.name}
              onChange={(e) => setNewDashboard({...newDashboard, name: e.target.value})}
              required
            />
            <textarea
              placeholder="Description"
              value={newDashboard.description}
              onChange={(e) => setNewDashboard({...newDashboard, description: e.target.value})}
            />
            <label>
              <input
                type="checkbox"
                checked={newDashboard.is_template}
                onChange={(e) => setNewDashboard({...newDashboard, is_template: e.target.checked})}
              />
              Is Template
            </label>
            <div className={styles.formButtons}>
              <button type="submit">Create</button>
              <button type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.dashboardGrid}>
        {currentDashboards.map(dashboard => (
          <div key={dashboard.id} className={styles.dashboardCard}>
            <h3>{dashboard.name}</h3>
            <p>{dashboard.description}</p>
            <div className={styles.dashboardMeta}>
              <span>Created: {new Date(dashboard.created_at).toLocaleDateString()}</span>
              {dashboard.user_id === user.id && (
                <button
                  onClick={() => handleDeleteDashboard(dashboard.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentDashboards.length === 0 && (
        <div className={styles.emptyState}>
          <p>No {activeTab.toLowerCase()} dashboards found.</p>
        </div>
      )}
    </div>
  );
};

export default DashboardList;