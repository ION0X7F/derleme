"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CSSProperties, FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
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

export default function AuthPanel({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") || "/dashboard",
    [searchParams]
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterForm>(emptyRegisterForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError("E-posta ve şifre zorunlu.");
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
      setError("Giriş başarısız. Bilgilerini kontrol edip tekrar dene.");
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
      setError("Tüm zorunlu alanları doldur.");
      return;
    }

    if (email !== confirmEmail) {
      setError("E-posta alanları birbiriyle eşleşmiyor.");
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
      setError(registerPayload?.error || "Kayıt sırasında bir hata oluştu.");
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
      setError(
        "Kayıt tamamlandı ama otomatik giriş başarısız oldu. Giriş yapmayı dene."
      );
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    router.push(signInResult.url || callbackUrl);
    router.refresh();
  }

  const isLogin = mode === "login";

  return (
    <div className="auth-shell" style={shellStyle}>
      <div className="auth-panel" style={panelStyle}>
        <div style={formCardStyle}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              letterSpacing: ".04em",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                background: "linear-gradient(135deg, #4f7fff, #7c5cfc)",
              }}
            >
              S
            </span>
            SellBoost AI
          </Link>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#00d4a8",
              marginBottom: 10,
            }}
          >
            {isLogin ? "Giriş Yap" : "Kayıt Ol"}
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 10px" }}>
            {isLogin ? "Tekrar hoş geldin" : "Hesabını oluştur"}
          </h1>
          <p style={{ margin: "0 0 24px", color: "#9aa3ba", fontSize: 15 }}>
            {isLogin
              ? "Raporlarına kaldığın yerden devam etmek için giriş yap."
              : "Ücretsiz başla, ilk analizini gerçek hesabınla kaydet."}
          </p>

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
                    İsim
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
                  Kullanıcı Adı
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
                    Mağaza Adı
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
                    Şirket Adı
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
                Şifre
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
                  ? "Giriş yapılıyor..."
                  : "Hesap oluşturuluyor..."
                : isLogin
                  ? "Giriş Yap"
                  : "Hesap Oluştur"}
            </button>
          </form>

          <p style={{ margin: "18px 0 0", color: "#9aa3ba", fontSize: 14 }}>
            {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}{" "}
            <Link
              href={
                isLogin
                  ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
              }
              style={{ color: "#7ea0ff", fontWeight: 700, textDecoration: "none" }}
            >
              {isLogin ? "Ücretsiz kayıt ol" : "Giriş yap"}
            </Link>
          </p>
        </div>
      </div>

      <aside className="auth-aside" style={asideStyle}>
        <div style={{ maxWidth: 520 }}>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(79,127,255,.12)",
              color: "#b8c8ff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Canlı Hesap Akışı
          </div>
          <h2 style={{ fontSize: 40, lineHeight: 1.05, margin: "0 0 14px" }}>
            {isLogin
              ? "Kayıtlı raporların ve favorilerin seni bekliyor."
              : "Sadece hesap değil, çalışma bağlamını da ilk adımda kur."}
          </h2>
          <p style={{ fontSize: 16, color: "#c0c8da", lineHeight: 1.7, margin: 0 }}>
            {isLogin
              ? "Giriş yaptığında kendi raporlarına, favorilerine ve kişisel çalışma alanına düşersin."
              : "Kullanıcı adı, telefon ve mağaza bilgisiyle başlayan kayıt akışı; sonradan profil, favoriler ve rapor ekranlarında daha tutarlı bir deneyim sağlar."}
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
