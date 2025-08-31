import React, { useState } from 'react';
import DataCodeEditor from './DataCodeEditor'; // путь зависит от структуры
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const DashboardDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [dataCodeScript, setDataCodeScript] = useState('# Initial DataCode script');

  const [sheets, setSheets] = useState([
    { id: 1, name: 'Overview' },
    { id: 2, name: 'Sales Data' },
    { id: 3, name: 'Marketing Report' },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');

  const dataSources = [
    { id: '1', name: 'DataCode' },
    { id: '2', name: 'MySQL Database' },
    { id: '3', name: 'PostgreSQL DB' },
    { id: '4', name: 'Google Analytics' },
    { id: '5', name: 'CSV Import' },
  ];

  const openModal = () => {
    setNewSheetName('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const addSheet = () => {
    if (newSheetName.trim() !== '') {
      const newSheet = {
        id: sheets.length + 1,
        name: newSheetName.trim(),
      };
      setSheets([...sheets, newSheet]);
      setNewSheetName('');
      setShowModal(false);
    }
  };

  const deleteSheet = (id) => {
    if (window.confirm('Are you sure you want to delete this sheet?')) {
      setSheets(sheets.filter((sheet) => sheet.id !== id));
    }
  };

  const editSheet = (id) => {
    const newName = prompt('Enter new name for the sheet:');
    if (newName) {
      setSheets(
        sheets.map((sheet) =>
          sheet.id === id ? { ...sheet, name: newName } : sheet
        )
      );
    }
  };

  const saveChanges = () => {
    alert('Changes saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-green-400">Dashboard Editor</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
          >
            ← Back to Dashboards
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Dashboard Name
          </label>
          <input
            type="text"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            placeholder="Enter dashboard name..."
            className="w-full bg-gray-800 text-gray-100 rounded-md border border-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            value={dashboardDescription}
            onChange={(e) => setDashboardDescription(e.target.value)}
            placeholder="Enter description..."
            className="w-full bg-gray-800 text-gray-100 rounded-md border border-gray-700 px-3 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Data Source
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full bg-gray-800 text-gray-100 rounded-md border border-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="">Select a data source</option>
            {dataSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          {selectedSource === '1' && (
            <div className="mt-2">
              <button
                onClick={() => setIsEditorOpen(true)}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Data Redactor
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium text-green-300 mb-2">Sheets</h2>
          <ul className="space-y-2">
            {sheets.map((sheet) => (
              <li
                key={sheet.id}
                className="flex items-center justify-between bg-gray-800 rounded-md px-3 py-2 shadow"
              >
                <Link to={`/dashboard/${id}/sheet/${sheet.id}`} className="hover:underline text-green-200">
                  {sheet.name}
                </Link>
                <div className="flex space-x-2">
                  <button
                    onClick={() => editSheet(sheet.id)}
                    className="p-1 bg-gray-700 hover:bg-gray-600 text-green-400 rounded"
                    title="Edit sheet"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteSheet(sheet.id)}
                    className="p-1 bg-gray-700 hover:bg-gray-600 text-red-500 rounded"
                    title="Delete sheet"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={openModal}
            className="mt-4 inline-flex items-center px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md shadow"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Sheet
          </button>
        </div>

        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={saveChanges}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow"
          >
            <CheckIcon className="w-5 h-5 mr-2" />
            Save Changes
          </button>
        </div>
        <DataCodeEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          code={dataCodeScript}
          setCode={setDataCodeScript}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-md shadow-lg w-80 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-green-400">Create New Sheet</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-200"
                title="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <input
              type="text"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              placeholder="Sheet name"
              className="w-full bg-gray-700 text-gray-100 rounded-md border border-gray-600 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={closeModal}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={addSheet}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
              >
                Add Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardDetail;