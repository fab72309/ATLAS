import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import ProtectedRoute from './auth/ProtectedRoute';
import Login from './pages/Login';

const Layout = React.lazy(() => import('./components/Layout'));
const Home = React.lazy(() => import('./pages/Home'));
const CommandTypeChoice = React.lazy(() => import('./pages/CommandTypeChoice'));
const SituationInput = React.lazy(() => import('./pages/SituationInput'));
const DictationInput = React.lazy(() => import('./pages/DictationInput'));
const Results = React.lazy(() => import('./pages/Results'));
const OperationalZoning = React.lazy(() => import('./pages/OperationalZoning'));
const OperationalFunctions = React.lazy(() => import('./pages/OperationalFunctions'));
const SitacMap = React.lazy(() => import('./pages/SitacMap'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const OctDiagram = React.lazy(() => import('./pages/OctDiagram'));

function App() {
  return (
    <HashRouter>
      <AppErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white bg-black">Chargement...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={(
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              )}
            >
              <Route index element={<Home />} />
              <Route path="index.html" element={<Navigate to="/" replace />} />
              <Route path="functions" element={<OperationalFunctions />} />
              <Route path="command-type/:type" element={<CommandTypeChoice />} />
              <Route path="situation/:type/ai" element={<SituationInput />} />
              <Route path="situation/:type/dictate" element={<DictationInput />} />
              <Route path="results" element={<Results />} />
              <Route path="operational-zoning" element={<OperationalZoning />} />
              <Route path="sitac" element={<SitacMap />} />
              <Route path="oct" element={<OctDiagram />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </HashRouter>
  );
}

export default App;
