import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Building2,
  Home,
  Phone,
  Target,
  Car,
  Calendar,
  IdCard,
  User,
  Download,
  Printer,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type VisitorPassData = {
  visitorName: string;
  mobileNumber: string;
  building: string;
  flatNumber: string;
  purpose: string;
  deliveryCompany?: string;
  vehicleNumber?: string;
  photo?: string | null;
  status?: string;
};

function generateVisitorId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VIS-${y}${m}${day}-${rand}`;
}

export default function VisitorPass({
  data,
  onBack,
}: {
  data: VisitorPassData;
  onBack: () => void;
}) {
  const visitorId = useMemo(() => generateVisitorId(), []);
  const issuedAt = useMemo(() => new Date(), []);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const passRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(visitorId, {
      width: 320,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [visitorId]);

  const statusLabel =
    data.status === "Approved" || data.status === "Entry Allowed"
      ? "🟢 APPROVED"
      : "✅ DATA REGISTERED";

  const dateStr = issuedAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const node = passRef.current;
    if (!node) return;
    // Render pass into an SVG foreignObject → PNG
    const rect = node.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.margin = "0";

    // Inline computed styles (basic) — rely on tailwind classes rendered into HTML
    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, -apple-system, sans-serif;">
      ${serialized}
    </div>
  </foreignObject>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const link = document.createElement("a");
        link.download = `${visitorId}.png`;
        link.href = URL.createObjectURL(b);
        link.click();
      });
    };
    img.onerror = () => {
      // fallback: download the SVG itself
      const link = document.createElement("a");
      link.download = `${visitorId}.svg`;
      link.href = url;
      link.click();
    };
    img.src = url;
  };

  return (
    <div className="space-y-6">
      <div
        ref={passRef}
        id="visitor-pass"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]"
      >
        {/* Header strip */}
        <div className="bg-brand px-6 py-5 text-brand-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wide">
                PATEL RESIDENCY
              </span>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              VISITOR PASS
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-8 sm:px-8">
          {/* Photo */}
          <div className="flex flex-col items-center">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-brand/20 bg-muted">
              {data.photo ? (
                <img
                  src={data.photo}
                  alt="Visitor"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-mono font-semibold text-brand">
              <IdCard className="h-4 w-4" />
              {visitorId}
            </div>
          </div>

          {/* Details */}
          <dl className="mt-6 divide-y divide-border rounded-2xl border border-border">
            <Row icon={User} label="Visitor Name" value={data.visitorName} />
            <Row icon={Phone} label="Mobile Number" value={`+91 ${data.mobileNumber}`} />
            <Row icon={Building2} label="Building" value={data.building} />
            <Row icon={Home} label="Flat Number" value={data.flatNumber} />
            <Row
              icon={Target}
              label="Purpose"
              value={
                data.purpose === "Delivery" && data.deliveryCompany
                  ? `Delivery — ${data.deliveryCompany}`
                  : data.purpose
              }
            />
            {data.vehicleNumber ? (
              <Row icon={Car} label="Vehicle Number" value={data.vehicleNumber} />
            ) : null}
            <Row icon={Calendar} label="Date & Time" value={dateStr} />
          </dl>

          {/* QR */}
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-5">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Visitor QR Code"
                className="h-44 w-44 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="h-44 w-44 animate-pulse rounded-lg bg-muted" />
            )}
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {visitorId}
            </p>
          </div>

          {/* Status badge */}
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-success/15 px-4 py-4 text-success ring-2 ring-success/30">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-bold tracking-wide">
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid gap-3 print:hidden sm:grid-cols-3">
        <Button
          onClick={handleDownload}
          className="h-12 rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Pass
        </Button>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="h-12 rounded-2xl"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Pass
        </Button>
        <Button
          onClick={onBack}
          variant="ghost"
          className="h-12 rounded-2xl"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-right text-sm font-semibold text-foreground">
          {value}
        </span>
      </div>
    </div>
  );
}