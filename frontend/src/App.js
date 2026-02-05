import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Login } from '@/pages/Login';
import { HQDashboard } from '@/pages/HQDashboard';
import { PatrolCommander } from '@/pages/PatrolCommander';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { TestMap } from '@/pages/TestMap';
import '@/App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('hq_token');
  return token ? children : <Navigate to="/" replace />;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const isSuperAdmin = localStorage.getItem('is_super_admin') === 'true';
  return isSuperAdmin ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/test-map" element={<TestMap />} />
          <Route path="/hq" element={<HQDashboard />} />
          <Route path="/patrol" element={<PatrolCommander />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;