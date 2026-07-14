import React, { useState, useEffect } from 'react';
import { Mail, FileText, CheckCircle, Trash2, ArrowRight, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { Database, type PurchaseOrder, type Supplier, type Tenant } from '../utils/db';
import { generatePOPDF } from '../utils/pdf';

interface ReplenishmentDashboardProps {
  uploadedStocks: Record<string, number> | null;
  onClearUpload: () => void;
  refreshTrigger: number;
  onRefresh: () => void;
}

export const ReplenishmentDashboard: React.FC<ReplenishmentDashboardProps> = ({
  uploadedStocks,
  onClearUpload,
  refreshTrigger,
  onRefresh,
}) => {
  const [proposals, setProposals] = useState<any[]>([]);
  const [draftPOs, setDraftPOs] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tenant, setTenant] = useState<Tenant>(Database.getTenant());
  
  // Modal state for sending email
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [emailForm, setEmailForm] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const activeSuppliers = Database.getSuppliers();
    setSuppliers(activeSuppliers);
    setTenant(Database.getTenant());

    // Calculate replenishment based on upload stocks (if any) or database stocks
    const calculated = Database.calculateReplenishment(uploadedStocks || {});
    setProposals(calculated);

    // Filter purchase orders in draft state
    const pos = Database.getPurchaseOrders().filter(o => o.status === 'draft');
    setDraftPOs(pos);
  };

  useEffect(() => {
    loadData();
  }, [uploadedStocks, refreshTrigger]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Generate draft POs from current replenishment recommendations
  const handleCreateDraftPOs = () => {
    const generated = Database.generateDraftOrders(proposals);
    if (generated.length > 0) {
      triggerToast(`Generati con successo ${generated.length} ordini in bozza.`);
      onClearUpload(); // Clear current upload wizard layout once drafted
      onRefresh();
    } else {
      triggerToast("Nessun articolo sotto scorta necessita di riordino al momento.");
    }
  };

  const handleOpenEmailModal = (po: PurchaseOrder) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    if (!supplier) return;

    setSelectedPO(po);
    setEmailForm({
      to: supplier.email,
      cc: 'acquisti@manifatturarossi.it',
      subject: `[Ordine d'Acquisto Previso] Ordine N. ${po.id.toUpperCase()} - ${tenant.companyName}`,
      body: `Spettabile ${supplier.name},\n\nIn allegato trasmettiamo il nostro Ordine d'Acquisto N. ${po.id.toUpperCase()} relativo ai materiali indicati.\n\nVi preghiamo di prenderne visione e confermare via email la data di consegna prevista.\n\nCordiali saluti,\nResponsabile Acquisti - ${tenant.companyName}`,
    });
  };

  const handleExportPDF = (po: PurchaseOrder) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    if (!supplier) return;
    
    const doc = generatePOPDF(po, supplier, tenant);
    doc.save(`Ordine_Acquisto_${po.id.toUpperCase()}_${supplier.name.replace(/\s+/g, '_')}.pdf`);
    triggerToast(`PDF dell'ordine ${po.id.toUpperCase()} scaricato.`);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    setIsSending(true);

    // Simulate Resend dispatch delay
    setTimeout(() => {
      const orders = Database.getPurchaseOrders();
      const idx = orders.findIndex(o => o.id === selectedPO.id);
      if (idx !== -1) {
        orders[idx].status = 'sent';
        orders[idx].sentAt = new Date().toISOString();
        Database.savePurchaseOrders(orders);
      }

      // Apply stock level update if orders were sent out
      if (selectedPO.items) {
        // In a real database, we would track this on-order state.
        // We already do this because on_order_stock maps sent orders.
      }

      setIsSending(false);
      setSelectedPO(null);
      triggerToast(`Ordine inviato con successo a: ${emailForm.to}`);
      onRefresh();
    }, 1500);
  };

  const handleDeleteDraft = (id: string) => {
    const orders = Database.getPurchaseOrders().filter(o => o.id !== id);
    Database.savePurchaseOrders(orders);
    triggerToast("Bozza ordine eliminata.");
    onRefresh();
  };

  // Metrics
  const itemsUnderScorta = proposals.filter(p => p.currentStock <= p.minStock).length;
  const totalDraftAmount = draftPOs.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <CheckCircle size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Overview Metrics Cards */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Articoli Sotto Scorta</span>
          <span className="metric-val" style={{ color: itemsUnderScorta > 0 ? '#fbbf24' : 'var(--text-primary)' }}>
            {itemsUnderScorta}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Richiedono attenzione</span>
        </div>

        <div className="card metric-card">
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bozze in Elaborazione</span>
          <span className="metric-val">{draftPOs.length}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ordini pronti all'invio</span>
        </div>

        <div className="card metric-card">
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Valore Bozze Totale</span>
          <span className="metric-val" style={{ color: 'var(--accent-secondary)' }}>
            € {totalDraftAmount.toFixed(2)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fatturato di acquisto previsto</span>
        </div>
      </div>

      {/* Main calculation section for newly uploaded stock levels */}
      {uploadedStocks && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)' }}>
          <div className="header-group" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} style={{ color: '#fbbf24' }} />
              <div>
                <h3>Analisi Giacenze & Proposta di Riordino</h3>
                <p>Ecco gli articoli calcolati sotto le soglie di sicurezza min-max</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={onClearUpload}>
                Annulla Caricamento
              </button>
              <button className="btn btn-primary" onClick={handleCreateDraftPOs}>
                Crea Bozze d'Acquisto
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Giacenza Attuale</th>
                  <th>In Arrivo (On Order)</th>
                  <th>Soglia Min.</th>
                  <th>Scorta Target</th>
                  <th>Lotto MOQ</th>
                  <th>Riordino Proposto</th>
                  <th>Costo Previsto</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map(p => {
                  const needsReorder = p.suggestedQty > 0;
                  return (
                    <tr key={p.skuId} style={{ backgroundColor: needsReorder ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.code}</td>
                      <td style={{ fontSize: '13px' }}>{p.description}</td>
                      <td>{p.currentStock}</td>
                      <td>{p.onOrderStock > 0 ? (
                        <span className="badge badge-info">{p.onOrderStock} in arrivo</span>
                      ) : '0'}</td>
                      <td>{p.minStock}</td>
                      <td>{p.maxStock}</td>
                      <td>{p.lotSizeMOQ}</td>
                      <td style={{ fontWeight: '700', color: needsReorder ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                        {needsReorder ? p.suggestedQty : '0'}
                      </td>
                      <td>
                        {needsReorder ? `€ ${(p.suggestedQty * p.unitCost).toFixed(2)}` : '€ 0.00'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Draft Purchase Orders list */}
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Ordini d'Acquisto in Bozza (Draft POs)</h3>
        {draftPOs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            <FileText size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
            <p>Nessun ordine in bozza pronto per l'invio.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Carica un file di magazzino in alto per generare le proposte di riordino.</p>
          </div>
        ) : (
          draftPOs.map(po => {
            const supplier = suppliers.find(s => s.id === po.supplierId);
            return (
              <div key={po.id} className="supplier-po-section">
                <div className="supplier-po-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h4 style={{ fontSize: '16px' }}>Ordine per: {supplier ? supplier.name : 'Sconosciuto'}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Destinatario: {supplier?.email} | Pagamento: {supplier?.paymentTerms}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-danger" onClick={() => handleDeleteDraft(po.id)} style={{ padding: '8px 12px' }}>
                      <Trash2 size={16} />
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleExportPDF(po)}>
                      <FileText size={16} />
                      Scarica PDF
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenEmailModal(po)}>
                      <Mail size={16} />
                      Invia Autopilot
                    </button>
                  </div>
                </div>

                <div className="table-container" style={{ marginTop: 0 }}>
                  <table className="data-table" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 24px' }}>Codice SKU</th>
                        <th style={{ padding: '12px 24px' }}>Descrizione</th>
                        <th style={{ padding: '12px 24px' }}>Quantità Ordine</th>
                        <th style={{ padding: '12px 24px' }}>Costo Unitario</th>
                        <th style={{ padding: '12px 24px' }}>Totale Riga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items?.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', padding: '12px 24px' }}>{item.skuCode}</td>
                          <td style={{ fontSize: '13px', padding: '12px 24px' }}>
                            {proposals.find(p => p.code === item.skuCode)?.description || 'Articolo di magazzino'}
                          </td>
                          <td style={{ fontWeight: '600', padding: '12px 24px' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 24px' }}>€ {item.unitCost.toFixed(2)}</td>
                          <td style={{ padding: '12px 24px' }}>€ {(item.quantity * item.unitCost).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <td colSpan={3}></td>
                        <td style={{ fontWeight: '700', padding: '12px 24px' }}>TOTALE ORDINE:</td>
                        <td style={{ fontWeight: '700', color: 'var(--accent-primary)', padding: '12px 24px' }}>
                          € {po.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Email Dispatch Modal */}
      {selectedPO && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Autopilot: Invio Ordine d'Acquisto</h3>
              <button className="btn btn-secondary" onClick={() => setSelectedPO(null)} style={{ padding: '6px' }}>X</button>
            </div>
            
            <form onSubmit={handleSendEmail}>
              <div className="modal-body">
                <div className="form-group">
                  <label>A (Email Fornitore)*</label>
                  <input 
                    type="email" 
                    required 
                    value={emailForm.to}
                    onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>CC (Copia all'Operatore)</label>
                  <input 
                    type="email" 
                    value={emailForm.cc}
                    onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Oggetto Email*</label>
                  <input 
                    type="text" 
                    required 
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Corpo del Messaggio*</label>
                  <textarea 
                    rows={6}
                    required
                    value={emailForm.body}
                    onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                    style={{
                      backgroundColor: '#12141d',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>

                <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <FileText style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Allegato PDF</span>
                    <p style={{ fontSize: '11px' }}>Ordine_Acquisto_{selectedPO.id.toUpperCase()}.pdf (~12KB)</p>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPO(null)} disabled={isSending}>
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSending}>
                  {isSending ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Invia Ordine
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
