import { useState } from 'react';
import { Wizard, DEFAULT_WIZARD_DATA, type WizardData } from './components/Wizard';
import { Results } from './components/Results';
import { useStickyState } from './components/useStickyState';

function App() {
  const [wizardData, setWizardData] = useStickyState<WizardData>(DEFAULT_WIZARD_DATA, 'retirement_wizard_data');
  const [isComplete, setIsComplete] = useState(false);

  // If the wizard was previously "completed" (e.g. step 5, or a flag), we could auto-show results.
  // For now, simple state.

  if (isComplete) {
    return <Results initialData={wizardData} onReset={() => {
        setWizardData(DEFAULT_WIZARD_DATA);
        setIsComplete(false);
    }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-blue-900">Retirement Planner</h1>
        </div>
      </header>

      <main className="flex-grow">
        <Wizard
          data={wizardData}
          setData={setWizardData}
          onComplete={() => setIsComplete(true)}
        />
      </main>

      <footer className="p-4 text-center text-gray-400 text-sm">
        <p>Disclaimer: This is a simplified educational tool. Not financial advice. Data based on 2024/2025 estimates.</p>
      </footer>
    </div>
  );
}

export default App;
