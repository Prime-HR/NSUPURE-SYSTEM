import { Request, Response, NextFunction } from "express";
import { AppError } from "./error-handler.js";

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("User is not authenticated", 401, "UNAUTHORIZED"));
      return;
    }

    // OWNER has global override permission
    if (req.user.roles.includes("OWNER")) {
      next();
      return;
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      next(
        new AppError(
          `Access denied. Requires one of roles: ${allowedRoles.join(", ")}`,
          403,
          "FORBIDDEN"
        )
      );
      return;
    }

    next();
  };
}

export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("User is not authenticated", 401, "UNAUTHORIZED"));
      return;
    }

    // OWNER has global override
    if (req.user.roles.includes("OWNER")) {
      next();
      return;
    }

    if (!req.user.permissions.includes(permissionCode)) {
      next(
        new AppError(
          `Access denied. Missing required permission: ${permissionCode}`,
          403,
          "FORBIDDEN"
        )
      );
      return;
    }

    next();
  };
}
