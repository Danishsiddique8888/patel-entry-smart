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

const submitSchema = z.object({
  visitorName: z.string(),
  mobileNumber: z.string(),
  building: z.string(),
  flatNumber: z.string(),
  purpose: z.string(),
  deliveryCompany: z.string(),
  vehicleNumber: z.string(),
  photo: z.string().nullable(),
});

export const submitVisitorEntry = createServerFn({ method: "POST" })
  .inputValidator((data) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      return { status: "Pending Approval" as Status, message: "" };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let result: { status?: string; message?: string } = {};
      try {
        result = await res.json();
      } catch {
        // ignore parse errors
      }

      const status: Status =
        STATUS_VALUES.find((s) => s === result.status) ||
        (res.ok ? "Pending Approval" : "Owner Not Responding");

      return { status, message: result.message || "" };
    } catch {
      return { status: "Owner Not Responding" as Status, message: "" };
    }
  });
