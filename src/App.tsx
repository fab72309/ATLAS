import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React, { Suspense } from 'react';
const Home = React.lazy(() => import('./pages/Home'));
const CommandTypeChoice = React.lazy(() => import('./pages/CommandTypeChoice'));
const SituationInput = React.lazy(() => import('./pages/SituationInput'));
const DictationInput = React.lazy(() => import('./pages/DictationInput'));
const Results = React.lazy(() => import('./pages/Results'));
const OperationalZoning = React.lazy(() => import('./pages/OperationalZoning'));
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="text-white p-4">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="command-type/:type" element={<CommandTypeChoice />} />
            <Route path="situation/:type/ai" element={<SituationInput />} />
            <Route path="situation/:type/dictate" element={<DictationInput />} />
            <Route path="results" element={<Results />} />
            <Route path="operational-zoning" element={<OperationalZoning />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;