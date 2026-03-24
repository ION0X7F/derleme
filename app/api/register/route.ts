import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json(
        { error: "Ad 2 ile 60 karakter arasinda olmali." },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Gecerli bir email adresi girin." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Sifre en az 6 karakter olmali." },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "Sifre en fazla 128 karakter olabilir." },
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
      where: { code: "FREE" },
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
        code: "FREE",
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
            status: "ACTIVE",
            variant: "FREE",
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
