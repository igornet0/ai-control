import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';

const DashboardDetail = () => {
  const { id } = useParams();

  // Dashboard data
  const [dashboardData, setDashboardData] = useState({
    title: `Dashboard ${id}`,
    description: `This is the detailed view of dashboard ${id}`,
  });

  // Dashboard sheets
  const [sheets, setSheets] = useState([
    { id: 1, name: 'Sheet 1' },
    { id: 2, name: 'Sheet 2' },
  ]);

  const [newSheetName, setNewSheetName] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDashboardData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSheet = () => {
    if (newSheetName.trim() === '') return;

    const newSheet = {
      id: sheets.length + 1,
      name: newSheetName,
    };

    setSheets((prev) => [...prev, newSheet]);
    setNewSheetName('');
  };

  return (
    <div style={{ display: 'flex', padding: '50px', gap: '50px' }}>
      
      {/* LEFT SIDE: Dashboard Editor */}
      <div style={{ flex: 1 }}>
        <h2>Edit Dashboard</h2>

        <label>Title:</label>
        <br />
        <input
          type="text"
          name="title"
          value={dashboardData.title}
          onChange={handleChange}
          style={{
            display: 'block',
            marginBottom: '20px',
            padding: '10px',
            width: '300px',
            backgroundColor: '#0e1a1a',
            color: '#e0f2f1',
          }}
        />

        <label>Description:</label>
        <textarea
          name="description"
          value={dashboardData.description}
          onChange={handleChange}
          style={{
            display: 'block',
            padding: '10px',
            width: '300px',
            height: '100px',
            backgroundColor: '#0e1a1a',
            color: '#e0f2f1',
          }}
        ></textarea>

        <div style={{ marginTop: '20px' }}>
          <button style={{ padding: '10px 20px' }}>Save Changes</button>
        </div>
      </div>

      {/* RIGHT SIDE: Sheets List */}
      <div style={{ flex: 1 }}>
        <h2>Sheets</h2>

        <ul style={{ paddingLeft: '20px' }}>
        {sheets.map((sheet) => (
            <li key={sheet.id} style={{ marginBottom: '10px' }}>
            <Link to={`/dashboard/${id}/sheet/${sheet.id}`} style={{ color: '#32e87f' }}>
                {sheet.name}
            </Link>
            </li>
        ))}
        </ul>

        <div style={{ marginTop: '30px' }}>
          <h3>Create New Sheet</h3>
          <input
            type="text"
            placeholder="Sheet Name"
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            style={{
              padding: '10px',
              width: '200px',
              backgroundColor: '#0e1a1a',
              color: '#e0f2f1',
              marginRight: '10px',
            }}
          />
          <button
            onClick={handleAddSheet}
            style={{ padding: '10px 20px' }}
          >
            Add Sheet
          </button>
        </div>
      </div>

    </div>
  );
};

export default DashboardDetail;