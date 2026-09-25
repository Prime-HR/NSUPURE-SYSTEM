import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const updateSettingsSchema = z.object({
  settings: z.record(z.string()),
});

export const wizardStepSchema = z.object({
  stepNumber: z.number().min(1).max(12),
  stepName: z.string(),
  data: z.record(z.unknown()),
});

export async function getAllSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settingsList = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settingsList) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      success: true,
      data: {
        settings: settingsMap,
        raw: settingsList,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { settings } = req.body;
    if (settings.qc_required_test_types !== undefined) {
      const types = settings.qc_required_test_types.split(",").map((value: string) => value.trim());
      const allowed = ["MICROBIOLOGICAL", "PHYSICOCHEMICAL", "PH", "NET_VOLUME", "CONDUCTIVITY", "OTHER"];
      if (!types.length || types.some((type: string) => !allowed.includes(type))) throw new AppError("Select supported required quality test types.", 400, "INVALID_QC_POLICY");
      settings.qc_required_test_types = Array.from(new Set(types)).join(",");
    }

    const updatedKeys: string[] = [];
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: {
          value: String(value),
          updatedBy: req.user?.username,
        },
        create: {
          key,
          value: String(value),
          category: "GENERAL",
          description: "Configured via settings",
          updatedBy: req.user?.username,
        },
      });
      updatedKeys.push(key);
    }

    await logAudit({
      action: "UPDATE",
      module: "settings",
      newValue: settings,
      req,
    });

    res.json({
      success: true,
      message: `Updated ${updatedKeys.length} settings successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function saveWizardStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stepNumber, stepName, data } = req.body;

    // Store wizard progress in settings
    await prisma.setting.upsert({
      where: { key: `wizard_step_${stepNumber}` },
      update: {
        value: JSON.stringify({ completed: true, updatedAt: new Date(), data }),
        updatedBy: req.user?.username,
      },
      create: {
        key: `wizard_step_${stepNumber}`,
        value: JSON.stringify({ completed: true, updatedAt: new Date(), data }),
        category: "WIZARD",
        description: `Step ${stepNumber}: ${stepName}`,
        updatedBy: req.user?.username,
      },
    });

    // If step 7: Opening cash
    if (stepNumber === 7 && typeof data.openingCash === "number") {
      await prisma.openingBalance.create({
        data: {
          category: "CASH",
          accountOrItemRef: "Factory Safe / Till",
          amount: data.openingCash,
          asOfDate: new Date(),
          notes: "Recorded via Setup Wizard Step 7",
          verifiedBy: req.user?.username,
        },
      });
    }

    // If step 10: Opening debt (e.g. GH₵30,000)
    if (stepNumber === 10 && data.confirmDebt === true && typeof data.debtAmount === "number") {
      await prisma.loan.create({
        data: {
          loanCode: "LOAN-INIT-001",
          lenderName: String(data.lenderName || "Initial Business Liability"),
          purpose: "Initial business setup liability",
          originalPrincipal: data.debtAmount,
          currentBalance: data.debtAmount,
          isManagementConfirmed: true,
          status: "ACTIVE",
        },
      });
    }

    await logAudit({
      action: "CREATE",
      module: "wizard",
      recordId: `step_${stepNumber}`,
      newValue: { stepNumber, stepName },
      req,
    });

    res.json({
      success: true,
      message: `Setup Wizard Step ${stepNumber} saved successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getWizardStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wizardSettings = await prisma.setting.findMany({
      where: { category: "WIZARD" },
    });

    const stepsCompleted: Record<number, boolean> = {};
    for (let i = 1; i <= 12; i++) {
      stepsCompleted[i] = false;
    }

    for (const ws of wizardSettings) {
      const match = ws.key.match(/wizard_step_(\d+)/);
      if (match) {
        stepsCompleted[parseInt(match[1], 10)] = true;
      }
    }

    res.json({
      success: true,
      data: {
        stepsCompleted,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
