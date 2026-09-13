import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { TiffinsPage } from './pages/TiffinsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { BillsPage } from './pages/BillsPage';
import { RentPage } from './pages/RentPage';

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();
  // Default to 'tiffins' (Home)
  const [currentTab, setCurrentTab] = useState<string>('tiffins');

  // If no profile is authenticated/configured, show the setup screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 pb-12">
        {currentTab === 'tiffins' && <TiffinsPage />}
        {currentTab === 'payments' && <PaymentsPage />}
        {currentTab === 'bills' && <BillsPage />}
        {currentTab === 'rent' && <RentPage />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SyncProvider>
        <AppContent />
      </SyncProvider>
    </AuthProvider>
  );
};

export default App;
