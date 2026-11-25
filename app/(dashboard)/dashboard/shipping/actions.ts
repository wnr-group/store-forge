"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import type { PricingType, SaveMethodInput, SaveZoneInput } from "@/lib/api/endpoints/shipping-api";
import { AppError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";
import { parseInput } from "@/lib/validations/parse";
import * as shipping from "@/services/shipping.service";

/**
 * Shipping server actions. The tenant is never an argument; every service call checks the member's permission first and the
 * API checks it again. Carrier secrets pass through `saveCarrierAction` once and are never echoed back or logged.
 */
const uuid = z.uuid();
const code = z.string().regex(/^[a-z][a-z0-9_]{1,31}$/);
const bad = (field: string, message: string): never => {
  throw new AppError("VALIDATION", "Please correct the highlighted fields.", { [field]: message });
};
const refresh = () => {
  revalidatePath(ROUTES.shipping, "layout");
  revalidatePath(ROUTES.orders);
};

// --- carriers ---
export async function saveCarrierAction(carrier: unknown, values: unknown) {
  return run(
    async () => {
      const c = parseInput(code, carrier);
      const v = parseInput(z.record(z.string().max(100), z.string().max(2000)), values);
      await shipping.saveCarrier(c, v);
      refresh();
    },
    { operation: "shipping.carrier.save" },
  );
}

export async function testCarrierAction(carrier: unknown) {
  return run(async () => shipping.testCarrier(parseInput(code, carrier)), { operation: "shipping.carrier.test" });
}

export async function verifyCarrierAction(carrier: unknown) {
  return run(
    async () => {
      const result = await shipping.verifyCarrier(parseInput(code, carrier));
      refresh();
      return result;
    },
    { operation: "shipping.carrier.verify" },
  );
}

export async function setCarrierEnabledAction(carrier: unknown, enabled: unknown, acknowledge?: unknown) {
  return run(
    async () => {
      await shipping.setCarrierEnabled(parseInput(code, carrier), parseInput(z.boolean(), enabled), acknowledge === undefined ? undefined : parseInput(z.boolean(), acknowledge));
      refresh();
    },
    { operation: "shipping.carrier.enable" },
  );
}

export async function setCarrierDefaultAction(carrier: unknown, isDefault: unknown) {
  return run(
    async () => {
      await shipping.setCarrierDefault(parseInput(code, carrier), parseInput(z.boolean(), isDefault));
      refresh();
    },
    { operation: "shipping.carrier.default" },
  );
}

export async function disconnectCarrierAction(carrier: unknown) {
  return run(
    async () => {
      await shipping.disconnectCarrier(parseInput(code, carrier));
      refresh();
    },
    { operation: "shipping.carrier.disconnect" },
  );
}

export async function savePreferencesAction(input: unknown) {
  return run(
    async () => {
      await shipping.savePreferences(parseInput(z.object({ selectionMode: z.enum(["manual", "automatic"]), strategy: z.enum(["lowest_cost", "fastest", "preferred"]) }), input));
      refresh();
    },
    { operation: "shipping.preferences.save" },
  );
}

// --- origin ---
export async function saveOriginAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(z.object({ name: z.string().trim().min(1, "Enter a name.").max(120), phone: z.string().trim().min(1, "Enter a phone number.").max(20), email: z.string().trim().max(254), line1: z.string().trim().min(1, "Enter the address.").max(200), line2: z.string().trim().max(200), city: z.string().trim().min(1, "Enter the city.").max(100), state: z.string().trim().min(1, "Choose the state."), postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code.") }), input);
      await shipping.saveOrigin({ ...v, email: v.email || undefined, line2: v.line2 || undefined });
      refresh();
    },
    { operation: "shipping.origin.save" },
  );
}

// --- zones ---
const list = (text: string) => text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

const zoneForm = z.object({
  name: z.string().trim().min(1, "Enter a name for the zone.").max(80),
  enabled: z.boolean(),
  codAllowed: z.boolean(),
  country: z.boolean(),
  states: z.array(z.string().max(60)).max(60),
  cities: z.string().max(20_000),
  postalCodes: z.string().max(50_000),
  postalRanges: z.string().max(20_000),
});

function zoneInput(raw: unknown): SaveZoneInput {
  const v = parseInput(zoneForm, raw);
  const cities = v.cities
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [city, state] = line.split(",").map((s) => s.trim());
      if (!city || !state) return bad("cities", `"${line.slice(0, 40)}" must look like: City, State`);
      return { city, state };
    });
  const postalRanges = v.postalRanges
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(\d{6})\s*[-–]\s*(\d{6})$/.exec(line);
      return m ? { from: m[1]!, to: m[2]! } : bad("postalRanges", `"${line.slice(0, 20)}" must look like: 560001-560099`);
    });
  return { name: v.name, enabled: v.enabled, codAllowed: v.codAllowed, areas: { country: v.country || undefined, states: v.states, cities, postalCodes: list(v.postalCodes), postalRanges } };
}

export async function saveZoneAction(id: unknown, raw: unknown) {
  return run(
    async () => {
      const input = zoneInput(raw);
      if (id) await shipping.updateZone(parseInput(uuid, id), input);
      else await shipping.createZone(input);
      refresh();
    },
    { operation: "shipping.zone.save" },
  );
}

export async function deleteZoneAction(id: unknown) {
  return run(
    async () => {
      await shipping.deleteZone(parseInput(uuid, id));
      refresh();
    },
    { operation: "shipping.zone.delete" },
  );
}

// --- methods ---
const money = (text: string, currency: string, field: string, required = false): number | null => {
  if (text.trim() === "") return required ? bad(field, "Enter an amount.") : null;
  return parseMoney(text, currency) ?? bad(field, "Enter a valid amount.");
};
const whole = (text: string, field: string): number | null => {
  if (text.trim() === "") return null;
  return /^\d{1,9}$/.test(text.trim()) ? Number(text) : bad(field, "Enter a whole number.");
};

const methodForm = z.object({
  zoneId: z.uuid({ error: "Choose a zone." }),
  name: z.string().trim().min(1, "Enter a name for the method.").max(80),
  kind: z.enum(["standard", "express"]),
  pricingType: z.enum(["flat", "free", "weight", "order_value", "carrier"]),
  currency: z.string().length(3),
  flatRate: z.string().max(20),
  freeOver: z.string().max(20),
  handling: z.string().max(20),
  minOrder: z.string().max(20),
  maxOrder: z.string().max(20),
  minWeight: z.string().max(12),
  maxWeight: z.string().max(12),
  daysMin: z.string().max(3),
  daysMax: z.string().max(3),
  codAllowed: z.boolean(),
  carrierCode: z.string().max(31),
  sortOrder: z.string().max(5),
  enabled: z.boolean(),
  tiers: z.array(z.object({ from: z.string().max(20), to: z.string().max(20), rate: z.string().max(20) })).max(50),
});

function methodInput(raw: unknown): SaveMethodInput {
  const v = parseInput(methodForm, raw);
  const type: PricingType = v.pricingType;
  const byWeight = type === "weight";
  const daysMin = whole(v.daysMin, "daysMin");
  const daysMax = whole(v.daysMax, "daysMax");
  if ((daysMin === null) !== (daysMax === null)) bad("daysMin", "Give both the shortest and longest delivery time, or neither.");
  const tiers =
    byWeight || type === "order_value"
      ? v.tiers.map((t, i) => ({
          from: (byWeight ? whole(t.from, `tiers.${i}`) : money(t.from, v.currency, `tiers.${i}`)) ?? 0,
          to: byWeight ? whole(t.to, `tiers.${i}`) : money(t.to, v.currency, `tiers.${i}`),
          rateMinor: money(t.rate, v.currency, `tiers.${i}`, true)!,
        }))
      : undefined;
  return {
    zoneId: v.zoneId,
    name: v.name,
    kind: v.kind,
    pricingType: type,
    flatRateMinor: type === "flat" ? (money(v.flatRate, v.currency, "flatRate", true) ?? 0) : undefined,
    freeOverMinor: type === "free" ? null : money(v.freeOver, v.currency, "freeOver"),
    handlingMinor: type === "carrier" ? (money(v.handling, v.currency, "handling") ?? 0) : undefined,
    minOrderMinor: money(v.minOrder, v.currency, "minOrder") ?? 0,
    maxOrderMinor: money(v.maxOrder, v.currency, "maxOrder"),
    minWeightGrams: whole(v.minWeight, "minWeight") ?? 0,
    maxWeightGrams: whole(v.maxWeight, "maxWeight"),
    estimatedDaysMin: daysMin,
    estimatedDaysMax: daysMax,
    codAllowed: v.codAllowed,
    carrierCode: type === "carrier" && v.carrierCode ? v.carrierCode : null,
    sortOrder: whole(v.sortOrder, "sortOrder") ?? 0,
    enabled: v.enabled,
    tiers,
  };
}

export async function saveMethodAction(id: unknown, raw: unknown) {
  return run(
    async () => {
      const input = methodInput(raw);
      if (id) await shipping.updateMethod(parseInput(uuid, id), input);
      else await shipping.createMethod(input);
      refresh();
    },
    { operation: "shipping.method.save" },
  );
}

export async function deleteMethodAction(id: unknown) {
  return run(
    async () => {
      await shipping.deleteMethod(parseInput(uuid, id));
      refresh();
    },
    { operation: "shipping.method.delete" },
  );
}

// --- shipments ---
async function shipmentAction(operation: string, id: unknown, fn: (id: string) => Promise<unknown>) {
  return run(
    async () => {
      const sid = parseInput(uuid, id);
      await fn(sid);
      revalidatePath(`${ROUTES.shipments}/${sid}`);
      revalidatePath(ROUTES.shipments);
      revalidatePath(ROUTES.orders);
    },
    { operation },
  );
}

export async function retryShipmentAction(id: unknown) {
  return shipmentAction("shipments.retry", id, shipping.retryShipment);
}
export async function cancelShipmentAction(id: unknown) {
  return shipmentAction("shipments.cancel", id, shipping.cancelShipment);
}
export async function refreshShipmentAction(id: unknown) {
  return shipmentAction("shipments.refresh", id, shipping.refreshShipment);
}
export async function generateLabelAction(id: unknown) {
  return shipmentAction("shipments.label", id, shipping.generateShipmentLabel);
}
