import React, { useState } from 'react';
import { Plus, Download, Upload, PlusCircle, Check, AlertCircle } from 'lucide-react';
import { Database, type SKU, type Supplier } from '../utils/db';
import Papa from 'papaparse';

interface SKUMappingTableProps {
  onRefresh: () => void;
}

export const SKUMappingTable: React.FC<SKUMappingTableProps> = ({ onRefresh }) => {
  const [skus, setSkus] = useState<SKU[]>(Database.getSKUs());
  const [suppliers, setSuppliers] = useState<Supplier[]>(Database.getSuppliers());
  
  // Modals / forms state
  const [showAddSku, setShowAddSku] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  
  // New SKU form state
  const [newSku, setNewSku] = useState({
    code: '',
    description: '',
    supplierId: '',
    unitCost: 0,
    minStock: 0,
    maxStock: 0,
    lotSizeMOQ: 1,
    leadTimeDays: 5,
    currentStock: 0,
  });

  // New Supplier form state
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    paymentTerms: '',
  });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<SKU>>({});

  const refreshData = () => {
    setSkus(Database.getSKUs());
    setSuppliers(Database.getSuppliers());
    onRefresh();
  };

  const handleAddSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.code || !newSku.supplierId) return;

    Database.addSKU(newSku);
    setShowAddSku(false);
    setNewSku({
      code: '',
      description: '',
      supplierId: suppliers[0]?.id || '',
      unitCost: 0,
      minStock: 0,
      maxStock: 0,
      lotSizeMOQ: 1,
      leadTimeDays: 5,
      currentStock: 0,
    });
    refreshData();
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name || !newSupplier.email) return;

    Database.addSupplier(newSupplier);
    setShowAddSupplier(false);
    setNewSupplier({
      name: '',
      email: '',
      paymentTerms: '',
    });
    refreshData();
  };

  // Start inline editing
  const startEdit = (sku: SKU) => {
    setEditingId(sku.id);
    setEditValues({
      unitCost: sku.unitCost,
      minStock: sku.minStock,
      maxStock: sku.maxStock,
      lotSizeMOQ: sku.lotSizeMOQ,
      leadTimeDays: sku.leadTimeDays,
    });
  };

  // Save inline edit
  const saveEdit = (id: string) => {
    Database.updateSKU(id, editValues);
    setEditingId(null);
    refreshData();
  };

  // Export SKU Master Data to CSV
  const handleExportCSV = () => {
    const dataToExport = skus.map(s => {
      const supp = suppliers.find(sup => sup.id === s.supplierId);
      return {
        'Codice Articolo': s.code,
        'Descrizione': s.description,
        'Fornitore': supp ? supp.name : 'N/A',
        'Email Fornitore': supp ? supp.email : '',
        'Costo Unitario (€)': s.unitCost,
        'Scorta Minima': s.minStock,
        'Target Massimo': s.maxStock,
        'Lotto Minimo MOQ': s.lotSizeMOQ,
        'Lead Time (Giorni)': s.leadTimeDays,
        'Giacenza Attuale': s.currentStock,
      };
    });

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Previso_Anagrafica_MasterData.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload SKU Master Data from CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const currentSuppliers = Database.getSuppliers();
        const currentSKUs = Database.getSKUs();

        for (const row of results.data) {
          const code = row['Codice Articolo'] || row['code'] || row['SKU'];
          const supplierName = row['Fornitore'] || row['supplier'];
          const supplierEmail = row['Email Fornitore'] || row['email'];

          if (!code || !supplierName) continue;

          // Find or create supplier
          let supp = currentSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
          if (!supp && supplierEmail) {
            supp = Database.addSupplier({
              name: supplierName,
              email: supplierEmail,
              paymentTerms: row['Condizioni Pagamento'] || 'Standard',
            });
            currentSuppliers.push(supp);
          }

          const unitCost = parseFloat(row['Costo Unitario (€)'] || row['costo'] || row['cost'] || '0');
          const minStock = parseInt(row['Scorta Minima'] || row['min'] || '0', 10);
          const maxStock = parseInt(row['Target Massimo'] || row['max'] || '0', 10);
          const lotSizeMOQ = parseInt(row['Lotto Minimo MOQ'] || row['moq'] || '1', 10);
          const leadTimeDays = parseInt(row['Lead Time (Giorni)'] || row['lead_time'] || '5', 10);
          const currentStock = parseInt(row['Giacenza Attuale'] || row['stock'] || '0', 10);

          const skuData = {
            code,
            description: row['Descrizione'] || row['description'] || code,
            supplierId: supp ? supp.id : currentSuppliers[0]?.id || '',
            unitCost: isNaN(unitCost) ? 0 : unitCost,
            minStock: isNaN(minStock) ? 0 : minStock,
            maxStock: isNaN(maxStock) ? 0 : maxStock,
            lotSizeMOQ: isNaN(lotSizeMOQ) || lotSizeMOQ < 1 ? 1 : lotSizeMOQ,
            leadTimeDays: isNaN(leadTimeDays) ? 5 : leadTimeDays,
            currentStock: isNaN(currentStock) ? 0 : currentStock,
          };

          // Check if SKU exists to update or insert
          const existing = currentSKUs.find(s => s.code === code);
          if (existing) {
            Database.updateSKU(existing.id, skuData);
          } else {
            Database.addSKU(skuData);
          }
        }

        alert('Importazione anagrafica completata con successo!');
        refreshData();
      }
    });
  };

  return (
    <div className="card">
      <div className="header-group" style={{ marginBottom: '24px' }}>
        <div>
          <h3>Anagrafica Articoli & Fornitori</h3>
          <p>Definisci soglie di riordino min-max, lotti minimi e abbinamento SKU/fornitori</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            Esporta CSV
          </button>
          
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            Importa CSV
            <input 
              type="file" 
              onChange={handleImportCSV} 
              accept=".csv" 
              style={{ display: 'none' }}
            />
          </label>

          <button className="btn btn-secondary" onClick={() => setShowAddSupplier(true)}>
            <PlusCircle size={16} />
            Nuovo Fornitore
          </button>

          <button className="btn btn-primary" onClick={() => setShowAddSku(true)}>
            <Plus size={16} />
            Aggiungi SKU
          </button>
        </div>
      </div>

      {skus.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <AlertCircle size={36} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <p>Nessun articolo configurato nell'anagrafica.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Importa un file CSV o clicca su "Aggiungi SKU" per inserire il primo.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Codice (ERP)</th>
                <th>Descrizione</th>
                <th>Fornitore</th>
                <th>Costo Unit. (€)</th>
                <th>Scorta Min.</th>
                <th>Target Max.</th>
                <th>Lotto Min. (MOQ)</th>
                <th>Lead Time (gg)</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {skus.map(s => {
                const isEditing = editingId === s.id;
                const supplier = suppliers.find(sup => sup.id === s.supplierId);
                
                return (
                  <tr key={s.id} onClick={() => !isEditing && startEdit(s)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '500' }}>{s.code}</td>
                    <td style={{ fontSize: '13px' }}>{s.description}</td>
                    <td>{supplier ? supplier.name : 'Sconosciuto'}</td>
                    
                    {/* Cost Input */}
                    <td>
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="0.01"
                          value={editValues.unitCost || 0}
                          onChange={(e) => setEditValues({ ...editValues, unitCost: parseFloat(e.target.value) })}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                          autoFocus
                        />
                      ) : (
                        `€ ${s.unitCost.toFixed(2)}`
                      )}
                    </td>

                    {/* Min Stock */}
                    <td>
                      {isEditing ? (
                        <input 
                          type="number" 
                          value={editValues.minStock || 0}
                          onChange={(e) => setEditValues({ ...editValues, minStock: parseInt(e.target.value, 10) })}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                        />
                      ) : (
                        s.minStock
                      )}
                    </td>

                    {/* Max Stock */}
                    <td>
                      {isEditing ? (
                        <input 
                          type="number" 
                          value={editValues.maxStock || 0}
                          onChange={(e) => setEditValues({ ...editValues, maxStock: parseInt(e.target.value, 10) })}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                        />
                      ) : (
                        s.maxStock
                      )}
                    </td>

                    {/* MOQ Lot Size */}
                    <td>
                      {isEditing ? (
                        <input 
                          type="number" 
                          value={editValues.lotSizeMOQ || 1}
                          onChange={(e) => setEditValues({ ...editValues, lotSizeMOQ: parseInt(e.target.value, 10) })}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                        />
                      ) : (
                        s.lotSizeMOQ
                      )}
                    </td>

                    {/* Lead Time */}
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            value={editValues.leadTimeDays || 5}
                            onChange={(e) => setEditValues({ ...editValues, leadTimeDays: parseInt(e.target.value, 10) })}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                            style={{ width: '60px' }}
                          />
                          <button className="btn btn-primary" onClick={() => saveEdit(s.id)} style={{ padding: '4px', borderRadius: '4px' }}>
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        s.leadTimeDays
                      )}
                    </td>

                    <td>
                      {s.currentStock <= s.minStock ? (
                        <span className="badge badge-warning">Sotto Scorta ({s.currentStock})</span>
                      ) : (
                        <span className="badge badge-success">OK ({s.currentStock})</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add SKU Modal */}
      {showAddSku && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configura Nuovo SKU</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddSku(false)} style={{ padding: '6px' }}>X</button>
            </div>
            <form onSubmit={handleAddSku}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Codice Articolo ERP (SKU)*</label>
                  <input 
                    type="text" 
                    required 
                    value={newSku.code}
                    onChange={(e) => setNewSku({ ...newSku, code: e.target.value.toUpperCase() })}
                    placeholder="E.g., BULLONE-M8-ZINCAT"
                  />
                </div>
                <div className="form-group">
                  <label>Descrizione Articolo</label>
                  <input 
                    type="text" 
                    value={newSku.description}
                    onChange={(e) => setNewSku({ ...newSku, description: e.target.value })}
                    placeholder="E.g., Bullone M8 acciaio zincato a caldo"
                  />
                </div>
                <div className="form-group">
                  <label>Fornitore Abbinato*</label>
                  <select 
                    value={newSku.supplierId}
                    onChange={(e) => setNewSku({ ...newSku, supplierId: e.target.value })}
                    required
                  >
                    <option value="">Seleziona fornitore...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Costo Unitario (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={newSku.unitCost}
                      onChange={(e) => setNewSku({ ...newSku, unitCost: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Lead Time (Giorni)</label>
                    <input 
                      type="number" 
                      value={newSku.leadTimeDays}
                      onChange={(e) => setNewSku({ ...newSku, leadTimeDays: parseInt(e.target.value, 10) })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Scorta Minima (Safety)</label>
                    <input 
                      type="number" 
                      value={newSku.minStock}
                      onChange={(e) => setNewSku({ ...newSku, minStock: parseInt(e.target.value, 10) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Massimo</label>
                    <input 
                      type="number" 
                      value={newSku.maxStock}
                      onChange={(e) => setNewSku({ ...newSku, maxStock: parseInt(e.target.value, 10) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Lotto Minimo (MOQ)</label>
                    <input 
                      type="number" 
                      value={newSku.lotSizeMOQ}
                      onChange={(e) => setNewSku({ ...newSku, lotSizeMOQ: parseInt(e.target.value, 10) })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSku(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary" disabled={!newSku.code || !newSku.supplierId}>Salva SKU</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Crea Nuovo Fornitore</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddSupplier(false)} style={{ padding: '6px' }}>X</button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Ragione Sociale Fornitore*</label>
                  <input 
                    type="text" 
                    required 
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="E.g., Bulloneria Emiliana S.r.l."
                  />
                </div>
                <div className="form-group">
                  <label>Email per Ricezione Ordini (Email Fornitore)*</label>
                  <input 
                    type="email" 
                    required 
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="E.g., ordini@bulloneriaemiliana.it"
                  />
                </div>
                <div className="form-group">
                  <label>Condizioni di Pagamento</label>
                  <input 
                    type="text" 
                    value={newSupplier.paymentTerms}
                    onChange={(e) => setNewSupplier({ ...newSupplier, paymentTerms: e.target.value })}
                    placeholder="E.g., Rimessa Diretta 30gg fine mese"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSupplier(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary" disabled={!newSupplier.name || !newSupplier.email}>Crea Fornitore</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
