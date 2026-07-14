import { jsPDF } from 'jspdf';
import { type PurchaseOrder, type Supplier, type Tenant } from './db';

export const generatePOPDF = (po: PurchaseOrder, supplier: Supplier, tenant: Tenant): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page Width and margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;

  // Colors
  const primaryColor = [16, 185, 129]; // Emerald (#10b981)
  const darkColor = [15, 23, 42]; // Charcoal (#0f172a)
  const greyColor = [100, 116, 139]; // Slate (#64748b)
  const lightGreyColor = [241, 245, 249]; // Light grey (#f1f5f9)

  // Header Title
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Brand Logomark
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PREVISO', marginX, 8.5);

  // Autopilot label
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('AUTOPILOT REPLENISHMENT', marginX + 28, 8);

  // Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("ORDINE D'ACQUISTO", marginX, 30);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
  doc.text('Purchase Order Document', marginX, 35);

  // PO Details Right-Aligned
  const detailsX = pageWidth - marginX;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Ordine N°: ${po.id.toUpperCase()}`, detailsX, 28, { align: 'right' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
  doc.text(`Data Ordine: ${new Date(po.created_at).toLocaleDateString('it-IT')}`, detailsX, 33, { align: 'right' });
  doc.text(`Stato: DRAFT / DA CONFERMARE`, detailsX, 38, { align: 'right' });

  // Draw Horizontal Separator
  doc.setDrawColor(229, 228, 231);
  doc.setLineWidth(0.5);
  doc.line(marginX, 44, pageWidth - marginX, 44);

  // Buyer (Tenant) Details Left-Aligned
  let currentY = 54;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('ACQUIRENTE (SME)', marginX, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
  doc.text(tenant.companyName, marginX, currentY + 6);
  doc.text(`P.IVA: ${tenant.vatNumber}`, marginX, currentY + 11);
  doc.text(tenant.fiscalAddress, marginX, currentY + 16, { maxWidth: 75 });

  // Supplier Details Right-Aligned
  const supplierX = pageWidth - marginX;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('FORNITORE (SUPPLIER)', supplierX, currentY, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
  doc.text(supplier.name, supplierX, currentY + 6, { align: 'right' });
  doc.text(`Email: ${supplier.email}`, supplierX, currentY + 11, { align: 'right' });
  doc.text(`Cond. Pagamento: ${supplier.paymentTerms || 'Standard'}`, supplierX, currentY + 16, { align: 'right' });

  // Draw table container line
  currentY = 88;
  doc.setDrawColor(229, 228, 231);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  // Table Headers
  currentY = 96;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('COD. ARTICOLO (SKU)', marginX + 2, currentY);
  doc.text('DESCRIZIONE', marginX + 42, currentY);
  doc.text('QUANTITÀ', marginX + 110, currentY, { align: 'right' });
  doc.text('COSTO UNIT.', marginX + 138, currentY, { align: 'right' });
  doc.text('TOTALE RIGA', pageWidth - marginX - 2, currentY, { align: 'right' });

  doc.setLineWidth(0.3);
  doc.line(marginX, currentY + 3, pageWidth - marginX, currentY + 3);

  // Table rows
  currentY = 106;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  if (po.items) {
    for (const item of po.items) {
      // Check if page overflow would occur
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 25;
        // Reprint simple header on page 2
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('COD. ARTICOLO (SKU)', marginX + 2, currentY);
        doc.text('DESCRIZIONE', marginX + 42, currentY);
        doc.text('QUANTITÀ', marginX + 110, currentY, { align: 'right' });
        doc.text('COSTO UNIT.', marginX + 138, currentY, { align: 'right' });
        doc.text('TOTALE RIGA', pageWidth - marginX - 2, currentY, { align: 'right' });
        doc.line(marginX, currentY + 3, pageWidth - marginX, currentY + 3);
        currentY = 35;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
      }

      const itemTotal = item.quantity * item.unitCost;
      
      // Draw background shading zebra style
      doc.setFillColor(lightGreyColor[0], lightGreyColor[1], lightGreyColor[2]);
      doc.rect(marginX, currentY - 5, pageWidth - (marginX * 2), 8, 'F');

      doc.text(item.skuCode, marginX + 2, currentY);
      doc.text(item.skuCode, marginX + 2, currentY); // Duplicate print safety
      
      // Truncate description if too long
      const desc = item.skuCode === 'VIT-M8' ? 'Vite Testa Cilindrica M8x30' :
                   item.skuCode === 'VIT-M10' ? 'Vite Autoperforante M10x50' :
                   item.skuCode === 'ACC-001' ? 'Barra Acciaio Trafilato 20mm (1m)' :
                   item.skuCode === 'ACC-002' ? 'Lastra Acciaio Zincato 5mm (2x1m)' :
                   'Articolo di magazzino';
      doc.text(desc, marginX + 42, currentY, { maxWidth: 62 });

      doc.text(item.quantity.toString(), marginX + 110, currentY, { align: 'right' });
      doc.text(`€ ${item.unitCost.toFixed(2)}`, marginX + 138, currentY, { align: 'right' });
      doc.text(`€ ${itemTotal.toFixed(2)}`, pageWidth - marginX - 2, currentY, { align: 'right' });

      currentY += 10;
    }
  }

  // Draw total section divider
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY - 2, pageWidth - marginX, currentY - 2);

  // Total amount
  currentY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTALE ORDINE (EUR):', pageWidth - marginX - 60, currentY, { align: 'right' });
  doc.text(`€ ${po.totalAmount.toFixed(2)}`, pageWidth - marginX - 2, currentY, { align: 'right' });

  // Autopilot signature info at the bottom
  const footerY = pageHeight - 20;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
  doc.text('Questo documento è un ordine d\'acquisto generato automaticamente tramite Previso Autopilot.', marginX, footerY);
  doc.text('Rispondere direttamente a questo indirizzo email per qualsiasi comunicazione o per confermare la data di consegna stimata.', marginX, footerY + 4);

  return doc;
};
