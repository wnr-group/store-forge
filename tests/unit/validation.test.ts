import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { isSupportedCurrency, isValidPhone, isValidTimeZone, moneyValue } from "@/lib/validations/fields";
import {
  categoryInputSchema,
  collectionInputSchema,
  customerInputSchema,
  inventoryAdjustSchema,
  productInputSchema,
  profileSchema,
  storeSettingsSchema,
} from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Message per field path for a failed parse, or {} when it passes. */
function errorsOf(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown) {
  const r = schema.safeParse(input);
  const out: Record<string, string> = {};
  if (!r.success) for (const i of r.error!.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

const product = (over: Record<string, unknown> = {}) => ({ id: uuid(1), name: "Classic tee", price: "499.00", quantity: "10", ...over });

describe("productInputSchema", () => {
  it("accepts a minimal product and normalises optional fields to null", () => {
    const v = productInputSchema.parse(product({ description: "   ", sku: "" }));
    expect(v).toMatchObject({ name: "Classic tee", description: null, sku: null, compareAtPrice: null, quantity: 10, status: "draft", categoryId: null });
  });

  it.each([
    ["", "Product name is required."],
    ["    ", "Product name is required."],
  ])("rejects a blank name %j", (name, message) => {
    expect(errorsOf(productInputSchema, product({ name })).name).toBe(message);
  });

  it("rejects an over-long name", () => {
    expect(errorsOf(productInputSchema, product({ name: "x".repeat(201) })).name).toBe("Product name must be at most 200 characters.");
  });

  it("trims the name", () => {
    expect(productInputSchema.parse(product({ name: "  Tee  " })).name).toBe("Tee");
  });

  it.each([
    ["", "Price is required."],
    ["   ", "Price is required."],
    ["-5", "Price cannot be negative."],
    ["0", "Price must be greater than zero."],
    ["0.00", "Price must be greater than zero."],
    ["abc", "Price must be a valid amount, e.g. 1299.50."],
    ["1e3", "Price must be a valid amount, e.g. 1299.50."],
    ["12.3.4", "Price must be a valid amount, e.g. 1299.50."],
  ])("rejects price %j", (price, message) => {
    expect(errorsOf(productInputSchema, product({ price })).price).toBe(message);
  });

  it("accepts thousands separators and decimals", () => {
    expect(productInputSchema.parse(product({ price: "1,299.50" })).price).toBe("1,299.50");
    expect(moneyValue("1,299.50")).toBe(1299.5);
  });

  it("requires compare-at to exceed the price, but only when provided", () => {
    expect(errorsOf(productInputSchema, product({ compareAtPrice: "499.00" })).compareAtPrice).toBe("Compare-at price must be greater than the price.");
    expect(errorsOf(productInputSchema, product({ compareAtPrice: "100" })).compareAtPrice).toBe("Compare-at price must be greater than the price.");
    expect(errorsOf(productInputSchema, product({ compareAtPrice: "-1" })).compareAtPrice).toBe("Compare-at price cannot be negative.");
    expect(errorsOf(productInputSchema, product({ compareAtPrice: "" }))).toEqual({});
    expect(errorsOf(productInputSchema, product({ compareAtPrice: "599" }))).toEqual({});
  });

  it("allows a zero cost but not a negative one", () => {
    expect(errorsOf(productInputSchema, product({ cost: "0" }))).toEqual({});
    expect(errorsOf(productInputSchema, product({ cost: "-1" })).cost).toBe("Cost per item cannot be negative.");
  });

  it.each([
    ["", "Inventory quantity is required."],
    ["  ", "Inventory quantity is required."],
    ["-1", "Inventory quantity cannot be negative."],
    ["1.5", "Inventory quantity must be a whole number."],
    ["1e3", "Inventory quantity must be a whole number."],
    ["0x10", "Inventory quantity must be a whole number."],
    ["abc", "Inventory quantity must be a whole number."],
    ["1000001", "Inventory quantity must be at most 1,000,000."],
  ])("rejects quantity %j", (quantity, message) => {
    expect(errorsOf(productInputSchema, product({ quantity })).quantity).toBe(message);
  });

  it("accepts zero and numeric quantities", () => {
    expect(productInputSchema.parse(product({ quantity: "0" })).quantity).toBe(0);
    expect(productInputSchema.parse(product({ quantity: 7 })).quantity).toBe(7);
  });

  it("validates slug characters and length when given", () => {
    expect(errorsOf(productInputSchema, product({ slug: "Has Spaces" })).slug).toBe("Use lowercase letters, numbers and single hyphens.");
    expect(errorsOf(productInputSchema, product({ slug: "a" })).slug).toBe("Slug must be at least 2 characters.");
    expect(errorsOf(productInputSchema, product({ slug: "a--b" })).slug).toBeDefined();
    expect(productInputSchema.parse(product({ slug: "  My-Tee " })).slug).toBe("my-tee");
    expect(errorsOf(productInputSchema, product())).toEqual({});
  });

  it("rejects an unsupported status and a malformed category id", () => {
    expect(errorsOf(productInputSchema, product({ status: "archived" })).status).toBe("Please select a valid status.");
    expect(errorsOf(productInputSchema, product({ categoryId: "not-a-uuid" })).categoryId).toBe("Please select a valid category.");
  });

  it("caps description length", () => {
    expect(errorsOf(productInputSchema, product({ description: "x".repeat(20001) })).description).toBe("Description must be at most 20000 characters.");
  });

  it("caps SKU length", () => {
    expect(errorsOf(productInputSchema, product({ sku: "s".repeat(65) })).sku).toBe("SKU must be at most 64 characters.");
  });

  it("limits the number of images", () => {
    const images = Array.from({ length: 11 }, (_, i) => ({ path: `tenant/product/${i}.png` }));
    expect(errorsOf(productInputSchema, product({ images })).images).toBe("At most 10 images.");
  });
});

describe("product variants", () => {
  const variant = (over: Record<string, unknown> = {}) => ({ options: { Size: "S" }, price: "100", quantity: 3, ...over });
  const withVariants = (variants: unknown[], over: Record<string, unknown> = {}) =>
    product({ options: [{ name: "Size", values: ["S", "M"] }], variants, ...over });

  it("accepts consistent variants", () => {
    expect(errorsOf(productInputSchema, withVariants([variant(), variant({ options: { Size: "M" } })]))).toEqual({});
  });

  it("requires option name and values", () => {
    const e = errorsOf(productInputSchema, product({ options: [{ name: " ", values: [] }] }));
    expect(e["options.0.name"]).toBe("Option name is required.");
    expect(e["options.0.values"]).toBe("Add at least one option value.");
  });

  it("rejects blank option values and duplicate values (case-insensitive)", () => {
    expect(errorsOf(productInputSchema, product({ options: [{ name: "Size", values: ["S", " "] }] }))["options.0.values.1"]).toBe("Option value is required.");
    expect(errorsOf(productInputSchema, product({ options: [{ name: "Size", values: ["S", "s"] }] }))["options.0.values"]).toBe("Option values must be unique.");
  });

  it("rejects duplicate option names", () => {
    const options = [
      { name: "Size", values: ["S"] },
      { name: "size", values: ["M"] },
    ];
    expect(errorsOf(productInputSchema, product({ options, variants: [variant()] })).options).toBe("Option names must be unique.");
  });

  it("validates variant price and stock", () => {
    const e = errorsOf(productInputSchema, withVariants([variant({ price: "", quantity: "-2" })]));
    expect(e["variants.0.price"]).toBe("Variant price is required.");
    expect(e["variants.0.quantity"]).toBe("Variant stock cannot be negative.");
    expect(errorsOf(productInputSchema, withVariants([variant({ price: "0" })]))["variants.0.price"]).toBe("Variant price must be greater than zero.");
  });

  it("validates variant compare-at against the variant price", () => {
    expect(errorsOf(productInputSchema, withVariants([variant({ compareAtPrice: "50" })]))["variants.0.compareAtPrice"]).toBe("Compare-at price must be greater than the price.");
  });

  it("rejects the same SKU on two variants, case-insensitively", () => {
    const e = errorsOf(productInputSchema, withVariants([variant({ sku: "TEE-1" }), variant({ options: { Size: "M" }, sku: "tee-1" })]));
    expect(e["variants.1.sku"]).toBe("This SKU is used more than once on this product.");
    expect(e["variants.0.sku"]).toBeUndefined();
  });

  it("requires generated variants when options exist, and options when variants exist", () => {
    expect(errorsOf(productInputSchema, product({ options: [{ name: "Size", values: ["S"] }] })).variants).toBe("Generate at least one variant.");
    expect(errorsOf(productInputSchema, product({ variants: [variant()] })).variants).toBe("Variants need at least one option.");
  });
});

describe("categoryInputSchema / collectionInputSchema", () => {
  it("requires a name and validates the slug", () => {
    expect(errorsOf(categoryInputSchema, { name: "  " }).name).toBe("Category name is required.");
    expect(errorsOf(categoryInputSchema, { name: "Shirts", slug: "Bad Slug" }).slug).toBe("Use lowercase letters, numbers and single hyphens.");
    expect(errorsOf(categoryInputSchema, { name: "Shirts", parentId: "nope" }).parentId).toBe("Please select a valid parent category.");
    expect(categoryInputSchema.parse({ name: " Shirts ", description: "" })).toMatchObject({ name: "Shirts", description: null, parentId: null });
  });

  it("limits category and collection descriptions", () => {
    expect(errorsOf(categoryInputSchema, { name: "A", description: "x".repeat(1001) }).description).toBe("Description must be at most 1000 characters.");
    expect(errorsOf(collectionInputSchema, { name: "A", description: "x".repeat(1001) }).description).toBe("Description must be at most 1000 characters.");
  });

  it("requires a collection name and valid product ids", () => {
    expect(errorsOf(collectionInputSchema, { name: "" }).name).toBe("Collection name is required.");
    expect(errorsOf(collectionInputSchema, { name: "Summer", productIds: ["nope"] })["productIds.0"]).toBeDefined();
    expect(errorsOf(collectionInputSchema, { name: "Summer", status: "archived" }).status).toBe("Please select a valid status.");
    expect(errorsOf(collectionInputSchema, { name: "Summer", productIds: [uuid(2)] })).toEqual({});
  });
});

describe("inventoryAdjustSchema", () => {
  const adj = (over: Record<string, unknown> = {}) => ({ productId: uuid(1), mode: "add", value: "5", reason: "restock", ...over });

  it("accepts add and set adjustments", () => {
    expect(inventoryAdjustSchema.parse(adj({ value: "-3" })).value).toBe(-3);
    expect(inventoryAdjustSchema.parse(adj({ mode: "set", value: "0" })).value).toBe(0);
  });

  it("treats blank input as missing, not as zero", () => {
    expect(errorsOf(inventoryAdjustSchema, adj({ mode: "set", value: "" })).value).toBe("Quantity is required.");
    expect(errorsOf(inventoryAdjustSchema, adj({ value: "   " })).value).toBe("Quantity is required.");
  });

  it("rejects a negative exact count, a zero change, and non-integers", () => {
    expect(errorsOf(inventoryAdjustSchema, adj({ mode: "set", value: "-1" })).value).toBe("Stock cannot be negative.");
    expect(errorsOf(inventoryAdjustSchema, adj({ value: "0" })).value).toBe("Enter a quantity other than zero.");
    expect(errorsOf(inventoryAdjustSchema, adj({ value: "2.5" })).value).toBe("Quantity must be a whole number.");
  });

  it("requires a supported adjustment type and reason", () => {
    expect(errorsOf(inventoryAdjustSchema, adj({ mode: "multiply" })).mode).toBe("Please select an adjustment type.");
    expect(errorsOf(inventoryAdjustSchema, adj({ reason: "" })).reason).toBe("Please select a reason.");
    expect(errorsOf(inventoryAdjustSchema, adj({ reason: undefined })).reason).toBe("Please select a reason.");
  });

  it("rejects a malformed product id", () => {
    expect(errorsOf(inventoryAdjustSchema, adj({ productId: "x" })).productId).toBeDefined();
  });
});

describe("customerInputSchema", () => {
  const c = (over: Record<string, unknown> = {}) => ({ fullName: "Asha Rao", email: "Asha@Example.com", ...over });

  it("normalises email and blank optionals", () => {
    expect(customerInputSchema.parse(c({ phone: "  ", notes: "" }))).toEqual({ fullName: "Asha Rao", email: "asha@example.com", phone: null, notes: null });
  });

  it("requires a name and an email", () => {
    expect(errorsOf(customerInputSchema, c({ fullName: "   " })).fullName).toBe("Customer name is required.");
    expect(errorsOf(customerInputSchema, c({ email: "" })).email).toBe("Email address is required.");
    expect(errorsOf(customerInputSchema, c({ email: undefined })).email).toBe("Email address is required.");
  });

  it.each(["plainaddress", "a@b", "a b@c.com", "@example.com", "a@@example.com"])("rejects email %j", (email) => {
    expect(errorsOf(customerInputSchema, c({ email })).email).toBe("Please enter a valid email address.");
  });

  it.each(["+91 98765 43210", "+1 (415) 555-0100", "020 7946 0958", "+44.20.7946.0958", "9876543210"])("accepts phone %j", (phone) => {
    expect(errorsOf(customerInputSchema, c({ phone }))).toEqual({});
  });

  it.each(["abc", "12345", "+++9198765", "98765x43210", "1".repeat(16)])("rejects phone %j", (phone) => {
    expect(errorsOf(customerInputSchema, c({ phone })).phone).toBe("Please enter a valid phone number, e.g. +1 415 555 0100.");
  });

  it("caps field lengths", () => {
    expect(errorsOf(customerInputSchema, c({ fullName: "x".repeat(121) })).fullName).toBe("Customer name must be at most 120 characters.");
    expect(errorsOf(customerInputSchema, c({ notes: "x".repeat(2001) })).notes).toBe("Notes must be at most 2000 characters.");
    expect(errorsOf(customerInputSchema, c({ email: `${"a".repeat(250)}@x.com` })).email).toBeDefined();
  });
});

describe("storeSettingsSchema", () => {
  const st = (over: Record<string, unknown> = {}) => ({ name: "Acme Store", slug: "acme-store", currency: "inr", timezone: "Asia/Kolkata", ...over });

  it("accepts valid settings and normalises", () => {
    expect(storeSettingsSchema.parse(st({ contactEmail: "", description: " " }))).toMatchObject({ currency: "INR", contactEmail: null, description: null, contactPhone: null, logoPath: null });
  });

  it("requires name, slug, currency and timezone", () => {
    const e = errorsOf(storeSettingsSchema, st({ name: " ", slug: "", currency: "", timezone: "" }));
    expect(e.name).toBe("Store name is required.");
    expect(e.slug).toBeDefined();
    expect(e.currency).toBe("Currency is required.");
    expect(e.timezone).toBe("Timezone is required.");
  });

  it("validates slug format and reserved names", () => {
    expect(errorsOf(storeSettingsSchema, st({ slug: "Has Space" })).slug).toBeDefined();
    expect(errorsOf(storeSettingsSchema, st({ slug: "admin" })).slug).toBe("This name is reserved");
    expect(errorsOf(storeSettingsSchema, st({ slug: "a--b" })).slug).toBeDefined();
  });

  it("rejects unsupported currencies and unknown timezones", () => {
    expect(errorsOf(storeSettingsSchema, st({ currency: "ZZZ" })).currency).toBe("Please select a supported currency.");
    expect(errorsOf(storeSettingsSchema, st({ currency: "RUPEE" })).currency).toBe("Please select a supported currency.");
    expect(errorsOf(storeSettingsSchema, st({ timezone: "Mars/Olympus" })).timezone).toBe("Please select a valid timezone.");
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("validates optional email and phone only when provided", () => {
    expect(errorsOf(storeSettingsSchema, st({ contactEmail: "nope" })).contactEmail).toBe("Please enter a valid email address.");
    expect(errorsOf(storeSettingsSchema, st({ contactPhone: "call me" })).contactPhone).toBeDefined();
    expect(errorsOf(storeSettingsSchema, st({ contactEmail: "hi@acme.com", contactPhone: "+49 30 1234567" }))).toEqual({});
  });

  it("caps the description", () => {
    expect(errorsOf(storeSettingsSchema, st({ description: "x".repeat(501) })).description).toBe("Store description must be at most 500 characters.");
  });

  it("does not accept identifiers the form must not control", () => {
    const parsed = storeSettingsSchema.parse(st({ tenantId: uuid(9), id: uuid(8), status: "suspended" }));
    expect(parsed).not.toHaveProperty("tenantId");
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("profileSchema", () => {
  it("requires a real name and ignores any identifier fields", () => {
    expect(errorsOf(profileSchema, { fullName: "  " }).fullName).toBe("Full name is required.");
    expect(errorsOf(profileSchema, { fullName: "A" }).fullName).toBe("Full name must be at least 2 characters.");
    const parsed = profileSchema.parse({ fullName: " Asha Rao ", email: "x@y.com", userId: uuid(1), role: "owner" });
    expect(parsed).toEqual({ fullName: "Asha Rao" });
  });
});

describe("phone helper", () => {
  it("enforces 7-15 digits", () => {
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567")).toBe(true);
    expect(isValidPhone("123456789012345")).toBe(true);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });
});

describe("parseInput (server entry point)", () => {
  it("throws a structured VALIDATION error with per-field messages", () => {
    try {
      parseInput(customerInputSchema, { fullName: "", email: "bad" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.code).toBe("VALIDATION");
      expect(err.fieldErrors).toEqual({ fullName: "Customer name is required.", email: "Please enter a valid email address." });
    }
  });

  it("rejects non-object payloads instead of crashing", () => {
    for (const bad of [null, undefined, "x", 42, []]) expect(() => parseInput(productInputSchema, bad)).toThrow(AppError);
  });
});
