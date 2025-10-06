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
      loadDashboards();
    } catch (error) {
      setError('Failed to create dashboard');
    }
  };

  const handleDeleteDashboard = async (id) => {
    try {
      await dashboardService.deleteDashboard(id);
      loadDashboards();
    } catch (error) {
      setError('Failed to delete dashboard');
    }
  };

  const filteredDashboards = {
    My: dashboards.filter(d => !d.is_template && d.user_id === user.id),
    Templates: templates,
    All: dashboards
  };

  const currentDashboards = filteredDashboards[activeTab] || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Загрузка дашбордов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--gradient-secondary)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="card animate-scaleIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="animate-slideInLeft">
              <h1 className="text-3xl font-bold text-gradient mb-2">Dashboards</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Manage your analytics and insights
              </p>
            </div>
            <div className="animate-slideInRight">
              <button 
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary"
              >
                <span>✨</span>
                Create Dashboard
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="text-red-300 hover:text-red-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-8">
            {Object.keys(filteredDashboards).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`btn btn-sm ${
                  activeTab === tab 
                    ? 'btn-primary' 
                    : 'btn-outline'
                }`}
              >
                {tab} ({filteredDashboards[tab].length})
              </button>
            ))}
          </div>

          {showCreateForm && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Create New Dashboard</h3>
              <form onSubmit={handleCreateDashboard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={newDashboard.name}
                    onChange={(e) => setNewDashboard({...newDashboard, name: e.target.value})}
                    className="form-input"
                    placeholder="Dashboard name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={newDashboard.description}
                    onChange={(e) => setNewDashboard({...newDashboard, description: e.target.value})}
                    className="form-input"
                    placeholder="Dashboard description"
                    rows="3"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newDashboard.is_template}
                      onChange={(e) => setNewDashboard({...newDashboard, is_template: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Make it a template</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn btn-primary">
                    Create Dashboard
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {currentDashboards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentDashboards.map(dashboard => (
                <div key={dashboard.id} className="card hover:scale-105 transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gradient">
                      {dashboard.name}
                    </h3>
                    <button
                      onClick={() => handleDeleteDashboard(dashboard.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    {dashboard.description || 'No description'}
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    Created: {new Date(dashboard.created_at).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => window.location.href = `/dashboard/${dashboard.id}`}
                    className="btn btn-primary w-full"
                  >
                    Open Dashboard
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                No {activeTab.toLowerCase()} dashboards found.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary mt-4"
              >
                <span>✨</span>
                Create your first dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardList;