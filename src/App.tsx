import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import CommandTypeChoice from './pages/CommandTypeChoice';
import SituationInput from './pages/SituationInput';
import Results from './pages/Results';
import OperationalZoning from './pages/OperationalZoning';
import OperationalFunctions from './pages/OperationalFunctions';
import SettingsPage from './pages/Settings';
import OctDiagram from './pages/OctDiagram';
import JoinIntervention from './pages/JoinIntervention';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
import LoginPage from './pages/Login';
import RequireAuth from './components/RequireAuth';
import { APP_VERSION } from './version';
import Onboarding from './pages/Onboarding';

// DEV-only page
import SupabaseDev from './pages/SupabaseDev';

const DictationInput = React.lazy(() => import('./pages/DictationInput'));
const SitacMap = React.lazy(() => import('./pages/SitacMap'));

function App() {
  React.useEffect(() => {
    document.title = `ATLAS - ${APP_VERSION}`;
  }, []);

  return (
    <HashRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join" element={<JoinIntervention />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
          <Route index element={<Home />} />
          <Route path="index.html" element={<Navigate to="/" replace />} />
          <Route path="onboarding" element={<Onboarding />} />

            {/* DEV-only route (protected) */}
            {import.meta.env.DEV && (
              <Route path="dev/supabase" element={<SupabaseDev />} />
            )}

            <Route path="functions" element={<OperationalFunctions />} />
            <Route path="command-type/:type" element={<CommandTypeChoice />} />
            <Route path="situation/:type/ai" element={<SituationInput />} />
            <Route
              path="situation/:type/dictate"
              element={(
                <React.Suspense fallback={null}>
                  <DictationInput />
                </React.Suspense>
              )}
            />
            <Route path="results" element={<Results />} />
            <Route path="operational-zoning" element={<OperationalZoning />} />
            <Route
              path="sitac"
              element={(
                <React.Suspense fallback={null}>
                  <SitacMap />
                </React.Suspense>
              )}
            />
            <Route path="oct" element={<OctDiagram />} />
            <Route path="settings" element={<SettingsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppErrorBoundary>
    </HashRouter>
  );
}

export default App;
