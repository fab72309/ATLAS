import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import CommandTypeChoice from './pages/CommandTypeChoice';
import SituationInput from './pages/SituationInput';
import DictationInput from './pages/DictationInput';
import Results from './pages/Results';
import OperationalZoning from './pages/OperationalZoning';
import OperationalFunctions from './pages/OperationalFunctions';
import SitacMap from './pages/SitacMap';
import SettingsPage from './pages/Settings';
import OctDiagram from './pages/OctDiagram';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
import LoginPage from './pages/Login';
import RequireAuth from './components/RequireAuth';

function App() {
  return (
    <HashRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
      </AppErrorBoundary>
    </HashRouter>
  );
}

export default App;
