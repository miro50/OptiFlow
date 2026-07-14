import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from './db';

// Mock localStorage for Node environment running Vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });


describe('Previso Replenishment Calculations', () => {
  beforeEach(() => {
    // Clear and reset local database state before each test
    Database.resetDB();
  });

  it('should trigger replenishment when stock drops below minStock', () => {
    // Check seed SKU ACC-002: minStock = 20, maxStock = 80, lotSizeMOQ = 10.
    // Stock is seeded at 15.
    const proposals = Database.calculateReplenishment();
    const item = proposals.find(p => p.code === 'ACC-002');
    
    expect(item).toBeDefined();
    // Stock is 15 <= 20, so it must trigger reorder
    expect(item!.suggestedQty).toBeGreaterThan(0);
    // Max stock 80 - 15 = 65. Round 65 up to nearest lotSizeMOQ (10) -> 70.
    expect(item!.suggestedQty).toBe(70);
  });

  it('should not trigger replenishment if stock is above minStock', () => {
    // Check seed SKU ACC-001: minStock = 50, maxStock = 200, currentStock = 80.
    const proposals = Database.calculateReplenishment();
    const item = proposals.find(p => p.code === 'ACC-001');

    expect(item).toBeDefined();
    expect(item!.suggestedQty).toBe(0);
  });

  it('should deduct on-order stock from the reorder quantity to prevent duplicates', () => {
    // Check seed SKU ACC-002: min = 20, max = 80, current = 15, lotSize = 10.
    // Let's create a draft order and approve it (status changes to draft -> approved)
    const proposalsInitial = Database.calculateReplenishment();
    const generated = Database.generateDraftOrders(proposalsInitial);
    
    expect(generated.length).toBeGreaterThan(0);
    
    // Set order status to approved
    const activeOrders = Database.getPurchaseOrders();
    activeOrders.forEach(o => {
      o.status = 'approved';
    });
    Database.savePurchaseOrders(activeOrders);

    // Re-calculate. Since we have ACC-002 already on-order (qty 70), 
    // available = current (15) + on-order (70) = 85. 
    // 85 is greater than minStock (20), so suggested quantity must now drop to 0!
    const proposalsAfter = Database.calculateReplenishment();
    const itemAfter = proposalsAfter.find(p => p.code === 'ACC-002');

    expect(itemAfter).toBeDefined();
    expect(itemAfter!.suggestedQty).toBe(0);
  });

  it('should round suggested quantity up to the nearest lotSizeMOQ multiple', () => {
    // Create custom SKU with MOQ lotSizeMOQ = 150.
    // min = 200, max = 500, stock = 190.
    // rawReorder = 500 - 190 = 310.
    // Round 310 up to nearest 150 -> 450.
    Database.addSKU({
      code: 'TEST-SKU',
      description: 'Test SKU rounding',
      supplierId: 'supp-acciai',
      unitCost: 1.00,
      minStock: 200,
      maxStock: 500,
      lotSizeMOQ: 150,
      leadTimeDays: 5,
      currentStock: 190,
    });

    const proposals = Database.calculateReplenishment();
    const item = proposals.find(p => p.code === 'TEST-SKU');

    expect(item).toBeDefined();
    expect(item!.suggestedQty).toBe(450);
  });

  it('should support adding and updating SKU configurations', () => {
    const created = Database.addSKU({
      code: 'NEW-SKU',
      description: 'New test SKU',
      supplierId: 'supp-acciai',
      unitCost: 10.0,
      minStock: 10,
      maxStock: 50,
      lotSizeMOQ: 5,
      leadTimeDays: 3,
      currentStock: 25,
    });
    
    expect(created.id).toBeDefined();
    
    const updated = Database.updateSKU(created.id, { currentStock: 8, description: 'Updated test SKU' });
    expect(updated.currentStock).toBe(8);
    expect(updated.description).toBe('Updated test SKU');
    
    // Non-existent SKU update should throw
    expect(() => Database.updateSKU('non-existent-id', { currentStock: 0 })).toThrow();
  });

  it('should support adding new suppliers', () => {
    const created = Database.addSupplier({
      name: 'Nuovo Fornitore S.r.l.',
      email: 'nuovo@fornitore.it',
      phone: '+39 02 123456',
      leadTimeDays: 7,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Nuovo Fornitore S.r.l.');
    expect(created.email).toBe('nuovo@fornitore.it');
  });

  it('should get and save column mapping configuration', () => {
    const original = Database.getColumnMapping();
    expect(original.skuCodeCol).toBeDefined();

    const customMapping = {
      skuCodeCol: 'CodicePersonalizzato',
      stockCol: 'GiacenzaPersonalizzata',
      descriptionCol: 'DescrizionePersonalizzata'
    };
    Database.saveColumnMapping(customMapping);

    const loaded = Database.getColumnMapping();
    expect(loaded.skuCodeCol).toBe('CodicePersonalizzato');
    expect(loaded.stockCol).toBe('GiacenzaPersonalizzata');
  });
});
