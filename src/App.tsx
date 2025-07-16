import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CommandTypeChoice from './pages/CommandTypeChoice';
import SituationInput from './pages/SituationInput';
import DictationInput from './pages/DictationInput';
import Results from './pages/Results';
import OperationalZoning from './pages/OperationalZoning';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;