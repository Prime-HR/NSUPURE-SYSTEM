import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: unknown;

  constructor(message: string, statusCode: number = 400, errorCode: string = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const errorId = uuidv4();

  // Log full error details for developers
  console.error(`[ERROR ID: ${errorId}]`, {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        errorId,
        code: err.errorCode,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle generic / unexpected / Prisma errors
  const isPrismaError = err.name?.includes("Prisma");
  const userMessage = isPrismaError
    ? "A database operation error occurred. Please verify your inputs."
    : "An unexpected internal server error occurred. Please contact the administrator.";

  res.status(500).json({
    success: false,
    error: {
      errorId,
      code: "INTERNAL_SERVER_ERROR",
      message: userMessage,
    },
    timestamp: new Date().toISOString(),
  });
}
