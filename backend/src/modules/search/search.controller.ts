import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma.js";

export async function globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query || query.length < 2) {
      res.json({
        success: true,
        data: {
          results: {
            customers: [],
            sales: [],
            orders: [],
            batches: [],
            vehicles: [],
            employees: [],
            documents: [],
            loans: [],
          },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Parallel fast search across entities (Section 52)
    const [
      customers,
      sales,
      orders,
      batches,
      vehicles,
      employees,
      documents,
      loans,
    ] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { businessName: { contains: query } },
            { customerCode: { contains: query } },
            { phone: { contains: query } },
            { contactPerson: { contains: query } },
            { community: { contains: query } },
          ],
        },
        take: 5,
      }),
      prisma.sale.findMany({
        where: {
          OR: [
            { saleNumber: { contains: query } },
            { customer: { businessName: { contains: query } } },
          ],
        },
        include: { customer: true },
        take: 5,
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query } },
            { customer: { businessName: { contains: query } } },
          ],
        },
        include: { customer: true },
        take: 5,
      }),
      prisma.productionBatch.findMany({
        where: {
          batchNumber: { contains: query },
        },
        take: 5,
      }),
      prisma.vehicle.findMany({
        where: {
          OR: [
            { registrationNumber: { contains: query } },
            { makeModel: { contains: query } },
          ],
        },
        take: 5,
      }),
      prisma.employee.findMany({
        where: {
          OR: [
            { fullName: { contains: query } },
            { employeeCode: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        take: 5,
      }),
      prisma.document.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { documentCode: { contains: query } },
            { documentNumber: { contains: query } },
          ],
        },
        take: 5,
      }),
      prisma.loan.findMany({
        where: {
          OR: [
            { loanCode: { contains: query } },
            { lenderName: { contains: query } },
          ],
        },
        take: 5,
      }),
    ]);

    res.json({
      success: true,
      data: {
        results: {
          customers,
          sales,
          orders,
          batches,
          vehicles,
          employees,
          documents,
          loans,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
