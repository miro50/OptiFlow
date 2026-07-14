import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, ArrowRight, Settings } from 'lucide-react';
import { Database, type CSVColumnMapping } from '../utils/db';

interface UploadWizardProps {
  onUploadComplete: (stocks: Record<string, number>) => void;
}

export const UploadWizard: React.FC<UploadWizardProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<CSVColumnMapping>({
    skuCodeCol: '',
    stockCol: '',
    descriptionCol: '',
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect columns based on names
  const autoDetectMapping = (cols: string[]): CSVColumnMapping => {
    const saved = Database.getColumnMapping();
    
    // Check if saved mapping columns exist in the uploaded file
    const mappedSku = cols.find(c => c === saved.skuCodeCol) || 
                      cols.find(c => /codice|sku|code|art/i.test(c)) || 
                      cols[0] || '';
    const mappedStock = cols.find(c => c === saved.stockCol) || 
                       cols.find(c => /giacenza|stock|quantit|qty|quant/i.test(c)) || 
                       cols[1] || '';
    const mappedDesc = cols.find(c => c === saved.descriptionCol) || 
                      cols.find(c => /descrizione|descr|desc|name|nome/i.test(c)) || 
                      cols[2] || '';

    return {
      skuCodeCol: mappedSku,
      stockCol: mappedStock,
      descriptionCol: mappedDesc,
    };
  };

  const handleFileParse = (selectedFile: File) => {
    setFile(selectedFile);
    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields && results.meta.fields.length > 0) {
          const fields = results.meta.fields;
          setHeaders(fields);
          setPreviewRows(results.data.slice(0, 5) as Record<string, string>[]);
          
          const detected = autoDetectMapping(fields);
          setMapping(detected);
          setStep(2);
        } else {
          alert("Impossibile leggere l'intestazione del file CSV. Assicurati che contenga una riga di intestazione.");
        }
      },
      error: (err) => {
        alert("Errore durante il parsing del file: " + err.message);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileParse(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileParse(e.target.files[0]);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;

    // Save mappings for future reference
    Database.saveColumnMapping(mapping);

    // Re-parse and execute stock mapping
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const stocks: Record<string, number> = {};
        for (const row of results.data) {
          const skuCode = row[mapping.skuCodeCol]?.trim();
          const stockStr = row[mapping.stockCol]?.trim();
          
          if (skuCode) {
            // Parse stock replacing common Italian decimal/thousands format characters if any
            const stockVal = stockStr ? parseInt(stockStr.replace(/\./g, '').replace(',', '.'), 10) : 0;
            stocks[skuCode] = isNaN(stockVal) ? 0 : stockVal;
          }
        }
        onUploadComplete(stocks);
      }
    });
  };

  return (
    <div className="card">
      {step === 1 ? (
        <div 
          className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".csv,.txt"
            style={{ display: 'none' }}
          />
          <div className="upload-icon-container">
            <Upload size={32} />
          </div>
          <div>
            <h3>Trascina qui il file di magazzino o clicca per sfogliare</h3>
            <p style={{ marginTop: '8px' }}>Supporta esportazioni CSV o TXT da Zucchetti, TeamSystem, SAP, ecc.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileSpreadsheet className="text-success" size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontSize: '18px' }}>File caricato: {file?.name}</h3>
                <p style={{ fontSize: '13px' }}>{headers.length} colonne identificate. Configura la mappatura di seguito.</p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Carica altro file
            </button>
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', padding: '20px', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Settings size={18} style={{ color: 'var(--accent-secondary)' }} />
              <h4 style={{ fontSize: '15px' }}>Mappatura Colonne CSV</h4>
            </div>

            <div className="mapping-grid">
              <div className="mapping-row">
                <span className="mapping-label">Codice Articolo (SKU)*</span>
                <div className="select-wrapper">
                  <select 
                    value={mapping.skuCodeCol}
                    onChange={(e) => setMapping({ ...mapping, skuCodeCol: e.target.value })}
                  >
                    <option value="">Seleziona colonna...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="mapping-row">
                <span className="mapping-label">Giacenza Disponibile*</span>
                <div className="select-wrapper">
                  <select 
                    value={mapping.stockCol}
                    onChange={(e) => setMapping({ ...mapping, stockCol: e.target.value })}
                  >
                    <option value="">Seleziona colonna...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="mapping-row" style={{ gridColumn: 'span 2' }}>
                <span className="mapping-label">Descrizione Articolo (Opzionale)</span>
                <div className="select-wrapper">
                  <select 
                    value={mapping.descriptionCol}
                    onChange={(e) => setMapping({ ...mapping, descriptionCol: e.target.value })}
                  >
                    <option value="">Nessuna colonna (usa descrizione predefinita)</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CSV Preview Section */}
          <div>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Anteprima Dati Rilevati</h4>
            <div className="table-container" style={{ maxHeight: '180px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{mapping.skuCodeCol || 'SKU'}</th>
                    <th>{mapping.descriptionCol || 'Descrizione'}</th>
                    <th>{mapping.stockCol || 'Giacenza'}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{row[mapping.skuCodeCol] || '-'}</td>
                      <td>{mapping.descriptionCol ? row[mapping.descriptionCol] : '-'}</td>
                      <td style={{ fontWeight: '600' }}>{row[mapping.stockCol] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleAnalyze}
              disabled={!mapping.skuCodeCol || !mapping.stockCol}
            >
              Elabora e Calcola Fabbisogno
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
