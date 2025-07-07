import React, { useState, useEffect } from 'react';
import { get_agents, delete_agent } from '../../services/strategyService';
import AgentsTable from './AgentsTable';
import AgentDetailsModal from './AgentDetailsModal';
import TrainAgentModal from './TrainAgentModal';

const AgentsTabContent = () => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const data = await get_agents();

      setAgents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleAgentClick = (agent) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  const handleAgentTrained = (newAgents) => {
    setAgents(newAgents);
    setIsTrainingModalOpen(false);
  };

  const handleDeleteAgent = async (agentId) => {
    try {
      await delete_agent(agentId);
      loadAgents();
    } catch (err) {
      console.log(err);
    }
  };

  if (isLoading) {
    return (
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-6">
        <div className="text-red-500 text-center py-10">
          <p>Ошибка: {error}</p>
          <button 
            onClick={loadAgents}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-3">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <AgentsTable 
          agents={agents} 
          onAgentClick={handleAgentClick}
          onTrainNewAgent={() => setIsTrainingModalOpen(true)}
        />
      </div>

      {isModalOpen && selectedAgent && (
        <AgentDetailsModal 
          agent={selectedAgent} 
          onClose={() => setIsModalOpen(false)} 
          onRetrain={() => setIsTrainingModalOpen(true)}
          onDelete={() => handleDeleteAgent(selectedAgent.id)}
        />
      )}

      <TrainAgentModal
        isOpen={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        onAgentTrained={handleAgentTrained}
      />
    </div>
  );
};

export default AgentsTabContent;