import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/main_page/Header';
import { EditModeProvider } from './context/EditModeContext';
import DashboardHeader from './pages/dashboard/DashboardHeader';
import ProfileHeader from './pages/profile/ProfileHeader';
import Hero from './components/main_page/Hero';
import Auth from './components/auth/Auth';
import DashboardList from './pages/dashboard/DashboardList';
import DashboardDetail from './pages/dashboard/DashboardDetail';
import ProfilePage from './pages/profile/ProfilePage';
// import PrivateRoute from './components/PrivateRoute';
import CanvasPage from './pages/canvas/CanvasApp';
import TaskApp from './pages/taskManager/TaskApp';
import Teams from './pages/teams/Teams';
import Projects from './pages/projects/Projects';
import styles from './App.module.css';
import useAuth from './hooks/useAuth';
import spinner from './assets/pageload-spinner.gif';
import logo from './assets/logo.png';

const FullPageSpinner = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-700 to-green-1000">
    <div className="flex flex-col items-center">
      <img 
        src={logo} 
        alt="AI Trading Logo" 
        className="w-40 h-auto"
      />
      <p className="mt-4 text-xl text-blue-200 font-semibold">
        Loading...
      </p>
    </div>
  </div>
);

const App = () => {

  const { user, isAuthenticated, loading, login, logout } = useAuth();

  if (loading) {
    return <FullPageSpinner />;
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
            ? <Navigate to="/profile" /> : <Auth login={login} />} />
        <Route path="/signup" element={<Auth login={login} />} />

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
            path="/teams"
            element={
          isAuthenticated 
            ? <Teams user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
       <Route
            path="/projects"
            element={
          isAuthenticated 
            ? <Projects user={user} onLogout={logout} /> 
            : <Navigate to="/signin" />
        } />
      </Routes> 
      </EditModeProvider>
    </div>
  );
};

export default App;