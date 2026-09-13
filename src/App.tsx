import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { TiffinsPage } from './pages/TiffinsPage';
import { TiffinLogPage } from './pages/TiffinLogPage';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 pb-12">
        {currentTab === 'tiffins' && <TiffinsPage onTabChange={setCurrentTab} />}
        {currentTab === 'tiffin-log' && (
          currentUser.role === 'owner' ? (
            <TiffinLogPage onTabChange={setCurrentTab} />
          ) : (
            <TiffinsPage onTabChange={setCurrentTab} />
          )
        )}
        {currentTab === 'bills' && <BillsPage />}
        {currentTab === 'rent' && <RentPage />}
        {currentTab === 'payments' && <PaymentsPage />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <AppContent />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
