import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ShieldCheck,
  Camera,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  KeyRound,
  DoorOpen,
  PhoneOff,
  ShieldAlert,
  UserCheck,
  Pencil,
  ArrowRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  submitVisitorEntry,
  lookupVisitor,
  type Status,
} from "@/lib/visitor.functions";
import VisitorPass, { type VisitorPassData } from "./VisitorPass";

const BUILDINGS = ["A", "B", "C"] as const;
type BuildingKey = (typeof BUILDINGS)[number];

function generateFlats(block: BuildingKey): string[] {
  const flats: string[] = [];
  for (let f = 1; f <= 7; f++) {
    for (let n = 1; n <= 4; n++) {
      flats.push(`${block}${f}0${n}`);
    }
  }
  return flats;
}

const PURPOSES = [
  "Guest",
  "Relative",
  "Friend",
  "Maintenance",
  "Electrician",
  "Plumber",
  "Carpenter",
  "AC Service",
  "Internet Service",
  "Gas Service",
  "Water Service",
  "Courier",
  "Delivery",
];

const DELIVERY_COMPANIES = [
  "Zomato",
  "Swiggy",
  "Zepto",
  "Blinkit",
  "Amazon",
  "Flipkart",
  "Porter",
  "Blue Dart",
  "DTDC",
  "Delhivery",
  "Other",
];

const STATUS_META: Record<
  Status,
  { icon: React.ComponentType<{ className?: string }>; tone: string; ring: string; desc: string }
> = {
  "Pending Approval": {
    icon: Clock,
    tone: "text-warning bg-warning/10",
    ring: "ring-warning/30",
    desc: "The resident has been notified. Waiting for their response.",
  },
  Approved: {
    icon: CheckCircle2,
    tone: "text-success bg-success/10",
    ring: "ring-success/30",
    desc: "The resident has approved your visit.",
  },
  Rejected: {
    icon: XCircle,
    tone: "text-danger bg-danger/10",
    ring: "ring-danger/30",
    desc: "The resident has declined your entry.",
  },
  "Delivery Timeout": {
    icon: AlertTriangle,
    tone: "text-warning bg-warning/10",
    ring: "ring-warning/30",
    desc: "The resident didn't respond in time. Please try again or leave at the gate.",
  },
  "Owner Not Responding": {
    icon: PhoneOff,
    tone: "text-warning bg-warning/10",
    ring: "ring-warning/30",
    desc: "We couldn't reach the resident. Please try again shortly.",
  },
  "Entry Allowed": {
    icon: DoorOpen,
    tone: "text-success bg-success/10",
    ring: "ring-success/30",
    desc: "Please proceed to the flat. Have a great visit!",
  },
  "OTP Required": {
    icon: KeyRound,
    tone: "text-brand bg-brand/10",
    ring: "ring-brand/30",
    desc: "Please enter the OTP shared by the resident.",
  },
  "OTP Verified": {
    icon: ShieldCheck,
    tone: "text-success bg-success/10",
    ring: "ring-success/30",
    desc: "OTP verified successfully. You may enter.",
  },
  "Invalid OTP": {
    icon: ShieldAlert,
    tone: "text-danger bg-danger/10",
    ring: "ring-danger/30",
    desc: "The OTP you entered is invalid. Please try again.",
  },
};

type Screen = "identify" | "form" | "loading" | "status" | "pass";

type KnownVisitor = {
  visitorId: string;
  visitorName: string;
  vehicleNumberMasked: string;
  hasVehicle: boolean;
  previousVisits: number;
};

const STORAGE_KEY = "patel-residency:visitor";
const PASS_STATUSES: Status[] = [
  "Approved",
  "Pending Approval",
  "Entry Allowed",
  "OTP Verified",
];

export default function VisitorRegistration() {
  const [visitorName, setVisitorName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [building, setBuilding] = useState<BuildingKey | "">("");
  const [flatNumber, setFlatNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [deliveryCompany, setDeliveryCompany] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [screen, setScreen] = useState<Screen>("identify");
  const [status, setStatus] = useState<Status | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [passData, setPassData] = useState<VisitorPassData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Returning-visitor lookup
  const [known, setKnown] = useState<KnownVisitor | null>(null);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  const flats = useMemo(
    () => (building ? generateFlats(building) : []),
    [building],
  );

  useEffect(() => {
    setFlatNumber("");
  }, [building]);

  // Prefill from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<VisitorPassData>;
      if (saved.visitorName) setVisitorName(saved.visitorName);
      if (saved.mobileNumber) setMobileNumber(saved.mobileNumber);
      if (saved.vehicleNumber) setVehicleNumber(saved.vehicleNumber);
      if (saved.photo) setPhoto(saved.photo);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const keepSavedVehicle = Boolean(
    known?.hasVehicle && !editingProfile && !vehicleNumber.trim(),
  );

  const handleLookup = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setLookupError("");
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      setLookupError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setSearching(true);
    try {
      const res = await lookupVisitor({ data: { mobileNumber } });
      if (res.found) {
        setKnown({
          visitorId: res.visitorId,
          visitorName: res.visitorName,
          vehicleNumberMasked: res.vehicleNumberMasked,
          hasVehicle: res.hasVehicle,
          previousVisits: res.previousVisits,
        });
        setVisitorName(res.visitorName);
        setVehicleNumber("");
        if (res.photo) setPhoto(res.photo);
        setEditingProfile(false);
      } else {
        setKnown(null);
        setEditingProfile(true);
      }
      setErrors({});
      setScreen("form");
    } catch {
      setLookupError("Could not check your number. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!visitorName.trim()) e.visitorName = "Please enter your name";
    if (!/^[6-9]\d{9}$/.test(mobileNumber))
      e.mobileNumber = "Enter a valid 10-digit Indian mobile number";
    if (!building) e.building = "Select a building";
    if (!flatNumber) e.flatNumber = "Select a flat";
    if (!purpose) e.purpose = "Select purpose of visit";
    if (purpose === "Delivery" && !deliveryCompany)
      e.deliveryCompany = "Select delivery company";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const payload = {
      visitorName,
      mobileNumber,
      building: building ? `${building} Block` : "",
      flatNumber,
      purpose,
      deliveryCompany: purpose === "Delivery" ? deliveryCompany : "",
      vehicleNumber,
      photo,
    };

    setScreen("loading");
    setStatus(null);
    setStatusMessage("");

    try {
      const result = await submitVisitorEntry({
        data: { ...payload, keepSavedVehicle },
      });
      setStatus(result.status);
      setStatusMessage(result.message);

      const finalPayload = { ...payload, vehicleNumber: result.vehicleNumber };

      // Persist for next visit
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPayload));
      } catch {
        // ignore
      }

      if (PASS_STATUSES.includes(result.status)) {
        setPassData({ ...finalPayload, status: result.status });
        setScreen("pass");
      } else {
        setScreen("status");
      }
    } catch {
      setStatus("Owner Not Responding");
      setScreen("status");
    }
  };

  const resetAll = () => {
    setScreen("identify");
    setStatus(null);
    setPassData(null);
    setErrors({});
    setKnown(null);
    setEditingProfile(false);
    setLookupError("");
    setMobileNumber("");
    setVisitorName("");
    setVehicleNumber("");
    setBuilding("");
    setFlatNumber("");
    setPurpose("");
    setDeliveryCompany("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-soft via-background to-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-[var(--shadow-soft)]">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            🏢 Welcome to Patel Residency
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Please register your visit before entering the society.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand">
            <ShieldCheck className="h-4 w-4" />
            Secure visitor entry
          </div>
        </header>

        {screen === "identify" && (
          <form
            onSubmit={handleLookup}
            className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
          >
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Search className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  Start with your mobile number
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you have visited before, we&apos;ll fill in your details for you.
                </p>
              </div>

              <Field label="Mobile Number" error={lookupError}>
                <div className="flex items-stretch overflow-hidden rounded-xl border border-input focus-within:ring-2 focus-within:ring-ring">
                  <span className="grid place-items-center bg-muted px-3 text-sm font-medium text-muted-foreground">
                    +91
                  </span>
                  <Input
                    value={mobileNumber}
                    onChange={(e) =>
                      setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    autoFocus
                    className="h-12 rounded-none border-0 focus-visible:ring-0"
                    autoComplete="tel-national"
                  />
                </div>
              </Field>

              <Button
                type="submit"
                disabled={searching}
                className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground shadow-[var(--shadow-soft)] hover:bg-brand/90"
              >
                {searching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Checking your number...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Your details are stored securely and shown only at the gate.
              </p>
            </div>
          </form>
        )}

        {screen === "form" && (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
          >
            <div className="space-y-5">
              {known && (
                <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Welcome back, {known.visitorName}!
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {known.previousVisits > 0
                          ? `${known.previousVisits} previous visit${known.previousVisits > 1 ? "s" : ""} on record. `
                          : ""}
                        {known.hasVehicle
                          ? `Saved vehicle: ${known.vehicleNumberMasked}. `
                          : ""}
                        Just tell us about today&apos;s visit.
                      </p>
                      {!editingProfile && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingProfile(true)}
                          className="mt-2 h-8 rounded-lg px-2 text-xs text-brand hover:text-brand"
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Update my details
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Field label="Visitor Name" error={errors.visitorName}>
                {known && !editingProfile ? (
                  <div className="flex h-12 items-center rounded-xl border border-input bg-muted/50 px-3 text-sm font-medium text-foreground">
                    {visitorName}
                  </div>
                ) : (
                  <Input
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="h-12 rounded-xl"
                    autoComplete="name"
                  />
                )}
              </Field>

              <Field label="Mobile Number" error={errors.mobileNumber}>
                <div className="flex items-center gap-2">
                  <div className="flex h-12 flex-1 items-center rounded-xl border border-input bg-muted/50 px-3 text-sm font-medium text-foreground">
                    +91 {mobileNumber}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetAll}
                    className="h-12 rounded-xl"
                  >
                    Change
                  </Button>
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Building" error={errors.building}>
                  <Select
                    value={building}
                    onValueChange={(v) => setBuilding(v as BuildingKey)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select block" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDINGS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b} Block
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Flat Number" error={errors.flatNumber}>
                  <Select
                    value={flatNumber}
                    onValueChange={setFlatNumber}
                    disabled={!building}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue
                        placeholder={building ? "Select flat" : "Pick block first"}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {flats.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Purpose of Visit" error={errors.purpose}>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {purpose === "Delivery" && (
                <Field label="Delivery Company" error={errors.deliveryCompany}>
                  <Select value={deliveryCompany} onValueChange={setDeliveryCompany}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_COMPANIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Vehicle Number (optional)">
                {known?.hasVehicle && !editingProfile ? (
                  <div className="flex h-12 items-center justify-between rounded-xl border border-input bg-muted/50 px-3">
                    <span className="text-sm font-medium text-foreground">
                      {known.vehicleNumberMasked}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(true)}
                      className="text-xs font-medium text-brand"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. GJ01AB1234"
                    className="h-12 rounded-xl"
                  />
                )}
              </Field>

              <Field label="Visitor Photo">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                />
                {photo ? (
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
                    <img
                      src={photo}
                      alt="Visitor"
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-xl"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retake
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPhoto(null)}
                        className="rounded-xl text-danger hover:text-danger"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition hover:border-brand hover:bg-brand/5"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                      <Camera className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Tap to open camera
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Take a clear selfie for verification
                    </p>
                  </button>
                )}
              </Field>

              <Button
                type="submit"
                className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground shadow-[var(--shadow-soft)] hover:bg-brand/90"
              >
                Register Visitor
              </Button>
            </div>
          </form>
        )}

        {screen === "loading" && (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand/10 text-brand">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-foreground">
              Submitting your request...
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we contact the resident.
            </p>
          </div>
        )}

        {screen === "status" && status && (
          <StatusCard
            status={status}
            message={statusMessage}
            onReset={resetAll}
          />
        )}

        {screen === "pass" && passData && (
          <VisitorPass data={passData} onBack={resetAll} />
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Powered by Smart Entry AI</p>
          <p className="mt-1">Visitor Management System</p>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

function StatusCard({
  status,
  message,
  onReset,
}: {
  status: Status;
  message?: string;
  onReset: () => void;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div
      className={`rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)] ring-4 ${meta.ring}`}
    >
      <div
        className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${meta.tone}`}
      >
        <Icon className="h-10 w-10" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">{status}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message || meta.desc}</p>
      <Button
        onClick={onReset}
        className="mt-8 h-12 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
      >
        New Registration
      </Button>
    </div>
  );
}