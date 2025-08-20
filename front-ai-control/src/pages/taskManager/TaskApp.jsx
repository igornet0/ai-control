import React, { useState, useRef, useEffect } from 'react';
import HeaderTabs from "./components/HeaderTabs";
import TaskTable from "./components/TaskTable";
import ProgressChart from "./components/ProgressChart";
import BarChart from "./components/BarChart";
import TeamRatings from "./components/TeamRatings";

const TaskApp = ({ user, onLogout }) => {
   return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm">
      <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] rounded-xl shadow-md p-6">
        <HeaderTabs />
        <div className="mt-6 flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Tasks</h2>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                + New Task
              </button>
            </div>
            <TaskTable />
          </div>

          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <ProgressChart />
            <BarChart />
            <TeamRatings />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskApp;