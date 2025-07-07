// import Sidebar from './panels/Sidebar';
// import Canvas from './canvas/Canvas';
// import PropertiesPanel from './panels/PropertiesPanel';

// export default function App() {
//   return (
//     <div className="layout">
//       <Sidebar />
//       <Canvas />
//       <PropertiesPanel />
//     </div>
//   );
// }


import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/main_page/Header';
import { EditModeProvider } from './context/EditModeContext';
import DashboardHeader from './pages/DashboardHeader';
import Hero from './components/main_page/Hero';
import Auth from './components/auth/Auth';
import DashboardList from './pages/DashboardList';
import DashboardDetail from './pages/DashboardDetail';
// import PrivateRoute from './components/PrivateRoute';
import CanvasPage from './pages/canvas/CanvasApp';
import TaskApp from './pages/taskManager/TaskApp';
import styles from './App.module.css';

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

const AppContent = () => {
  const location = useLocation();

  const isCanvasPage = location.pathname.includes('/dashboard/') && location.pathname.includes('/sheet/');

  return (
    <div className={styles.app}>
      <EditModeProvider>
      {isCanvasPage ? <DashboardHeader /> : <Header />}
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/signin" element={<Auth />} />
        <Route
          path="/dashboard"
          element={
            // <PrivateRoute>
            //   <DashboardList />
            // </PrivateRoute>
            <DashboardList />
          }
        />
        <Route
          path="/dashboard/:id"
          element={
            // <PrivateRoute>
            //   <DashboardDetail />
            // </PrivateRoute>
            <DashboardDetail />
          }
        />
        <Route
            path="/dashboard/:id/sheet/:sheetId"
            element={<CanvasPage />} // Теперь будет рендерить правильно
          />
        <Route
            path="/tasks"
            element={<TaskApp />} // Теперь будет рендерить правильно
          />
        {/* <Route
          path="/dashboard/:id/sheet/:sheetId"
          element={
            // <PrivateRoute>
            //   <CanvasPage />
            // </PrivateRoute>
            <CanvasPage />
          }
        />
      </Routes> */}
      </Routes> 
      </EditModeProvider>
    </div>
  );
};

export default App;