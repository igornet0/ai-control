import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './pages/main_page/Header';
import { EditModeProvider } from './context/EditModeContext';
import DashboardHeader from './pages/dashboard/DashboardHeader';
import ProfileHeader from './pages/profile/ProfileHeader';
import Hero from './pages/main_page/Hero';
import ModernAuth from './components/auth/ModernAuth';
import DashboardList from './pages/dashboard/DashboardList';
import DashboardDetail from './pages/dashboard/DashboardDetail';
import ProfilePage from './pages/profile/ProfilePage';
// import PrivateRoute from './components/PrivateRoute';
import CanvasPage from './pages/canvas/CanvasApp';
import TaskApp from './pages/taskManager/TaskApp';
import CreateTaskPage from './pages/tasks/CreateTaskPage';
import LoadingPage from './components/LoadingPage';
import styles from './App.module.css';
import { useAuth } from './context/AuthContext';

// Удаляем старый компонент FullPageSpinner, так как теперь используем LoadingPage

const App = () => {
  const { user, loading, login, logout } = useAuth();
  const isAuthenticated = !!user;

  console.log('App render - loading:', loading, 'user:', user, 'isAuthenticated:', isAuthenticated);

  if (loading) {
    console.log('Showing loading page');
    return <LoadingPage message="Инициализация приложения..." />;
  }

  return (
    <Router>
      <AppContent user={user} isAuthenticated={isAuthenticated} login={login} logout={logout} />
    </Router>
  );
};

const AppContent = ({ user, isAuthenticated, login, logout }) => {
  const location = useLocation();

  const isCanvasPage = location.pathname.includes('/dashboard/') && location.pathname.includes('/sheet/');
  const isProfilePage = location.pathname === '/profile' || location.pathname === '/profile/';

  return (
    <div className={styles.app}>
      <EditModeProvider>
      {isCanvasPage ? <DashboardHeader isAuthenticated={isAuthenticated} /> : 
      isProfilePage ? <ProfileHeader isAuthenticated={isAuthenticated} /> : <Header isAuthenticated={isAuthenticated} />}
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/dashboard" element={
          isAuthenticated 
            ? <DashboardList user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />

        <Route path="/signin" element={
           isAuthenticated 
            ? <Navigate to="/profile" /> : <ModernAuth login={login} />} />
        <Route path="/signup" element={<ModernAuth login={login} />} />

        <Route path="/profile" element={
          isAuthenticated 
            ? <ProfilePage user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />

        <Route
          path="/dashboard/:id"
          element={
          isAuthenticated 
            ? <DashboardDetail user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
        <Route
            path="/dashboard/:id/sheet/:sheetId"
            element={
          isAuthenticated 
            ? <CanvasPage user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
       <Route
            path="/tasks"
            element={
          isAuthenticated 
            ? <TaskApp user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
        <Route
            path="/tasks/create"
            element={
          isAuthenticated 
            ? <CreateTaskPage user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
      </Routes> 
      </EditModeProvider>
    </div>
  );
};

export default App;