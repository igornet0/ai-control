import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import df_dashboard from '../../assets/default_dashboard.png';

const dashboardTabs = {
  My: [
    { id: 1, img: df_dashboard, name: 'Sales Dashboard' },
    { id: 2, img: df_dashboard, name: 'Marketing Dashboard' },
    { id: 3, img: df_dashboard, name: 'HR Dashboard' },
    { id: 4, img: df_dashboard, name: 'HR Dashboard' },
    { id: 5, img: df_dashboard, name: 'HR Dashboard' },
    { id: 6, img: df_dashboard, name: 'HR Dashboard' },
  ],
  Favorites: [
    { id: 1, img: df_dashboard, name: 'Sales Dashboard' },
    { id: 2, img: df_dashboard, name: 'Marketing Dashboard' },
  ],
  Finance: [
    { id: 4, img: df_dashboard, name: 'Budget 2025' },
  ],
  HR: [
    { id: 5, img: df_dashboard, name: 'Team Overview' },
  ],
};

const DashboardList = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('My');
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedDashboard, setSelectedDashboard] = useState(null);

  const dashboards = dashboardTabs[activeTab] || [];

  const handleContextMenu = (e, dashboard) => {
    e.preventDefault();
    setSelectedDashboard(dashboard);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleOpen = () => {
    window.location.href = `/dashboard/${selectedDashboard.id}`;
  };

  const handleRename = () => {
    const newName = prompt('Enter new dashboard name:', selectedDashboard.name);
    if (newName) {
      alert(`Renamed to: ${newName}`);
    }
    closeContextMenu();
  };

  const handleChangeImage = () => {
    alert('Open image picker modal (not implemented)');
    closeContextMenu();
  };

  const handleDelete = () => {
    if (window.confirm('Delete this dashboard?')) {
      alert(`Dashboard ${selectedDashboard.name} deleted.`);
    }
    closeContextMenu();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] text-gray-100 p-6" onClick={closeContextMenu}>
      <h3 className="text-2xl font-semibold mb-6 text-green-300">Your Dashboards</h3>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        {Object.keys(dashboardTabs).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'My' && (
        <div className="mb-4">
          <button
            onClick={() => alert('Open Create Dashboard modal')}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md shadow"
          >
            + Create New Dashboard
          </button>
        </div>
      )}

      {/* Scrollable Horizontal Dashboard List */}
      <div className="overflow-x-auto pb-4">
        <ul className="flex space-x-6">
          {dashboards.map((dashboard) => (
            <li
              key={dashboard.id}
              onContextMenu={(e) => handleContextMenu(e, dashboard)}
              className="rounded-xl border-2 border-gray-700 bg-[#020D0D] overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex-none w-[300px] h-[350px]"
            >
              <Link
                to={`/dashboard/${dashboard.id}`}
                className="flex flex-col w-full h-full"
              >
                <img
                  src={dashboard.img}
                  alt={dashboard.name}
                  className="w-full h-[250px] object-cover"
                />
                <h3 className="text-center border-t border-gray-700 py-4 text-lg font-medium bg-[#020D0D]">
                  {dashboard.name}
                </h3>
              </Link>
            </li>
          ))}

          {activeTab === 'My' && (
            <li
              onClick={() => alert('Open Create Dashboard modal')}
              className="rounded-xl border-2 border-dashed border-gray-600 bg-gray-800 flex flex-col items-center justify-center h-[350px] w-[300px] cursor-pointer hover:bg-gray-700 transition flex-none"
            >
              <div className="text-6xl text-gray-400 mb-2">+</div>
              <p className="text-gray-400 text-center">Create New Dashboard</p>
            </li>
          )}
        </ul>
      </div>

      {/* Context Menu */}
      {contextMenu && selectedDashboard && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded shadow-md z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <ul className="text-sm text-gray-200">
            <li onClick={handleOpen} className="px-4 py-2 hover:bg-gray-700 cursor-pointer">Open</li>
            <li onClick={handleRename} className="px-4 py-2 hover:bg-gray-700 cursor-pointer">Rename</li>
            <li onClick={handleChangeImage} className="px-4 py-2 hover:bg-gray-700 cursor-pointer">Change Image</li>
            <li onClick={handleDelete} className="px-4 py-2 hover:bg-red-700 text-red-400 cursor-pointer">Delete</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DashboardList;