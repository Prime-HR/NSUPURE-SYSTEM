import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const createProductSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  unit: z.string().default("BAG"),
  sachetsPerBag: z.number().int().positive().default(30),
  defaultPrice: z.number().positive().default(7.0),
});

export const updatePriceSchema = z.object({
  price: z.number().positive("Price must be a positive number"),
  reason: z.string().min(3, "A valid reason for price change is required"),
});

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        priceHistory: {
          orderBy: { effectiveFrom: "desc" },
          take: 5,
        },
      },
    });

    res.json({
      success: true,
      data: { products },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        priceHistory: {
          orderBy: { effectiveFrom: "desc" },
        },
      },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    res.json({
      success: true,
      data: { product },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const existing = await prisma.product.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new AppError("Product code already exists", 400, "DUPLICATE_CODE");
    }

    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        sachetsPerBag: data.sachetsPerBag,
        defaultPrice: data.defaultPrice,
        isActive: true,
        priceHistory: {
          create: {
            price: data.defaultPrice,
            changedBy: req.user?.username || "SYSTEM",
            changeReason: "Initial product creation",
          },
        },
      },
    });

    await logAudit({
      action: "CREATE",
      module: "products",
      recordId: product.id,
      newValue: product,
      req,
    });

    res.status(201).json({
      success: true,
      data: { product },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProductPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { price, reason } = req.body;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const oldPrice = product.defaultPrice;

    // Update product price and append to priceHistory
    const updated = await prisma.$transaction(async (tx) => {
      // Close out previous price record
      const latestPriceRecord = await tx.productPrice.findFirst({
        where: { productId: id, effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });

      if (latestPriceRecord) {
        await tx.productPrice.update({
          where: { id: latestPriceRecord.id },
          data: { effectiveTo: new Date() },
        });
      }

      await tx.productPrice.create({
        data: {
          productId: id,
          price,
          changedBy: req.user?.username || "UNKNOWN",
          changeReason: reason,
          approvedBy: req.user?.roles.includes("OWNER") ? req.user.username : null,
        },
      });

      return await tx.product.update({
        where: { id },
        data: { defaultPrice: price },
      });
    });

    await logAudit({
      action: "UPDATE",
      module: "products",
      recordId: id,
      oldValue: { price: oldPrice },
      newValue: { price, reason },
      req,
    });

    res.json({
      success: true,
      data: { product: updated },
      message: `Price updated from GH₵${oldPrice.toFixed(2)} to GH₵${price.toFixed(2)}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
