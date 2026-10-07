import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import './styles/mobile-shell.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { MessagingAlertsProvider } from './context/MessagingAlertsContext.jsx';
import { CallSessionProvider } from './context/CallSessionContext.jsx';
import { ProfileWidgetsProvider } from './context/ProfileWidgetsContext.jsx';

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <AuthProvider>
      <MessagingAlertsProvider>
        <CallSessionProvider>
          <ProfileWidgetsProvider>
            <App />
          </ProfileWidgetsProvider>
        </CallSessionProvider>
      </MessagingAlertsProvider>
    </AuthProvider>
  </StrictMode>
);