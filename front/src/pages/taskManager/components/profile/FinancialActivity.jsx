import React from 'react';

const FinancialActivity = ({ activities }) => {
  return (
  <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
  <h2 className="text-xl font-bold text-gray-800 mb-4">Транзакции</h2>
  <div className="space-y-4">
    {activities.map((activity, index) => (
      <div 
        key={index} 
        className={`p-4 rounded-lg ${
          activity.type === 'EXPENSE' ? 'bg-red-50' : 
          activity.type === 'INCOME' ? 'bg-green-50' : 
          'bg-blue-50'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="font-semibold">{activity.description}</div>
          <div className={`font-bold ${
            activity.type === 'EXPENSE' ? 'text-red-700' : 
            activity.type === 'INCOME' ? 'text-green-700' : 
            'text-blue-700'
          }`}>
            {activity.type === 'EXPENSE' ? '-' : '+'}${activity.amount}
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              activity.type === 'EXPENSE' ? 'bg-red-500' : 
              activity.type === 'INCOME' ? 'bg-green-500' : 
              'bg-blue-500'
            }`}></div>
            <span>{activity.type}</span>
          </div>
          <span>{activity.date}</span>
        </div>
      </div>
    ))}
  </div>
</div>
  );
};

export default FinancialActivity;

