import React from 'react';
import logo from '../../img/logo.webp';

const ProfileSidebar = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <div className="w-64 bg-gradient-to-b from-blue-900 to-purple-900 text-white p-6 flex flex-col">
      <div className="mb-10">
        <a href="https://agent-trade.ru" className="flex items-center">
        <img src={logo} alt="AI Trading Logo" className="w-20 h-auto" />
        <h1 className="text-2xl font-bold">Agent Trade</h1>
        </a>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-4">
          <li>
            <button 
              className={`w-full text-left p-3 rounded-lg transition ${activeTab === 'profile' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
              onClick={() => setActiveTab('profile')}
            >
              <div className="flex items-center">
                <span className="ml-2">Профиль</span>
              </div>
            </button>
          </li>
          <li>
            <button 
              className={`w-full text-left p-3 rounded-lg transition ${activeTab === 'finance' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
              onClick={() => setActiveTab('finance')}
            >
              <div className="flex items-center">
                <span className="ml-2">Финансы</span>
              </div>
            </button>
          </li>
          <li>
            <button 
              className={`w-full text-left p-3 rounded-lg transition ${activeTab === 'agents' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
              onClick={() => setActiveTab('agents')}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Агенты</span>
              </div>
            </button>
          </li>
          <li>
            <button 
              className={`w-full text-left p-3 rounded-lg transition ${activeTab === 'models' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
              onClick={() => setActiveTab('models')}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Модели</span>
              </div>
            </button>
          </li>
          <li>
            <button 
              className={`w-full text-left p-3 rounded-lg transition ${activeTab === 'strategy' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
              onClick={() => setActiveTab('strategy')}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Создание стратегии</span>
              </div>
            </button>
          </li>
          <li>
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'strategys' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'
              }`}
              onClick={() => setActiveTab('strategys')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              <span>Стратегии</span>
            </button>
          </li>
          <li>
          <button 
            className={`w-full text-left p-3 rounded-lg transition ${
              activeTab === 'coins' ? 'bg-white text-blue-900' : 'hover:bg-blue-800'}`}
            onClick={() => setActiveTab('coins')}
          >
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
              <span>Монеты</span>
            </div>
          </button>
        </li>
          {/* Остальные пункты меню */}
        </ul>
      </nav>
      
      <div className="mt-auto">
        <button 
          className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg transition"
          onClick={onLogout}
        >
          Выйти
        </button>
      </div>
    </div>
  );
};

export default ProfileSidebar;