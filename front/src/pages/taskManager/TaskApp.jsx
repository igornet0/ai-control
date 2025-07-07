import React, { useState, useRef, useEffect } from 'react';

import ProfileSidebar from './components/profile/ProfileSidebar';
import UserGreeting from './components/profile/UserGreeting';
import ProfileTabContent from './components/profile/ProfileTabContent';
import FinanceTabContent from './components/profile/FinanceTabContent';
import FinancialActivity from './components/profile/FinancialActivity';
import ChatList from './components/profile/ChatList';
import AgentsTabContent from './components/profile/AgentsTabContent';
import StrategyTabContent from './components/profile/StrategyTabContent';
import CoinsTabContent from './components/profile/CoinsTabContent';
import ModelsTabContent from './components/profile/ModelsTabContent';
import StrategyTable from './components/profile/StrategyTable';

const TaskApp = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [assetsData, setAssetsData] = useState(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  
  const financialActivity = [
    { type: 'EXPENSE', amount: 1240, description: 'Buy BTC', date: 'TODAY, 15:30' },
    { type: 'INCOME', amount: 500, description: 'Sell ETH', date: 'TODAY, 00:00' },
    { type: 'TRANSFER', amount: 100, description: 'Add balance', date: 'YESTERDAY, 00:00' },
    { type: 'INCOME', amount: 1870, description: 'Sell XMR', date: 'JUN 02, 16:15' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <ProfileSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout} 
      />

      <div className="flex-1 p-8 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeTab === 'profile' && (
              <UserGreeting user={user} />
            )}
          
          {activeTab === 'profile' && <ProfileTabContent user={user} />}
          
          {activeTab === 'finance' && (
            <FinanceTabContent 
              user={user}
            />
          )}

           {activeTab === 'agents' && <AgentsTabContent />}
           {activeTab === 'models' && <ModelsTabContent />}
           {activeTab === 'strategy' && <StrategyTabContent />}
           {activeTab === 'strategys' && <StrategyTable />}
           {activeTab === 'coins' && <CoinsTabContent />}

           {(activeTab === 'finance' || activeTab === 'coins') && (
              <>
                <FinancialActivity activities={financialActivity} />
                <ChatList />
              </>
            )}
        </div>
      </div>
    </div>
  );
};

export default TaskApp;