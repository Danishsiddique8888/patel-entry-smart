import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Status =
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Delivery Timeout"
  | "Owner Not Responding"
  | "Entry Allowed"
  | "OTP Required"
  | "OTP Verified"
  | "Invalid OTP";

const STATUS_VALUES: Status[] = [
  "Pending Approval",
  "Approved",
  "Rejected",
  "Delivery Timeout",
  "Owner Not Responding",
  "Entry Allowed",
  "OTP Required",
  "OTP Verified",
  "Invalid OTP",
];

const MOBILE_RE = /^[6-9]\d{9}$/;

function maskVehicle(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  if (v.length <= 4) return v;
  return `${"•".repeat(Math.max(2, v.length - 4))}${v.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* Lookup a returning visitor by mobile number                         */
/* ------------------------------------------------------------------ */

export const lookupVisitor = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ mobileNumber: z.string().regex(MOBILE_RE) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("visitor_profiles")
      .select("id, visitor_name, vehicle_number, photo")
      .eq("mobile_number", data.mobileNumber)
      .maybeSingle();

    if (error) {
      return { found: false as const, error: "lookup_failed" };
    }
    if (!profile) {
      return { found: false as const };
    }

    const { count } = await supabaseAdmin
      .from("visit_records")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", profile.id);

    return {
      found: true as const,
      visitorId: profile.id as string,
      visitorName: profile.visitor_name as string,
      vehicleNumberMasked: maskVehicle(profile.vehicle_number),
      hasVehicle: Boolean(profile.vehicle_number),
      photo: (profile.photo as string | null) ?? null,
      previousVisits: count ?? 0,
    };
  });

/* ------------------------------------------------------------------ */
/* Submit a visit (creates/updates profile + a new visit record)       */
/* ------------------------------------------------------------------ */

const submitSchema = z.object({
  visitorName: z.string(),
  mobileNumber: z.string(),
  building: z.string(),
  flatNumber: z.string(),
  purpose: z.string(),
  deliveryCompany: z.string(),
  vehicleNumber: z.string(),
  photo: z.string().nullable(),
  /** true when the visitor kept their saved vehicle number untouched */
  keepSavedVehicle: z.boolean().optional(),
});

export const submitVisitorEntry = createServerFn({ method: "POST" })
  .inputValidator((data) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let visitorId: string | null = null;
    let vehicleForVisit = data.vehicleNumber?.trim() || null;
    let savedName = data.visitorName.trim();

    if (MOBILE_RE.test(data.mobileNumber)) {
      try {
        const { data: existing } = await supabaseAdmin
          .from("visitor_profiles")
          .select("id, visitor_name, vehicle_number")
          .eq("mobile_number", data.mobileNumber)
          .maybeSingle();

        if (existing) {
          visitorId = existing.id as string;
          if (data.keepSavedVehicle) {
            vehicleForVisit = (existing.vehicle_number as string | null) ?? null;
          }
          if (!savedName) savedName = existing.visitor_name as string;

          await supabaseAdmin
            .from("visitor_profiles")
            .update({
              visitor_name: savedName,
              vehicle_number: vehicleForVisit,
              ...(data.photo ? { photo: data.photo } : {}),
            })
            .eq("id", visitorId);
        } else {
          const { data: created, error: insertError } = await supabaseAdmin
            .from("visitor_profiles")
            .insert({
              visitor_name: savedName,
              mobile_number: data.mobileNumber,
              vehicle_number: vehicleForVisit,
              photo: data.photo,
            })
            .select("id")
            .single();

          if (insertError) {
            // Duplicate created in a race — fetch it instead of failing.
            const { data: raced } = await supabaseAdmin
              .from("visitor_profiles")
              .select("id")
              .eq("mobile_number", data.mobileNumber)
              .maybeSingle();
            visitorId = (raced?.id as string) ?? null;
          } else {
            visitorId = created?.id ?? null;
          }
        }
      } catch {
        visitorId = null;
      }
    }

    /* ---- forward to the n8n webhook ---- */
    let status: Status = "Pending Approval";
    let message = "";

    const webhookUrl = process.env['WEBHOOK_URL'];
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorName: savedName,
            mobileNumber: data.mobileNumber,
            building: data.building,
            flatNumber: data.flatNumber,
            purpose: data.purpose,
            deliveryCompany: data.deliveryCompany,
            vehicleNumber: vehicleForVisit ?? "",
            photo: data.photo,
            visitorId,
          }),
        });

        let result: { status?: string; message?: string } = {};
        try {
          result = (await res.json()) as { status?: string; message?: string };
        } catch {
          // ignore parse errors
        }

        status =
          STATUS_VALUES.find((s) => s === result.status) ||
          (res.ok ? "Pending Approval" : "Owner Not Responding");
        message = result.message || "";
      } catch {
        status = "Owner Not Responding";
      }
    }

    /* ---- always record the visit ---- */
    let visitId: string | null = null;
    if (visitorId) {
      try {
        const { data: visit } = await supabaseAdmin
          .from("visit_records")
          .insert({
            visitor_id: visitorId,
            purpose: data.purpose,
            delivery_company: data.deliveryCompany || null,
            block: data.building,
            flat_number: data.flatNumber,
            vehicle_number: vehicleForVisit,
            visit_status: status,
            visited_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        visitId = visit?.id ?? null;
      } catch {
        visitId = null;
      }
    }

    return {
      status,
      message,
      visitorId,
      visitId,
      vehicleNumber: vehicleForVisit ?? "",
      visitedAt: new Date().toISOString(),
    };
  });
