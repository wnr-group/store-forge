import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldLabel } from "@/components/shared/field-label";
import { FormField } from "@/components/shared/form-field";

type FormFieldProps = React.ComponentProps<typeof FormField>;

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("FieldLabel", () => {
  it("shows a red asterisk (error token) and a screen-reader hint for required fields", () => {
    const out = html(createElement(FieldLabel, { label: "Product name", htmlFor: "name", required: true }));
    expect(out).toContain('for="name"');
    expect(out).toMatch(/Product name<span aria-hidden="true" class="[^"]*text-error[^"]*">\*<\/span>/);
    expect(out).toContain("(required)");
    expect(out).not.toContain("(Optional)");
  });

  it("shows (Optional) for optional fields and no asterisk", () => {
    const out = html(createElement(FieldLabel, { label: "Phone", htmlFor: "phone", optional: true }));
    expect(out).toContain("(Optional)");
    expect(out).not.toContain("*");
  });

  it("marks neither when a field is plain", () => {
    const out = html(createElement(FieldLabel, { label: "Visibility", htmlFor: "v" }));
    expect(out).not.toContain("*");
    expect(out).not.toContain("(Optional)");
  });

  it("required wins if both flags are passed", () => {
    const out = html(createElement(FieldLabel, { label: "X", required: true, optional: true }));
    expect(out).toContain("*");
    expect(out).not.toContain("(Optional)");
  });

  it("renders a help trigger when help text is given", () => {
    expect(html(createElement(FieldLabel, { label: "SKU", optional: true, help: "Stock keeping unit" }))).toContain('aria-label="About SKU"');
  });
});

describe("FormField", () => {
  it("announces errors with role=alert, links the message id and flags the wrapper", () => {
    const out = html(createElement(FormField, { id: "price", label: "Price", required: true, error: "Price is required." } as FormFieldProps, createElement("input", { id: "price" })));
    expect(out).toContain('id="price-msg"');
    expect(out).toContain('role="alert"');
    expect(out).toContain("Price is required.");
    expect(out).toContain('data-invalid="true"');
  });

  it("shows the hint, without an alert, when there is no error", () => {
    const out = html(createElement(FormField, { id: "slug", label: "Slug", optional: true, hint: "Leave blank to generate." } as FormFieldProps, createElement("input", { id: "slug" })));
    expect(out).toContain("Leave blank to generate.");
    expect(out).not.toContain('role="alert"');
    expect(out).toContain("(Optional)");
  });
});
