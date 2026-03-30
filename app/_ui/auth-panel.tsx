"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CSSProperties, FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import {
  getPlanDisplayName,
  isAppPlanId,
  isPaidPlanId,
  type AppPlanId,
} from "@/lib/plans";
import { extractSafeCallbackPathFromUrl } from "@/lib/auth-callback";

type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
  callbackUrlOverride?: string;
  context?: "default" | "admin";
};

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "minmax(0, 560px) minmax(0, 1fr)",
  background:
    "radial-gradient(circle at top, rgba(79,127,255,.16), transparent 28%), #09090e",
  color: "#f7f8fb",
};

const panelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 24px",
};

const formCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  padding: 32,
  borderRadius: 24,
  background: "rgba(17,19,28,.94)",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow: "0 24px 60px rgba(0,0,0,.28)",
};

const asideStyle: CSSProperties = {
  padding: "64px 56px",
  borderLeft: "1px solid rgba(255,255,255,.06)",
  background:
    "linear-gradient(180deg, rgba(79,127,255,.1), rgba(124,92,252,.06) 45%, rgba(9,9,14,.5))",
  display: "flex",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  padding: "0 14px",
  fontSize: 14,
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 700,
  color: "#a8b0c5",
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "none",
  background: "#4f7fff",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

type RegisterForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  confirmEmail: string;
  phone: string;
  storeName: string;
  companyName: string;
  password: string;
};

const emptyRegisterForm: RegisterForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  confirmEmail: "",
  phone: "",
  storeName: "",
  companyName: "",
  password: "",
};

export default function AuthPanel({
  mode,
  callbackUrlOverride,
  context = "default",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlanId = useMemo<AppPlanId | null>(() => {
    const rawPlan = searchParams.get("plan");
    return isAppPlanId(rawPlan) ? rawPlan : null;
  }, [searchParams]);
  const callbackUrl = useMemo(
    () =>
      extractSafeCallbackPathFromUrl(
        callbackUrlOverride || searchParams.get("callbackUrl") || "/dashboard"
      ),
    [callbackUrlOverride, searchParams]
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterForm>(emptyRegisterForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";
  const isAdminContext = context === "admin";

  function setRegisterField<K extends keyof RegisterForm>(
    key: K,
    value: RegisterForm[K]
  ) {
    setRegisterForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;

    if (!email || !password) {
      setError("E-posta ve sifre zorunlu.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!result || result.error) {
      setError("Giris basarisiz. Bilgilerini kontrol edip tekrar dene.");
      return;
    }

    if (selectedPlanId && isPaidPlanId(selectedPlanId)) {
      router.push(`/checkout?plan=${encodeURIComponent(selectedPlanId)}`);
      router.refresh();
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const firstName = registerForm.firstName.trim();
    const lastName = registerForm.lastName.trim();
    const username = registerForm.username.trim().toLowerCase();
    const email = registerForm.email.trim().toLowerCase();
    const confirmEmail = registerForm.confirmEmail.trim().toLowerCase();
    const phone = registerForm.phone.trim();
    const storeName = registerForm.storeName.trim();
    const companyName = registerForm.companyName.trim();
    const password = registerForm.password;
    const name = `${firstName} ${lastName}`.trim();

    if (
      !firstName ||
      !lastName ||
      !username ||
      !email ||
      !confirmEmail ||
      !phone ||
      !password
    ) {
      setError("Tum zorunlu alanlari doldur.");
      return;
    }

    if (email !== confirmEmail) {
      setError("E-posta alanlari birbiriyle eslesmiyor.");
      return;
    }

    setLoading(true);
    setError(null);

    const registerRes = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        username,
        email,
        phone,
        storeName,
        companyName,
        password,
      }),
    });

    const registerPayload = await registerRes.json().catch(() => null);

    if (!registerRes.ok) {
      setLoading(false);
      setError(registerPayload?.error || "Kayit sirasinda bir hata olustu.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!signInResult || signInResult.error) {
      setError("Kayit tamamlandi ama otomatik giris basarisiz oldu.");
      router.push(
        `/login?callbackUrl=${encodeURIComponent(callbackUrl)}${
          selectedPlanId ? `&plan=${encodeURIComponent(selectedPlanId)}` : ""
        }`
      );
      return;
    }

    if (selectedPlanId && isPaidPlanId(selectedPlanId)) {
      router.push(`/checkout?plan=${encodeURIComponent(selectedPlanId)}`);
      router.refresh();
      return;
    }

    router.push(signInResult.url || callbackUrl);
    router.refresh();
  }

  const eyebrowCopy = isAdminContext
    ? "Admin Girisi"
    : isLogin
      ? "Giris Yap"
      : "Kayit Ol";
  const titleCopy = isAdminContext
    ? "Yonetim alanina giris yap"
    : isLogin
      ? "Tekrar hos geldin"
      : "Hesabini olustur";
  const introCopy = isAdminContext
    ? "Bu alan sadece yetkili admin hesaplarina aciktir."
    : isLogin
      ? "Raporlarina kaldigin yerden devam etmek icin giris yap."
      : "Ucretsiz basla, ilk analizini gercek hesabinla kaydet.";
  const asideBadgeCopy = isAdminContext
    ? "Guvenli Admin Erisimi"
    : "Canli Hesap Akisi";
  const asideTitleCopy = isAdminContext
    ? "Dashboard, kullanici yonetimi ve sistem kayitlari tek panelde."
    : isLogin
      ? "Kayitli raporlarin ve favorilerin seni bekliyor."
      : "Sadece hesap degil, calisma baglamini da ilk adimda kur.";
  const asideBodyCopy = isAdminContext
    ? "Giris yaptiktan sonra sadece ADMIN yetkili hesaplar paneli gorebilir. Diger hesaplar ana sayfaya yonlendirilir."
    : isLogin
      ? "Giris yaptiginda kendi raporlarina, favorilerine ve kisisel calisma alanina dusersin."
      : "Kullanici adi, telefon ve magaza bilgisiyle baslayan kayit akisi; sonradan profil, favoriler ve rapor ekranlarinda daha tutarli bir deneyim saglar.";

  return (
    <div className="auth-shell" style={shellStyle}>
      <div className="auth-panel" style={panelStyle}>
        <div style={formCardStyle}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              letterSpacing: ".04em",
            }}
          >
            <Image
              src="/brand/sellboost-logo.png"
              alt="SellBoost"
              width={210}
              height={59}
              style={{ width: 210, height: "auto", display: "block" }}
            />
          </Link>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: isAdminContext ? "#ff8b8b" : "#00d4a8",
              marginBottom: 10,
            }}
          >
            {eyebrowCopy}
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 10px" }}>
            {titleCopy}
          </h1>
          <p style={{ margin: "0 0 24px", color: "#9aa3ba", fontSize: 15 }}>
            {introCopy}
          </p>

          {selectedPlanId && isPaidPlanId(selectedPlanId) ? (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(79,127,255,.24)",
                background: "rgba(79,127,255,.1)",
                color: "#dbe6ff",
                fontSize: 14,
              }}
            >
              Secilen plan: <strong>{getPlanDisplayName(selectedPlanId)}</strong>.{" "}
              Kayit veya giris tamamlaninca odeme adimina yonlendirileceksin.
            </div>
          ) : null}

          <form onSubmit={isLogin ? handleLoginSubmit : handleRegisterSubmit}>
            {!isLogin ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label htmlFor="firstName" style={labelStyle}>
                    Isim
                  </label>
                  <input
                    id="firstName"
                    value={registerForm.firstName}
                    onChange={(event) =>
                      setRegisterField("firstName", event.target.value)
                    }
                    style={inputStyle}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" style={labelStyle}>
                    Soyisim
                  </label>
                  <input
                    id="lastName"
                    value={registerForm.lastName}
                    onChange={(event) =>
                      setRegisterField("lastName", event.target.value)
                    }
                    style={inputStyle}
                    autoComplete="family-name"
                  />
                </div>
              </div>
            ) : null}

            {!isLogin ? (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="username" style={labelStyle}>
                  Kullanici Adi
                </label>
                <input
                  id="username"
                  value={registerForm.username}
                  onChange={(event) =>
                    setRegisterField("username", event.target.value)
                  }
                  style={inputStyle}
                  autoComplete="username"
                  placeholder="sefayildiz"
                />
              </div>
            ) : null}

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="email" style={labelStyle}>
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={isLogin ? loginEmail : registerForm.email}
                onChange={(event) =>
                  isLogin
                    ? setLoginEmail(event.target.value)
                    : setRegisterField("email", event.target.value)
                }
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            {!isLogin ? (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="confirmEmail" style={labelStyle}>
                  E-posta Tekrar
                </label>
                <input
                  id="confirmEmail"
                  type="email"
                  value={registerForm.confirmEmail}
                  onChange={(event) =>
                    setRegisterField("confirmEmail", event.target.value)
                  }
                  style={inputStyle}
                  autoComplete="email"
                />
              </div>
            ) : null}

            {!isLogin ? (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="phone" style={labelStyle}>
                  Cep Telefonu
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={registerForm.phone}
                  onChange={(event) =>
                    setRegisterField("phone", event.target.value)
                  }
                  style={inputStyle}
                  autoComplete="tel"
                  placeholder="05xx xxx xx xx"
                />
              </div>
            ) : null}

            {!isLogin ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label htmlFor="storeName" style={labelStyle}>
                    Magaza Adi
                  </label>
                  <input
                    id="storeName"
                    value={registerForm.storeName}
                    onChange={(event) =>
                      setRegisterField("storeName", event.target.value)
                    }
                    style={inputStyle}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label htmlFor="companyName" style={labelStyle}>
                    Sirket Adi
                  </label>
                  <input
                    id="companyName"
                    value={registerForm.companyName}
                    onChange={(event) =>
                      setRegisterField("companyName", event.target.value)
                    }
                    style={inputStyle}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
            ) : null}

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="password" style={labelStyle}>
                Sifre
              </label>
              <input
                id="password"
                type="password"
                value={isLogin ? loginPassword : registerForm.password}
                onChange={(event) =>
                  isLogin
                    ? setLoginPassword(event.target.value)
                    : setRegisterField("password", event.target.value)
                }
                style={inputStyle}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            {error ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,.25)",
                  background: "rgba(239,68,68,.08)",
                  color: "#ffb4b4",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading
                ? isLogin
                  ? "Giris yapiliyor..."
                  : "Hesap olusturuluyor..."
                : isLogin
                  ? "Giris Yap"
                  : "Hesap Olustur"}
            </button>
          </form>

          {!isAdminContext ? (
            <p style={{ margin: "18px 0 0", color: "#9aa3ba", fontSize: 14 }}>
              {isLogin ? "Hesabin yok mu?" : "Zaten hesabin var mi?"}{" "}
              <Link
                href={
                  isLogin
                    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}${
                        selectedPlanId ? `&plan=${encodeURIComponent(selectedPlanId)}` : ""
                      }`
                    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}${
                        selectedPlanId ? `&plan=${encodeURIComponent(selectedPlanId)}` : ""
                      }`
                }
                style={{ color: "#7ea0ff", fontWeight: 700, textDecoration: "none" }}
              >
                {isLogin ? "Ucretsiz kayit ol" : "Giris yap"}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <aside className="auth-aside" style={asideStyle}>
        <div style={{ maxWidth: 520 }}>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 12px",
              borderRadius: 999,
              background: isAdminContext
                ? "rgba(232,77,77,.12)"
                : "rgba(79,127,255,.12)",
              color: isAdminContext ? "#ffb4b4" : "#b8c8ff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {asideBadgeCopy}
          </div>
          <h2 style={{ fontSize: 40, lineHeight: 1.05, margin: "0 0 14px" }}>
            {asideTitleCopy}
          </h2>
          <p style={{ fontSize: 16, color: "#c0c8da", lineHeight: 1.7, margin: 0 }}>
            {asideBodyCopy}
          </p>
        </div>
      </aside>

      <style jsx>{`
        @media (max-width: 960px) {
          .auth-shell {
            grid-template-columns: 1fr;
          }

          .auth-panel {
            padding: 28px 18px;
          }

          .auth-aside {
            border-left: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding: 32px 20px 40px;
          }
        }
      `}</style>
    </div>
  );
}
