import { useState } from 'react';
import { UploadWizard } from './components/UploadWizard';
import { ReplenishmentDashboard } from './components/ReplenishmentDashboard';
import { SKUMappingTable } from './components/SKUMappingTable';
import { Database, type PurchaseOrder, type Supplier } from './utils/db';
import { Play, ClipboardList, Database as DBIcon, RefreshCw, CheckCircle } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'autopilot' | 'masterdata' | 'history'>('autopilot');
  const [uploadedStocks, setUploadedStocks] = useState<Record<string, number> | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sentOrders, setSentOrders] = useState<PurchaseOrder[]>(
    Database.getPurchaseOrders().filter(o => o.status !== 'draft')
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(Database.getSuppliers());

  const handleUploadComplete = (stocks: Record<string, number>) => {
    setUploadedStocks(stocks);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleClearUpload = () => {
    setUploadedStocks(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    setSentOrders(Database.getPurchaseOrders().filter(o => o.status !== 'draft'));
    setSuppliers(Database.getSuppliers());
  };

  const handleResetDB = () => {
    if (confirm("Sei sicuro di voler ripristinare tutti i dati dell'applicazione? Verranno ricaricati gli SKU ed i fornitori predefiniti di esempio.")) {
      Database.resetDB();
      handleClearUpload();
      handleRefresh();
    }
  };

  const tenant = Database.getTenant();

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">P</div>
          <span className="brand-name">Previso</span>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="nav-list">
            <li className={`nav-item ${activeTab === 'autopilot' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('autopilot')}>
                <Play size={18} />
                Autopilot
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'masterdata' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('masterdata')}>
                <DBIcon size={18} />
                Anagrafica
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('history')}>
                <ClipboardList size={18} />
                Registro Ordini
              </button>
            </li>
          </ul>
        </nav>

        {/* Sidebar Footer settings */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>OPERATORE</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>Responsabile Acquisti</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tenant.companyName}</span>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handleResetDB}
            style={{ fontSize: '12px', padding: '6px 12px', justifyContent: 'center', width: '100%' }}
          >
            Ripristina Dati
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Dynamic Header */}
        <header className="header-group">
          <div className="header-info">
            <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Autopilot Replenishment Platform
            </span>
            <h1>{activeTab === 'autopilot' ? 'Pannello di Riordino' : activeTab === 'masterdata' ? 'Anagrafica Master' : 'Registro Storico Ordini'}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>{tenant.companyName}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>P.IVA: {tenant.vatNumber}</span>
            </div>
            <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-light)' }}></div>
            <button className="btn btn-secondary" onClick={handleRefresh} style={{ padding: '8px' }}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* Tab Selection Content */}
        {activeTab === 'autopilot' && (
          <>
            {/* Upload CSV Wizard */}
            <UploadWizard onUploadComplete={handleUploadComplete} />

            {/* Replenishment Calculations & Draft PO reviews */}
            <ReplenishmentDashboard 
              uploadedStocks={uploadedStocks} 
              onClearUpload={handleClearUpload}
              refreshTrigger={refreshTrigger}
              onRefresh={handleRefresh}
            />
          </>
        )}

        {activeTab === 'masterdata' && (
          <SKUMappingTable onRefresh={handleRefresh} />
        )}

        {activeTab === 'history' && (
          <div className="card">
            <h3 style={{ marginBottom: '20px' }}>Ordini Inviati & Approvati</h3>
            {sentOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4px 0', color: 'var(--text-secondary)' }}>
                <ClipboardList size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
                <p>Nessun ordine presente nel registro storico.</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Invia un ordine dalla sezione Autopilot per vederlo comparire qui.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID Ordine</th>
                      <th>Fornitore</th>
                      <th>Data Invio</th>
                      <th>Totale (€)</th>
                      <th>Stato Invio</th>
                      <th>Destinatario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentOrders.map(o => {
                      const supp = suppliers.find(s => s.id === o.supplierId);
                      return (
                        <tr key={o.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{o.id.toUpperCase()}</td>
                          <td>{supp ? supp.name : 'Sconosciuto'}</td>
                          <td>{o.sentAt ? new Date(o.sentAt).toLocaleString('it-IT') : '-'}</td>
                          <td style={{ fontWeight: '600' }}>€ {o.totalAmount.toFixed(2)}</td>
                          <td>
                            <span className="badge badge-success">
                              <CheckCircle size={12} style={{ marginRight: '4px' }} />
                              Inviato via Email
                            </span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{supp?.email}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
