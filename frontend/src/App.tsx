import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from './store';
import { setPublicView, checkAuthStatus } from './store/authSlice';
import { Navbar } from './components/Navbar';
import { LoginPage } from './views/LoginPage';
import { TrainingCentreView } from './views/TrainingCentreView';
import { DistrictOfficerView } from './views/DistrictOfficerView';
import { QualityOfficerView } from './views/QualityOfficerView';
import { StateOfficeView } from './views/StateOfficeView';
import { PublicVerificationView } from './views/PublicVerificationView';
import { CertificatesRegistryView } from './views/CertificatesRegistryView';

export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { activePersona, isAuthenticated, loading } = useSelector((state: RootState) => state.auth);
  const [currentTab, setCurrentTab] = useState<'portal' | 'registry'>('portal');

  // Restore session from cookie / token on page mount / refresh
  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // If verifying authentication on initial page load, show lightweight loading screen
  if (loading && !activePersona) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  // If not authenticated and no active persona selected, render the official Sign In page
  if (!isAuthenticated || !activePersona) {
    return <LoginPage onPublicVerifyClick={() => dispatch(setPublicView())} />;
  }

  const renderActiveView = () => {
    if (currentTab === 'registry') {
      return <CertificatesRegistryView />;
    }

    switch (activePersona.role) {
      case 'TRAINING_CENTRE':
        return <TrainingCentreView />;
      case 'DISTRICT_OFFICER':
        return <DistrictOfficerView />;
      case 'QUALITY_OFFICER':
        return <QualityOfficerView />;
      case 'STATE_OFFICE':
        return <StateOfficeView />;
      case 'PUBLIC':
      default:
        return <PublicVerificationView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveView()}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Pragati Skills Mission • CertiFlow Skilling Issuance & Verification Platform
      </footer>
    </div>
  );
};

export default App;
