import { supabase } from './supabaseClient';

// Types & Interfaces

export interface Tenant {
  id: string;
  companyName: string;
  vatNumber: string; // P.IVA
  fiscalAddress: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  paymentTerms: string;
  created_at: string;
}

export interface SKU {
  id: string;
  tenant_id: string;
  code: string; // ERP Item Code
  description: string;
  supplierId: string;
  unitCost: number;
  minStock: number; // Reorder safety threshold
  maxStock: number; // Target stock level
  lotSizeMOQ: number; // Minimum purchase lot size
  leadTimeDays: number;
  currentStock: number; // Stock level from last CSV upload
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  skuCode: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplierId: string;
  status: 'draft' | 'approved' | 'sent' | 'delivered' | 'cancelled';
  totalAmount: number;
  sentAt?: string;
  created_at: string;
  items?: PurchaseOrderItem[];
}

export interface CSVColumnMapping {
  skuCodeCol: string;
  stockCol: string;
  descriptionCol: string;
}

// -------------------------------------------------------------
// Supabase Data Type Converters
// -------------------------------------------------------------

function toSupabaseTenant(t: Tenant) {
  return {
    id: t.id,
    company_name: t.companyName,
    vat_number: t.vatNumber,
    fiscal_address: t.fiscalAddress,
    created_at: t.created_at,
  };
}

function fromSupabaseTenant(row: any): Tenant {
  return {
    id: row.id,
    companyName: row.company_name,
    vatNumber: row.vat_number,
    fiscalAddress: row.fiscal_address,
    created_at: row.created_at,
  };
}

function toSupabaseSupplier(s: Supplier) {
  return {
    id: s.id,
    tenant_id: s.tenant_id,
    name: s.name,
    email: s.email,
    payment_terms: s.paymentTerms,
    created_at: s.created_at,
  };
}

function fromSupabaseSupplier(row: any): Supplier {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    email: row.email,
    paymentTerms: row.payment_terms,
    created_at: row.created_at,
  };
}

function toSupabaseSKU(s: SKU) {
  return {
    id: s.id,
    tenant_id: s.tenant_id,
    code: s.code,
    description: s.description,
    supplier_id: s.supplierId,
    unit_cost: s.unitCost,
    min_stock: s.minStock,
    max_stock: s.maxStock,
    lot_size_moq: s.lotSizeMOQ,
    lead_time_days: s.leadTimeDays,
    current_stock: s.currentStock,
    created_at: s.created_at,
  };
}

function fromSupabaseSKU(row: any): SKU {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    code: row.code,
    description: row.description,
    supplierId: row.supplier_id,
    unitCost: Number(row.unit_cost),
    minStock: Number(row.min_stock),
    maxStock: Number(row.max_stock),
    lotSizeMOQ: Number(row.lot_size_moq),
    leadTimeDays: Number(row.lead_time_days),
    currentStock: Number(row.current_stock),
    created_at: row.created_at,
  };
}

function toSupabasePO(o: PurchaseOrder) {
  return {
    id: o.id,
    tenant_id: o.tenant_id,
    supplier_id: o.supplierId,
    status: o.status,
    total_amount: o.totalAmount,
    sent_at: o.sentAt || null,
    created_at: o.created_at,
  };
}

function fromSupabasePO(row: any, items: any[] = []): PurchaseOrder {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    supplierId: row.supplier_id,
    status: row.status as PurchaseOrder['status'],
    totalAmount: Number(row.total_amount),
    sentAt: row.sent_at || undefined,
    created_at: row.created_at,
    items: items.map(fromSupabasePOItem),
  };
}

function toSupabasePOItem(i: PurchaseOrderItem) {
  return {
    id: i.id,
    po_id: i.poId,
    sku_code: i.skuCode,
    quantity: i.quantity,
    unit_cost: i.unitCost,
  };
}

function fromSupabasePOItem(row: any): PurchaseOrderItem {
  return {
    id: row.id,
    poId: row.po_id,
    skuCode: row.sku_code,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
  };
}

// -------------------------------------------------------------
// Seed Data & Database Initializer
// -------------------------------------------------------------

const DEFAULT_TENANT: Tenant = {
  id: 'tenant-rossi',
  companyName: 'Manifattura Rossi S.r.l.',
  vatNumber: 'IT12345678901',
  fiscalAddress: "Via dell'Artigianato 15, 20121 Milano (MI), Italia",
  created_at: new Date().toISOString(),
};

const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-acciai',
    tenant_id: 'tenant-rossi',
    name: 'Acciai Speciali Spa',
    email: 'ordini@acciaros.it',
    paymentTerms: '30 giorni f.m. d.f.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'supp-viterie',
    tenant_id: 'tenant-rossi',
    name: 'Viteria Nazionale S.r.l.',
    email: 'logistica@viterianazionale.it',
    paymentTerms: 'Rimessa Diretta',
    created_at: new Date().toISOString(),
  }
];

const DEFAULT_SKUS: SKU[] = [
  {
    id: 'sku-acc-001',
    tenant_id: 'tenant-rossi',
    code: 'ACC-001',
    description: 'Barra Acciaio Trafilato 20mm (1m)',
    supplierId: 'supp-acciai',
    unitCost: 12.50,
    minStock: 50,
    maxStock: 200,
    lotSizeMOQ: 50,
    leadTimeDays: 5,
    currentStock: 80,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sku-acc-002',
    tenant_id: 'tenant-rossi',
    code: 'ACC-002',
    description: 'Lastra Acciaio Zincato 5mm (2x1m)',
    supplierId: 'supp-acciai',
    unitCost: 45.00,
    minStock: 20,
    maxStock: 80,
    lotSizeMOQ: 10,
    leadTimeDays: 7,
    currentStock: 15,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sku-vit-m8',
    tenant_id: 'tenant-rossi',
    code: 'VIT-M8',
    description: 'Vite Testa Cilindrica Esagono Incassato M8x30',
    supplierId: 'supp-viterie',
    unitCost: 0.15,
    minStock: 1000,
    maxStock: 5000,
    lotSizeMOQ: 500,
    leadTimeDays: 3,
    currentStock: 1200,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sku-vit-m10',
    tenant_id: 'tenant-rossi',
    code: 'VIT-M10',
    description: 'Vite Autoperforante Flangiata M10x50',
    supplierId: 'supp-viterie',
    unitCost: 0.22,
    minStock: 800,
    maxStock: 3000,
    lotSizeMOQ: 100,
    leadTimeDays: 3,
    currentStock: 650,
    created_at: new Date().toISOString(),
  }
];

const DEFAULT_COLUMN_MAPPING: CSVColumnMapping = {
  skuCodeCol: 'Codice Articolo',
  stockCol: 'Giacenza',
  descriptionCol: 'Descrizione Articolo',
};

// Database class helper acting as local database engine with Supabase hybrid sync cache
export class Database {
  // --- Supabase Sync Helpers ---
  static async syncTenantToSupabase(tenant: Tenant): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('tenants').upsert(toSupabaseTenant(tenant));
    } catch (e) {
      console.error('Supabase write error (tenant):', e);
    }
  }

  static async syncSupplierToSupabase(supplier: Supplier): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('suppliers').upsert(toSupabaseSupplier(supplier));
    } catch (e) {
      console.error('Supabase write error (supplier):', e);
    }
  }

  static async syncSKUToSupabase(sku: SKU): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('skus').upsert(toSupabaseSKU(sku));
    } catch (e) {
      console.error('Supabase write error (sku):', e);
    }
  }

  static async syncPurchaseOrderToSupabase(po: PurchaseOrder): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('purchase_orders').upsert(toSupabasePO(po));
      if (po.items) {
        await supabase.from('purchase_order_items').delete().eq('po_id', po.id);
        await supabase.from('purchase_order_items').insert(po.items.map(toSupabasePOItem));
      }
    } catch (e) {
      console.error('Supabase write error (purchase_order):', e);
    }
  }

  static async syncSettingsToSupabase(mapping: CSVColumnMapping): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tenantId = this.getTenant().id;
      await supabase.from('tenant_settings').upsert({
        tenant_id: tenantId,
        csv_column_mapping: mapping
      });
    } catch (e) {
      console.error('Supabase write error (tenant_settings):', e);
    }
  }

  // --- CRUD DB Client Interfaces ---
  static getTenant(): Tenant {
    const tenant = localStorage.getItem('previso_tenant');
    if (!tenant) {
      localStorage.setItem('previso_tenant', JSON.stringify(DEFAULT_TENANT));
      return DEFAULT_TENANT;
    }
    return JSON.parse(tenant);
  }

  static getSuppliers(): Supplier[] {
    const data = localStorage.getItem('previso_suppliers');
    if (!data) {
      localStorage.setItem('previso_suppliers', JSON.stringify(DEFAULT_SUPPLIERS));
      return DEFAULT_SUPPLIERS;
    }
    return JSON.parse(data);
  }

  static addSupplier(supplier: Omit<Supplier, 'id' | 'tenant_id' | 'created_at'>): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier: Supplier = {
      ...supplier,
      id: 'supp-' + Math.random().toString(36).substr(2, 9),
      tenant_id: this.getTenant().id,
      created_at: new Date().toISOString(),
    };
    suppliers.push(newSupplier);
    localStorage.setItem('previso_suppliers', JSON.stringify(suppliers));
    this.syncSupplierToSupabase(newSupplier);
    return newSupplier;
  }

  static getSKUs(): SKU[] {
    const data = localStorage.getItem('previso_skus');
    if (!data) {
      localStorage.setItem('previso_skus', JSON.stringify(DEFAULT_SKUS));
      return DEFAULT_SKUS;
    }
    return JSON.parse(data);
  }

  static saveSKUs(skus: SKU[]): void {
    localStorage.setItem('previso_skus', JSON.stringify(skus));
    skus.forEach(sku => this.syncSKUToSupabase(sku));
  }

  static addSKU(sku: Omit<SKU, 'id' | 'tenant_id' | 'created_at'>): SKU {
    const skus = this.getSKUs();
    const newSKU: SKU = {
      ...sku,
      id: 'sku-' + Math.random().toString(36).substr(2, 9),
      tenant_id: this.getTenant().id,
      created_at: new Date().toISOString(),
    };
    skus.push(newSKU);
    this.saveSKUs(skus);
    return newSKU;
  }

  static updateSKU(id: string, updates: Partial<SKU>): SKU {
    const skus = this.getSKUs();
    const idx = skus.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('SKU not found');
    skus[idx] = { ...skus[idx], ...updates };
    this.saveSKUs(skus);
    return skus[idx];
  }

  static getColumnMapping(): CSVColumnMapping {
    const data = localStorage.getItem('previso_mapping');
    if (!data) {
      localStorage.setItem('previso_mapping', JSON.stringify(DEFAULT_COLUMN_MAPPING));
      return DEFAULT_COLUMN_MAPPING;
    }
    return JSON.parse(data);
  }

  static saveColumnMapping(mapping: CSVColumnMapping): void {
    localStorage.setItem('previso_mapping', JSON.stringify(mapping));
    this.syncSettingsToSupabase(mapping);
  }

  static getPurchaseOrders(): PurchaseOrder[] {
    const orders = localStorage.getItem('previso_orders');
    return orders ? JSON.parse(orders) : [];
  }

  static savePurchaseOrders(orders: PurchaseOrder[]): void {
    localStorage.setItem('previso_orders', JSON.stringify(orders));
    orders.forEach(po => this.syncPurchaseOrderToSupabase(po));
  }

  // Calculate pending / on-order quantities per SKU code
  static getOnOrderQuantities(): Record<string, number> {
    const orders = this.getPurchaseOrders();
    const quantities: Record<string, number> = {};
    
    // Filter active orders (draft, approved, or sent)
    const activeOrders = orders.filter(o => 
      o.status === 'draft' || o.status === 'approved' || o.status === 'sent'
    );

    for (const order of activeOrders) {
      if (order.items) {
        for (const item of order.items) {
          quantities[item.skuCode] = (quantities[item.skuCode] || 0) + item.quantity;
        }
      }
    }
    return quantities;
  }

  // Run the replenishment formula on current state
  static calculateReplenishment(updatedStocks: Record<string, number> = {}): {
    skuId: string;
    code: string;
    description: string;
    currentStock: number;
    onOrderStock: number;
    minStock: number;
    maxStock: number;
    lotSizeMOQ: number;
    suggestedQty: number;
    supplierId: string;
    unitCost: number;
  }[] {
    const skus = this.getSKUs();
    const onOrders = this.getOnOrderQuantities();

    return skus.map(sku => {
      // Use newly uploaded stock if provided, otherwise fall back to db stock level
      const currentStock = updatedStocks[sku.code] !== undefined ? updatedStocks[sku.code] : sku.currentStock;
      const onOrderStock = onOrders[sku.code] || 0;
      const available = currentStock + onOrderStock;

      let suggestedQty = 0;
      if (available <= sku.minStock) {
        const rawReorder = sku.maxStock - available;
        suggestedQty = Math.max(sku.lotSizeMOQ, Math.ceil(rawReorder / sku.lotSizeMOQ) * sku.lotSizeMOQ);
      }

      return {
        skuId: sku.id,
        code: sku.code,
        description: sku.description,
        currentStock,
        onOrderStock,
        minStock: sku.minStock,
        maxStock: sku.maxStock,
        lotSizeMOQ: sku.lotSizeMOQ,
        suggestedQty,
        supplierId: sku.supplierId,
        unitCost: sku.unitCost,
      };
    });
  }

  // Save parsed inventory stock levels into database mapping
  static applyInventoryUpload(stocks: Record<string, number>): void {
    const skus = this.getSKUs();
    const updated = skus.map(sku => {
      if (stocks[sku.code] !== undefined) {
        return { ...sku, currentStock: stocks[sku.code] };
      }
      return sku;
    });
    this.saveSKUs(updated);
  }

  // Generate new Draft Purchase Orders from proposed replenishment suggestions
  static generateDraftOrders(
    proposals: { supplierId: string; code: string; suggestedQty: number; unitCost: number; skuId?: string }[]
  ): PurchaseOrder[] {
    const orders = this.getPurchaseOrders();
    
    // Group active reorders by supplier
    const grouped: Record<string, typeof proposals> = {};
    for (const p of proposals) {
      if (p.suggestedQty > 0) {
        if (!grouped[p.supplierId]) grouped[p.supplierId] = [];
        grouped[p.supplierId].push(p);
      }
    }

    const tenantId = this.getTenant().id;
    const generatedDrafts: PurchaseOrder[] = [];

    for (const [suppId, items] of Object.entries(grouped)) {
      const poId = 'po-' + Math.random().toString(36).substr(2, 9);
      
      const orderItems: PurchaseOrderItem[] = items.map(item => ({
        id: 'poi-' + Math.random().toString(36).substr(2, 9),
        poId,
        skuCode: item.code,
        quantity: item.suggestedQty,
        unitCost: item.unitCost,
      }));

      const totalAmount = orderItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0);

      const newOrder: PurchaseOrder = {
        id: poId,
        tenant_id: tenantId,
        supplierId: suppId,
        status: 'draft',
        totalAmount,
        created_at: new Date().toISOString(),
        items: orderItems,
      };

      orders.push(newOrder);
      generatedDrafts.push(newOrder);
    }

    this.savePurchaseOrders(orders);
    return generatedDrafts;
  }

  // Reset the database state to defaults (useful for testing or starting over)
  static resetDB(): void {
    localStorage.removeItem('previso_tenant');
    localStorage.removeItem('previso_suppliers');
    localStorage.removeItem('previso_skus');
    localStorage.removeItem('previso_orders');
    localStorage.removeItem('previso_mapping');
  }
}

// -------------------------------------------------------------
// Supabase Sync Pull Handler
// -------------------------------------------------------------

export async function initializeSupabaseSync(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('Supabase session not active. Operating in local-only mock mode.');
      return;
    }
    
    const userId = session.user.id;
    
    // Get tenant membership mapping
    const { data: members, error: memberErr } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId);
      
    if (memberErr || !members || members.length === 0) {
      console.warn('User has no active tenant memberships in Supabase.');
      return;
    }
    
    const tenantId = members[0].tenant_id;
    
    // 1. Pull tenant details
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();
      
    if (tenantRow) {
      localStorage.setItem('previso_tenant', JSON.stringify(fromSupabaseTenant(tenantRow)));
    }
    
    // 2. Pull suppliers
    const { data: supplierRows } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId);
      
    if (supplierRows && supplierRows.length > 0) {
      localStorage.setItem('previso_suppliers', JSON.stringify(supplierRows.map(fromSupabaseSupplier)));
    } else {
      // Seed suppliers if empty on remote
      const localSuppliers = Database.getSuppliers();
      const rows = localSuppliers.map(s => toSupabaseSupplier({ ...s, tenant_id: tenantId }));
      await supabase.from('suppliers').insert(rows);
    }
    
    // 3. Pull SKUs
    const { data: skuRows } = await supabase
      .from('skus')
      .select('*')
      .eq('tenant_id', tenantId);
      
    if (skuRows && skuRows.length > 0) {
      localStorage.setItem('previso_skus', JSON.stringify(skuRows.map(fromSupabaseSKU)));
    } else {
      // Seed SKUs if empty on remote
      const localSKUs = Database.getSKUs();
      const rows = localSKUs.map(s => toSupabaseSKU({ ...s, tenant_id: tenantId }));
      await supabase.from('skus').insert(rows);
    }
    
    // 4. Pull Purchase Orders
    const { data: poRows } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('tenant_id', tenantId);
      
    if (poRows) {
      const orders = poRows.map(row => fromSupabasePO(row, row.purchase_order_items));
      localStorage.setItem('previso_orders', JSON.stringify(orders));
    }
    
    // 5. Pull column mapping mapping
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
      
    if (settingsRow) {
      localStorage.setItem('previso_mapping', JSON.stringify(settingsRow.csv_column_mapping));
    }
    
    console.log('Supabase sync completed successfully.');
  } catch (err) {
    console.error('Error during Supabase initialization sync:', err);
  }
}
