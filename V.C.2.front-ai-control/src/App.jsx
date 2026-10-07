import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { EditModeProvider } from './context/EditModeContext';
import { AuthModalProvider, useAuthModal } from './context/AuthModalContext';
import LoadingPage from './components/LoadingPage';
import styles from './App.module.css';
import { useAuth } from './context/AuthContext';
import { MMM_OPEN_DIRECT_EVENT } from './services/messagingNavigation';
import MessagingGlobalHost from './components/messaging/MessagingGlobalHost';
import { isEmbeddedPath, isEmbeddedShell } from './utils/embeddedShell';
import { useDocumentTitle, useDocumentTitleBadge } from './hooks/useDocumentTitle';
import { useMessagingAlerts } from './context/MessagingAlertsContext';
import { getRouteTitle } from './utils/routeTitles';
/* Critical landing chrome: eager so first paint does not depend on Suspense chunks. */
import Header from './pages/main_page/Header';
import Hero from './pages/main_page/Hero';

const ProfileHeader = lazy(() => import('./pages/profile/ProfileHeader'));
const ModernAuth = lazy(() => import('./components/auth/ModernAuth'));
const DashboardList = lazy(() => import('./pages/dashboard/DashboardList'));
const DashboardDetail = lazy(() => import('./pages/dashboard/DashboardDetail'));
const FlowManagementPage = lazy(() => import('./pages/dashboard/FlowManagementPage'));
const FlowDashboardsPage = lazy(() => import('./pages/dashboard/FlowDashboardsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const EmbedDashboardWidgetPage = lazy(() => import('./pages/profile/components/EmbedDashboardWidgetPage'));
const DataModelList = lazy(() => import('./pages/data_models/DataModelList'));
const CreateDataModel = lazy(() => import('./pages/data_models/CreateDataModel'));
const DataModelDetail = lazy(() => import('./pages/data_models/DataModelDetail'));
const DashboardCreaterApp = lazy(() => import('./pages/dashboard_creater/DashboardCreaterApp'));
const TaskApp = lazy(() => import('./pages/task_manager/TaskApp'));
const DataCodeEditorPage = lazy(() => import('./pages/datacode_editor/DataCodeEditorPage'));
const DataCodeDocsPage = lazy(() => import('./pages/datacode_docs/DataCodeDocsPage'));
const DeveloperApiDocsPage = lazy(() => import('./pages/developer_api_docs/DeveloperApiDocsPage'));
const SupportPage = lazy(() => import('./pages/support/SupportPage'));
const DocumentsApp = lazy(() => import('./pages/documents/DocumentsApp'));
const DocumentSharePage = lazy(() => import('./pages/documents/DocumentSharePage'));
const ShareDashboardSheetPage = lazy(() => import('./pages/share/ShareDashboardPages.jsx'));
const ShareDashboardEntryPage = lazy(() =>
  import('./pages/share/ShareDashboardPages.jsx').then((m) => ({ default: m.ShareDashboardEntryPage }))
);
const PricingPage = lazy(() => import('./pages/pricing/Pricing'));
const LegalPage = lazy(() => import('./pages/legal/LegalPage'));
const CookieConsentBanner = lazy(() => import('./pages/privacy/CookieConsentBanner'));

const InviteAcceptPage = lazy(() => import('./pages/invite/InviteAcceptPage'));
const PasswordResetAcceptPage = lazy(() => import('./pages/invite/PasswordResetAcceptPage'));
const CallPopoutPage = lazy(() => import('./components/calls/CallPopoutPage'));
const CallNavigationGuard = lazy(() => import('./components/calls/CallNavigationGuard'));

const AuthModalLazy = lazy(() => import('./components/auth/AuthModal'));

const routeFallback = <LoadingPage message="Загрузка..." />;

function authSessionPending(loading) {
  // Access token lives in memory; on cold boot we refresh via HttpOnly cookie while loading.
  return !!loading;
}

function DeferredAuthModal() {
  const { isOpen } = useAuthModal();
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <AuthModalLazy />
    </Suspense>
  );
}

const App = () => {
  const { user, loading, login, logout } = useAuth();
  const isAuthenticated = !!user;

  return (
    <Router>
      <AppContent
        user={user}
        isAuthenticated={isAuthenticated}
        authLoading={loading}
        login={login}
        logout={logout}
      />
    </Router>
  );
};

const AppContent = ({ user, isAuthenticated, authLoading, login, logout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const pending = authSessionPending(authLoading);

  // Базовый заголовок вкладки по маршруту; страницы уточняют его своим useDocumentTitle.
  useDocumentTitle(getRouteTitle(location.pathname));
  // «(3) …» — непрочитанные чаты и почта; видно даже из фоновой вкладки.
  const { unreadTotal } = useMessagingAlerts();
  useDocumentTitleBadge(isEmbeddedPath(location.pathname) || isEmbeddedShell() ? 0 : unreadTotal);

  useEffect(() => {
    const handler = (event) => {
      const userId = event.detail?.userId;
      if (!userId) return;
      const onProfile = location.pathname === '/profile' || location.pathname === '/profile/';
      if (!onProfile) {
        navigate('/profile', { state: { dmUserId: userId } });
      }
    };
    window.addEventListener(MMM_OPEN_DIRECT_EVENT, handler);
    return () => window.removeEventListener(MMM_OPEN_DIRECT_EVENT, handler);
  }, [location.pathname, navigate]);

  const isEmbedPage = isEmbeddedPath(location.pathname) || isEmbeddedShell();
  const isCallPopout =
    location.pathname === '/call' || location.pathname.startsWith('/call/');
  const isSharePage = location.pathname.startsWith('/share/');
  const isCanvasPage =
    isEmbedPage ||
    isCallPopout ||
    isSharePage ||
    (location.pathname.includes('/dashboard/') && location.pathname.includes('/sheet/'));
  const isInvitePage = location.pathname.startsWith('/invite/');
  const isPasswordResetPage = location.pathname.startsWith('/reset-password/');
  const isDocsPage =
    location.pathname === '/datacode-docs'
    || location.pathname.startsWith('/datacode-docs/')
    || location.pathname === '/developer-api-docs'
    || location.pathname.startsWith('/developer-api-docs/');
  const isProfilePage = location.pathname === '/profile' || location.pathname === '/profile/';
  const showSiteChrome =
    !isCanvasPage && !isInvitePage && !isPasswordResetPage && !isDocsPage;

  const guardAuth = (node) => {
    if (pending) return routeFallback;
    if (!isAuthenticated) return <Navigate to="/signin" />;
    return node;
  };

  // Pop-out call window: render outside <Routes> so matching quirks / stale bundles
  // cannot leave a blank page with "No routes matched".
  if (isCallPopout) {
    return (
      <div className={styles.app}>
        <Suspense fallback={routeFallback}>{guardAuth(<CallPopoutPage />)}</Suspense>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <EditModeProvider>
        <AuthModalProvider>
          {showSiteChrome &&
            (isProfilePage ? (
              <Suspense fallback={null}>
                <ProfileHeader isAuthenticated={isAuthenticated} />
              </Suspense>
            ) : (
              <Header isAuthenticated={isAuthenticated} />
            ))}
          <DeferredAuthModal />
          {isAuthenticated && !isEmbedPage ? (
            <>
              <MessagingGlobalHost />
              <Suspense fallback={null}>
                <CallNavigationGuard />
              </Suspense>
            </>
          ) : null}
          <Suspense fallback={routeFallback}>
            <Routes>
              <Route path="/" element={<Hero />} />
              <Route
                path="/dashboard"
                element={guardAuth(<DashboardList user={user} onLogout={logout} />)}
              />

              <Route
                path="/signin"
                element={
                  pending ? (
                    routeFallback
                  ) : isAuthenticated ? (
                    <Navigate to="/profile" />
                  ) : (
                    <ModernAuth login={login} />
                  )
                }
              />
              <Route
                path="/signup"
                element={pending ? routeFallback : <ModernAuth login={login} />}
              />
              <Route path="/login" element={<Navigate to="/signin" replace />} />

              <Route path="/share/:token" element={<ShareDashboardEntryPage />} />
              <Route path="/share/:token/sheet/:sheetId" element={<ShareDashboardSheetPage />} />
              <Route path="/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/reset-password/:token" element={<PasswordResetAcceptPage />} />

              <Route
                path="/profile"
                element={guardAuth(<ProfilePage user={user} onLogout={logout} />)}
              />
              {/* Kept for deep-links; popout also short-circuits above. */}
              <Route path="/call" element={guardAuth(<CallPopoutPage />)} />
              <Route path="/call/*" element={guardAuth(<CallPopoutPage />)} />
              <Route
                path="/embed/dashboard-widget"
                element={
                  pending ? (
                    routeFallback
                  ) : isAuthenticated ? (
                    <EmbedDashboardWidgetPage />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        color: '#94a3b8',
                        background: '#0f1014',
                        fontFamily: 'sans-serif',
                        padding: 16,
                        textAlign: 'center',
                      }}
                    >
                      Нужна авторизация
                    </div>
                  )
                }
              />

              <Route
                path="/dashboard/flows"
                element={guardAuth(<FlowManagementPage user={user} onLogout={logout} />)}
              />
              <Route
                path="/flows/:flowId"
                element={guardAuth(<FlowDashboardsPage user={user} onLogout={logout} />)}
              />
              <Route
                path="/flows"
                element={guardAuth(<FlowDashboardsPage user={user} onLogout={logout} />)}
              />
              <Route
                path="/dashboard/:id"
                element={guardAuth(<DashboardDetail user={user} onLogout={logout} />)}
              />
              <Route
                path="/dashboard/:id/sheet/:sheetId"
                element={guardAuth(<DashboardCreaterApp user={user} onLogout={logout} />)}
              />
              <Route
                path="/tasks"
                element={guardAuth(<TaskApp user={user} onLogout={logout} />)}
              />

              <Route path="/support" element={guardAuth(<SupportPage />)} />

              <Route
                path="/documents"
                element={guardAuth(<DocumentsApp />)}
              />
              <Route
                path="/documents/share/:token"
                element={guardAuth(<DocumentSharePage />)}
              />

              <Route
                path="/data-models"
                element={guardAuth(
                  <DataModelList key="data-models" user={user} onLogout={logout} />
                )}
              />

              <Route
                path="/data-models/create"
                element={guardAuth(
                  <CreateDataModel key="data-models-create" user={user} onLogout={logout} />
                )}
              />

              <Route
                path="/data-models/:id"
                element={guardAuth(
                  <DataModelDetail key="data-models-detail" user={user} onLogout={logout} />
                )}
              />

              <Route
                path="/data-models/:id/edit"
                element={guardAuth(
                  <CreateDataModel key="data-models-edit" user={user} onLogout={logout} />
                )}
              />

              <Route
                path="/datacode-editor"
                element={guardAuth(<DataCodeEditorPage />)}
              />

              <Route path="/datacode-docs" element={<DataCodeDocsPage />} />
              <Route path="/datacode-docs/" element={<DataCodeDocsPage />} />
              {/* Static file is served by Vite/nginx; do not SPA-redirect index.html */}
              <Route path="/developer-api-docs" element={<DeveloperApiDocsPage />} />

              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/pricing/" element={<PricingPage />} />

              <Route path="/legal" element={<Navigate to="/legal/privacy" replace />} />
              <Route path="/legal/" element={<Navigate to="/legal/privacy" replace />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
            </Routes>
          </Suspense>
          <Suspense fallback={null}>
            <CookieConsentBanner />
          </Suspense>
        </AuthModalProvider>
      </EditModeProvider>
    </div>
  );
};

export default App;
