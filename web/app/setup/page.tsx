"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const STEPS = [
  { label: "Willkommen" },
  { label: "Profil" },
  { label: "KI" },
  { label: "Fertig" },
];

// ──────────────────────────────────────────────
// Setup Wizard Page
// ──────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Redirect if setup already complete
  useEffect(() => {
    async function check() {
      try {
        const res = await api.getSetupStatus();
        if (res.setup_complete) {
          router.replace("/");
        }
      } catch {
        // ignore — backend may not be ready
      }
    }
    check();
  }, [router]);

  // ── Validation ──

  const profileValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes("@") &&
    password.length >= 8 &&
    password === passwordConfirm;

  // ── Submit ──

  async function handleSetup() {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.setup({
        name: name.trim(),
        email: email.trim(),
        password,
        anthropic_api_key: apiKey.trim() || undefined,
        locale: "de",
      });
      setStep(3);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Setup fehlgeschlagen";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Steps ──

  function renderStep() {
    switch (step) {
      case 0:
        return <StepWelcome onNext={() => setStep(1)} />;
      case 1:
        return (
          <StepProfile
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            passwordConfirm={passwordConfirm}
            setPasswordConfirm={setPasswordConfirm}
            valid={profileValid}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        );
      case 2:
        return (
          <StepApiKey
            apiKey={apiKey}
            setApiKey={setApiKey}
            onSubmit={handleSetup}
            onBack={() => setStep(1)}
            isSubmitting={isSubmitting}
            error={error}
          />
        );
      case 3:
        return <StepDone onStart={() => router.push("/")} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4"
         style={{ backgroundColor: "#09090b" }}>
      {/* Stepper */}
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors"
              style={{
                backgroundColor: i <= step ? "#f97316" : "#27272a",
                color: i <= step ? "#fff" : "#71717a",
              }}
            >
              {i + 1}
            </div>
            <span
              className="hidden text-xs sm:inline"
              style={{ color: i <= step ? "#f97316" : "#71717a" }}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className="mx-1 h-px w-8"
                style={{
                  backgroundColor: i < step ? "#f97316" : "#27272a",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="w-full max-w-md">{renderStep()}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Step Components
// ──────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Logo */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black"
        style={{ backgroundColor: "#f97316", color: "#fff" }}
      >
        P
      </div>
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "#fafafa" }}>
          Willkommen bei PAIONE
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#a1a1aa" }}>
          The personal AI that evolves with you.
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#71717a" }}>
        In wenigen Schritten richtest du dein PAIONE ein.
        Danach steht dir dein persoenlicher KI-Assistent zur Verfuegung.
      </p>
      <Button
        onClick={onNext}
        className="mt-2 w-full cursor-pointer"
        style={{ backgroundColor: "#f97316", color: "#fff" }}
      >
        Weiter
      </Button>
    </div>
  );
}

function StepProfile({
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  passwordConfirm,
  setPasswordConfirm,
  valid,
  onNext,
  onBack,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (v: string) => void;
  valid: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const passwordTooShort = password.length > 0 && password.length < 8;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: "#fafafa" }}>
          Dein Profil
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#71717a" }}>
          Erstelle dein Benutzerkonto.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" style={{ color: "#a1a1aa" }}>
            Name
          </Label>
          <Input
            id="name"
            placeholder="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" style={{ color: "#a1a1aa" }}>
            E-Mail
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" style={{ color: "#a1a1aa" }}>
            Passwort
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Mindestens 8 Zeichen"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
          {passwordTooShort && (
            <p className="text-xs" style={{ color: "#ef4444" }}>
              Passwort muss mindestens 8 Zeichen lang sein.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password-confirm" style={{ color: "#a1a1aa" }}>
            Passwort bestaetigen
          </Label>
          <Input
            id="password-confirm"
            type="password"
            placeholder="Passwort wiederholen"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
          {passwordMismatch && (
            <p className="text-xs" style={{ color: "#ef4444" }}>
              Passwoerter stimmen nicht ueberein.
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 cursor-pointer border-zinc-700 text-zinc-400 hover:bg-zinc-800"
        >
          Zurueck
        </Button>
        <Button
          onClick={onNext}
          disabled={!valid}
          className="flex-1 cursor-pointer"
          style={{
            backgroundColor: valid ? "#f97316" : "#3f3f46",
            color: "#fff",
          }}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}

function StepApiKey({
  apiKey,
  setApiKey,
  onSubmit,
  onBack,
  isSubmitting,
  error,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: "#fafafa" }}>
          KI verbinden
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#71717a" }}>
          Verbinde deinen Anthropic API Key.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="api-key" style={{ color: "#a1a1aa" }}>
            Anthropic API Key
          </Label>
          <Input
            id="api-key"
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoFocus
            className="border-zinc-700 bg-zinc-900 font-mono text-zinc-100 placeholder:text-zinc-600"
          />
          <p className="text-xs" style={{ color: "#71717a" }}>
            Erstelle einen Key unter{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "#f97316" }}
            >
              console.anthropic.com
            </a>
          </p>
          <p className="text-xs" style={{ color: "#52525b" }}>
            Optional -- kann spaeter in den Settings eingetragen werden.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-md px-3 py-2 text-sm"
          style={{ backgroundColor: "#451a03", color: "#fbbf24" }}
        >
          {error}
        </div>
      )}

      <div className="mt-2 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 cursor-pointer border-zinc-700 text-zinc-400 hover:bg-zinc-800"
        >
          Zurueck
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 cursor-pointer"
          style={{ backgroundColor: "#f97316", color: "#fff" }}
        >
          {isSubmitting ? "Wird eingerichtet..." : "Einrichten"}
        </Button>
      </div>
    </div>
  );
}

function StepDone({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Checkmark */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
        style={{ backgroundColor: "#14532d", color: "#4ade80" }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "#fafafa" }}>
          PAIONE ist bereit.
        </h2>
        <p className="mt-2 text-sm" style={{ color: "#a1a1aa" }}>
          Dein persoenlicher KI-Assistent wartet auf dich.
        </p>
      </div>
      <Button
        onClick={onStart}
        className="mt-2 w-full cursor-pointer"
        style={{ backgroundColor: "#f97316", color: "#fff" }}
      >
        Los geht&apos;s
      </Button>
    </div>
  );
}
