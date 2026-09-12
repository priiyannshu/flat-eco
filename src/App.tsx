import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { Navbar } from './components/Navbar';
import { TiffinsPage } from './pages/TiffinsPage';
import { RentPage } from './pages/RentPage';
import { BillsPage } from './pages/BillsPage';
import { LedgerPage } from './pages/LedgerPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { DevPage } from './pages/DevPage';

export const App: React.FC = () => {
  // Default to 'tiffins' as it's the daily heart of the app
  const [currentTab, setCurrentTab] = useState<string>('tiffins');

  return (
    <AuthProvider>
      <SyncProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

          <main className="flex-1">
            {currentTab === 'tiffins' && <TiffinsPage />}
            {currentTab === 'rent' && <RentPage />}
            {currentTab === 'bills' && <BillsPage />}
            {currentTab === 'ledger' && <LedgerPage />}
            {currentTab === 'receipts' && <ReceiptsPage />}
            {currentTab === 'dev' && <DevPage />}
          </main>
        </div>
      </SyncProvider>
    </AuthProvider>
  );
};

export default App;
