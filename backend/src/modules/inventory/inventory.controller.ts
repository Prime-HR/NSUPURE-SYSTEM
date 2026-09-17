import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import { calculateClosingStock, roundCurrency } from "../../utils/calculations.js";

export const createItemSchema = z.object({
  itemCode: z.string().min(2),
  name: z.string().min(2),
  category: z.enum([
    "SACHET_FILM",
    "OUTER_BAGS",
    "CHEMICALS",
    "FILTERS",
    "CLEANING",
    "FUEL",
    "SPARE_PARTS",
    "OTHER",
  ]),
  unit: z.enum(["ROLL", "BUNDLE", "KG", "LITRE", "PIECE"]),
  openingStock: z.number().nonnegative().default(0.0),
  reorderLevel: z.number().nonnegative().default(10.0),
  unitCost: z.number().nonnegative().default(0.0),
  supplierId: z.string().uuid().optional(),
  storageLocation: z.string().optional(),
  notes: z.string().optional(),
});

export const recordTransactionSchema = z.object({
  itemId: z.string().uuid(),
  transactionType: z.enum(["PURCHASE", "PRODUCTION_USAGE", "DAMAGE", "ADJUSTMENT", "TRANSFER", "RETURN"]),
  quantity: z.number().refine((val) => val !== 0, "Quantity cannot be zero"),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
  productsSupplied: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseDate: z.string().optional(),
  receiptNumber: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("PAID"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
    })
  ).min(1, "Purchase must include at least one item"),
});

// -------------------------------------------------------------
// INVENTORY ITEMS & TRANSACTIONS (Section 27 & 28)
// -------------------------------------------------------------

export async function getInventoryItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, lowStockOnly } = req.query;
    const where: Record<string, unknown> = {};

    if (category && typeof category === "string") where.category = category;

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        supplier: true,
        _count: { select: { transactions: true } },
      },
    });

    const filtered = lowStockOnly === "true"
      ? items.filter((item) => item.currentStock <= item.reorderLevel)
      : items;

    res.json({
      success: true,
      data: {
        items: filtered,
        totalItems: filtered.length,
        lowStockCount: items.filter((i) => i.currentStock <= i.reorderLevel).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const existing = await prisma.inventoryItem.findUnique({
      where: { itemCode: data.itemCode },
    });
    if (existing) {
      throw new AppError("Item code already exists", 400, "DUPLICATE_CODE");
    }

    const item = await prisma.inventoryItem.create({
      data: {
        itemCode: data.itemCode,
        name: data.name,
        category: data.category,
        unit: data.unit,
        openingStock: data.openingStock,
        currentStock: data.openingStock,
        reorderLevel: data.reorderLevel,
        unitCost: data.unitCost,
        supplierId: data.supplierId || null,
        storageLocation: data.storageLocation || null,
        notes: data.notes || null,
      },
    });

    if (data.openingStock > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          itemId: item.id,
          transactionType: "ADJUSTMENT",
          quantity: data.openingStock,
          unitCost: data.unitCost,
          notes: "Initial opening stock balance",
          recordedBy: req.user?.username || null,
        },
      });
    }

    await logAudit({
      action: "CREATE",
      module: "inventory",
      recordId: item.id,
      newValue: item,
      req,
    });

    res.status(201).json({
      success: true,
      data: { item },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record stock movement:
 * Rule: NEVER silently alter stock balance. Every movement MUST have an InventoryTransaction!
 */
export async function recordInventoryTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item) {
      throw new AppError("Inventory item not found", 404, "NOT_FOUND");
    }

    // Determine quantity delta (+ for purchase/return, - for usage/damage)
    let delta = data.quantity;
    if (["PRODUCTION_USAGE", "DAMAGE"].includes(data.transactionType) && delta > 0) {
      delta = -delta;
    }

    const newStock = roundCurrency(item.currentStock + delta);
    if (newStock < 0) {
      throw new AppError(
        `Insufficient stock. Available: ${item.currentStock} ${item.unit}, Attempted: ${Math.abs(delta)} ${item.unit}`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId: data.itemId,
          transactionType: data.transactionType,
          quantity: delta,
          unitCost: data.unitCost ?? item.unitCost,
          recordedBy: req.user?.username || null,
          notes: data.notes || null,
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: data.itemId },
        data: { currentStock: newStock },
      });

      return { transaction, updatedItem };
    });

    await logAudit({
      action: "UPDATE",
      module: "inventory",
      recordId: data.itemId,
      oldValue: { stock: item.currentStock },
      newValue: { stock: newStock, type: data.transactionType, delta },
      req,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Stock updated for ${item.name}. New balance: ${newStock} ${item.unit}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// SUPPLIERS & PURCHASES (Section 29)
// -------------------------------------------------------------

export async function getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchases: true, inventoryItems: true } },
      },
    });

    res.json({
      success: true,
      data: { suppliers },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.supplier.count();
    const supplierCode = `NSP-SUP-${String(count + 1).padStart(3, "0")}`;

    const supplier = await prisma.supplier.create({
      data: {
        supplierCode,
        name: data.name,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        location: data.location || null,
        productsSupplied: data.productsSupplied || null,
        paymentTerms: data.paymentTerms || null,
        currentBalance: 0.0,
        notes: data.notes || null,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "suppliers",
      recordId: supplier.id,
      newValue: supplier,
      req,
    });

    res.status(201).json({
      success: true,
      data: { supplier },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    let totalAmount = 0;
    for (const item of data.items) {
      totalAmount += item.quantity * item.unitPrice;
    }
    totalAmount = roundCurrency(totalAmount);

    const count = await prisma.purchase.count();
    const purchaseNumber = `NSP-PUR-${String(count + 1).padStart(4, "0")}`;

    // ATOMIC: Create purchase, line items, increment inventory, create inventory transactions
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: data.supplierId,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
          totalAmount,
          paymentStatus: data.paymentStatus,
          receiptNumber: data.receiptNumber || null,
          recordedBy: req.user?.username || null,
          notes: data.notes || null,
          items: {
            create: data.items.map((i: { itemId: string; quantity: number; unitPrice: number }) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: roundCurrency(i.quantity * i.unitPrice),
            })),
          },
        },
        include: { items: true },
      });

      // Update inventory stock for each purchased item
      for (const item of data.items) {
        const invItem = await tx.inventoryItem.findUnique({ where: { id: item.itemId } });
        if (invItem) {
          const newStock = roundCurrency(invItem.currentStock + item.quantity);
          await tx.inventoryItem.update({
            where: { id: item.itemId },
            data: {
              currentStock: newStock,
              unitCost: item.unitPrice,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              itemId: item.itemId,
              transactionType: "PURCHASE",
              quantity: item.quantity,
              unitCost: item.unitPrice,
              referenceType: "PURCHASE",
              referenceId: purchase.id,
              recordedBy: req.user?.username || null,
              notes: `Stock arrival from purchase ${purchaseNumber}`,
            },
          });
        }
      }

      return purchase;
    });

    await logAudit({
      action: "CREATE",
      module: "purchases",
      recordId: result.id,
      newValue: { purchaseNumber, totalAmount },
      req,
    });

    res.status(201).json({
      success: true,
      data: { purchase: result },
      message: `Purchase ${purchaseNumber} recorded and stock updated`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
