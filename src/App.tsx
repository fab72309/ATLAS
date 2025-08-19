import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
const Home = React.lazy(() => import('./pages/Home'));
const CommandTypeChoice = React.lazy(() => import('./pages/CommandTypeChoice'));
const SituationInput = React.lazy(() => import('./pages/SituationInput'));
const DictationInput = React.lazy(() => import('./pages/DictationInput'));
const Results = React.lazy(() => import('./pages/Results'));
const OperationalZoning = React.lazy(() => import('./pages/OperationalZoning'));
const OperationalFunctions = React.lazy(() => import('./pages/OperationalFunctions'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="text-white p-4">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="functions" element={<OperationalFunctions />} />
            <Route path="command-type/:type" element={<CommandTypeChoice />} />
            <Route path="situation/:type/ai" element={<SituationInput />} />
            <Route path="situation/:type/dictate" element={<DictationInput />} />
            <Route path="results" element={<Results />} />
            <Route path="operational-zoning" element={<OperationalZoning />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;