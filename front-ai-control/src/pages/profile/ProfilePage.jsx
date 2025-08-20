// src/pages/profile/ProfilePage.jsx
import React, { useState, useRef, useEffect } from 'react';

import ProfileSidebar from './components/ProfileSidebar';
import Profile from './components/Profile';


const ProfilePage = ({ user, onLogout }) => {

  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="max-h-screen bg-gray-100 flex">
      <ProfileSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout}
      />
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"></div>
        <Profile 
            activeTab={activeTab} 
            user={user}
            setActiveTab={setActiveTab} 
            onLogout={onLogout} 
            />
      </div>
    </div>
  );
};

export default ProfilePage;
// import { useState } from 'react';

// export default function ProfilePage() {
//   const [activeTab, setActiveTab] = useState('Business Overview');
  
//   const tabs = ['Business Overview', 'Performance', 'Issues', 'Revenue'];
  
//   // Данные для графика
//   const chartData = [6, 6, 4, 2, 0, 3, 5, 4];
//   const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  
//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Верхняя навигационная панель */}
//       <header className="bg-white shadow-sm">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex justify-between items-center h-16">
//             <div className="flex items-center">
//               <h1 className="text-2xl font-bold text-gray-900">AI-CONTROL</h1>
//             </div>
//             <div className="flex items-center">
//               <div className="text-right mr-4">
//                 <p className="text-sm font-medium text-gray-900">John Doe</p>
//                 <p className="text-xs text-gray-500">johndoe@gmail.com</p>
//               </div>
//               <div className="ml-22 bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
//             </div>
//           </div>
//         </div>
//       </header>

//       {/* Основной контент */}
//       <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Горизонтальные вкладки */}
//         <div className="border-b border-gray-200 mb-6">
//           <nav className="-mb-px flex space-x-8">
//             {tabs.map(tab => (
//               <button
//                 key={tab}
//                 className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
//                   activeTab === tab
//                     ? 'border-blue-500 text-blue-600'
//                     : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//                 }`}
//                 onClick={() => setActiveTab(tab)}
//               >
//                 {tab}
//               </button>
//             ))}
//           </nav>
//         </div>

//         {/* Заголовок активной вкладки */}
//         <h2 className="text-2xl font-bold text-gray-900 mb-6">{activeTab}</h2>

//         {/* Карточки с метриками */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//           <MetricCard value="76%" title="Performance" />
//           <MetricCard value="5" title="Issues" />
//           <MetricCard value="25.6M" title="Revenue" />
//         </div>

//         {/* График */}
//         <div className="bg-white rounded-lg shadow-md p-6">
//           <div className="flex justify-between items-center mb-6">
//             <h2 className="text-lg font-semibold text-gray-800">Revenue</h2>
//             <div className="flex space-x-4">
//               <div className="flex items-center">
//                 <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
//                 <span className="text-sm text-gray-600">Issues</span>
//               </div>
//               <div className="flex items-center">
//                 <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
//                 <span className="text-sm text-gray-600">Forecast</span>
//               </div>
//             </div>
//           </div>
          
//           {/* Контейнер графика */}
//           <div className="mt-8">
//             <div className="flex items-end h-48 gap-x-8">
//               {chartData.map((value, index) => (
//                 <div key={index} className="flex flex-col items-center flex-1">
//                   <div className="flex items-end justify-center w-full h-full">
//                     <div 
//                       className="w-6 bg-blue-500 rounded-t transition-all duration-500"
//                       style={{ height: `${value * 15}%` }}
//                     ></div>
//                   </div>
//                   <span className="mt-2 text-xs text-gray-500">{months[index]}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

// // Компонент карточки метрики
// function MetricCard({ value, title }) {
//   return (
//     <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
//       <p className="text-3xl font-bold text-gray-800 mb-2">{value}</p>
//       <p className="text-sm text-gray-500">{title}</p>
//     </div>
//   );
// }