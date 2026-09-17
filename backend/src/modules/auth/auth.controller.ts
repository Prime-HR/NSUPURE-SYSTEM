import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { ENV } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError("Invalid username or password", 401, "INVALID_CREDENTIALS");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Account is suspended or inactive", 403, "ACCOUNT_INACTIVE");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid username or password", 401, "INVALID_CREDENTIALS");
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissionsSet = new Set<string>();

    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) {
        permissionsSet.add(rp.permission.code);
      }
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        roles,
      },
      ENV.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await logAudit({
      userId: user.id,
      action: "LOGIN",
      module: "auth",
      recordId: user.id,
      newValue: { username: user.username },
      req,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          roles,
          permissions: Array.from(permissionsSet),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    res.json({
      success: true,
      data: {
        user: req.user,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Current password does not match", 400, "INCORRECT_PASSWORD");
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      module: "auth",
      recordId: user.id,
      newValue: { changed: "password" },
      req,
    });

    res.json({
      success: true,
      message: "Password updated successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  roles: z.array(z.string()).min(1, "At least one role must be assigned"),
});

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.code),
    }));

    res.json({
      success: true,
      data: { users: formatted },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.toLowerCase() },
          ...(data.email && data.email.trim().length > 0 ? [{ email: data.email.trim().toLowerCase() }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new AppError("Username or email is already taken", 400, "USER_EXISTS");
    }

    const email =
      data.email && data.email.trim().length > 0
        ? data.email.trim().toLowerCase()
        : `${data.username.toLowerCase()}@nsupure.local`;

    const passwordHash = await bcrypt.hash(data.password, 12);

    const dbRoles = await prisma.role.findMany({
      where: { code: { in: data.roles } },
    });

    if (dbRoles.length === 0) {
      throw new AppError("Invalid role(s) specified", 400, "INVALID_ROLES");
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username: data.username.toLowerCase(),
          email,
          fullName: data.fullName,
          phone: data.phone || null,
          passwordHash,
          status: "ACTIVE",
        },
      });

      for (const r of dbRoles) {
        await tx.userRole.create({
          data: {
            userId: u.id,
            roleId: r.id,
          },
        });
      }

      return u;
    });

    await logAudit({
      userId: req.user?.id || newUser.id,
      action: "CREATE",
      module: "auth",
      recordId: newUser.id,
      newValue: { username: newUser.username, roles: data.roles },
      req,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          email: newUser.email,
          roles: data.roles,
        },
      },
      message: `User account ${newUser.username} created successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sales: true, productionRuns: true, payments: true },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    // Protect the primary owner account from deletion
    if (user.username === "owner") {
      throw new AppError("The primary system owner account cannot be deleted.", 400, "CANNOT_DELETE_OWNER");
    }

    // Prevent deleting own currently active session
    if (req.user?.id === user.id) {
      throw new AppError("You cannot delete your own currently logged-in account.", 400, "CANNOT_DELETE_SELF");
    }

    const hasHistory =
      user._count.sales > 0 || user._count.productionRuns > 0 || user._count.payments > 0;

    if (hasHistory) {
      // Soft delete: suspend/deactivate user so they cannot log in, but historical receipts remain intact
      const suspended = await prisma.user.update({
        where: { id },
        data: { status: "SUSPENDED" },
      });

      await logAudit({
        action: "UPDATE",
        module: "auth",
        recordId: id,
        oldValue: { status: user.status },
        newValue: { status: "SUSPENDED" },
        req,
      });

      res.json({
        success: true,
        action: "SUSPENDED",
        message: `User account ${user.username} has recorded sales/production/payment records and was suspended to preserve audit and accounting integrity.`,
        data: { user: suspended },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Hard delete: remove userRoles and user
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    await logAudit({
      action: "DELETE",
      module: "auth",
      recordId: id,
      oldValue: { username: user.username },
      req,
    });

    res.json({
      success: true,
      action: "DELETED",
      message: `User account ${user.username} was permanently deleted.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    if (user.username === "owner" && status !== "ACTIVE") {
      throw new AppError("The primary system owner account cannot be deactivated.", 400, "CANNOT_DEACTIVATE_OWNER");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    await logAudit({
      action: "UPDATE",
      module: "auth",
      recordId: id,
      oldValue: { status: user.status },
      newValue: { status },
      req,
    });

    res.json({
      success: true,
      data: { user: updated },
      message: `User ${user.username} status updated to ${status}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

