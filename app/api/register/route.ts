import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PlanCode, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = body?.name?.trim();
    const email = body?.email?.trim()?.toLowerCase();
    const password = body?.password;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Ad, email ve sifre zorunlu." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Sifre en az 6 karakter olmali." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu email ile kayitli kullanici var." },
        { status: 409 }
      );
    }

    const freePlan = await prisma.plan.upsert({
      where: { code: PlanCode.FREE },
      update: {
        name: "Free",
        description: "Temel Trendyol analizi",
        monthlyAnalysisLimit: 10,
        reportsHistoryLimit: 5,
        canExportReports: false,
        canUseAdvancedAi: false,
        canReanalyze: false,
        priceMonthly: 0,
        isActive: true,
      },
      create: {
        code: PlanCode.FREE,
        name: "Free",
        description: "Temel Trendyol analizi",
        monthlyAnalysisLimit: 10,
        reportsHistoryLimit: 5,
        canExportReports: false,
        canUseAdvancedAi: false,
        canReanalyze: false,
        priceMonthly: 0,
        isActive: true,
      },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        plan: "FREE",
        subscription: {
          create: {
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
      },
    });

    return NextResponse.json(
      { message: "Kayit basarili.", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("REGISTER_ERROR", error);

    return NextResponse.json(
      { error: "Kayit sirasinda bir hata olustu." },
      { status: 500 }
    );
  }
}
