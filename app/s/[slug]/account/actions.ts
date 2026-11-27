"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import {
  addCustomerAddressApi,
  cancelCustomerOrderApi,
  changeCustomerPasswordApi,
  deleteCustomerAddressApi,
  getCustomerOrderApi,
  getCustomerProfileApi,
  listCustomerAddressesApi,
  listCustomerOrdersApi,
  loginCustomerApi,
  logoutCustomerApi,
  registerCustomerApi,
  updateCustomerAddressApi,
  updateCustomerProfileApi,
} from "@/lib/api/endpoints/customer-account-api";
import { AppError } from "@/lib/errors";
import { clearCustomerSession, readCustomerToken, writeCustomerSession } from "@/lib/customer/session";
import { storeSlugSchema } from "@/lib/validations/checkout";
import { changePasswordSchema, loginSchema, profileSchema, registerSchema, savedAddressSchema, storeOnly } from "@/lib/validations/customer";
import { parseInput } from "@/lib/validations/parse";

/**
 * Server actions behind the storefront account area. The shopper's session token lives only in an HttpOnly cookie: it is read
 * here and sent to the API, never handed to browser code. Every call names ONE store and the API checks the token against that
 * store alone, so nothing here decides who a shopper is or what they may see.
 */

const LOGIN_REQUIRED = "Sign in to continue.";

/** Runs `fn` with the shopper's token. No cookie, or a session the API no longer accepts, is a sign-in prompt (and the dead cookie goes). */
async function withShopper<T>(storeSlug: string, fn: (token: string) => Promise<T>): Promise<T> {
  const token = await readCustomerToken(storeSlug);
  if (!token) throw new AppError("UNAUTHENTICATED", LOGIN_REQUIRED, undefined, "CUSTOMER_LOGIN_REQUIRED");
  try {
    return await fn(token);
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") await clearCustomerSession(storeSlug);
    throw error;
  }
}

export async function registerCustomerAction(input: unknown) {
  return run(
    async () => {
      const { storeSlug, ...body } = parseInput(registerSchema, input);
      const session = await registerCustomerApi(storeSlug, { ...body, phone: body.phone || undefined });
      await writeCustomerSession(storeSlug, session.sessionToken, session.expiresAt);
      return session.profile;
    },
    { operation: "customer.register" },
  );
}

export async function loginCustomerAction(input: unknown) {
  return run(
    async () => {
      const { storeSlug, ...body } = parseInput(loginSchema, input);
      const session = await loginCustomerApi(storeSlug, body);
      await writeCustomerSession(storeSlug, session.sessionToken, session.expiresAt);
      return session.profile;
    },
    { operation: "customer.login" },
  );
}

export async function logoutCustomerAction(input: unknown) {
  return run(async () => {
    const { storeSlug } = parseInput(storeOnly, input);
    const token = await readCustomerToken(storeSlug);
    // The cookie goes whether or not the API could be reached; the session also ends there when it can.
    await clearCustomerSession(storeSlug);
    if (token) await logoutCustomerApi(storeSlug, token).catch(() => undefined);
  });
}

/** The shopper and their saved addresses, for the checkout (name, email, phone and the address picker). Not signed in is a normal answer. */
export async function checkoutAccountAction(input: unknown) {
  return run(async () => {
    const { storeSlug } = parseInput(storeOnly, input);
    const token = await readCustomerToken(storeSlug);
    if (!token) return { signedIn: false as const };
    try {
      const [profile, addresses] = await Promise.all([getCustomerProfileApi(storeSlug, token), listCustomerAddressesApi(storeSlug, token)]);
      return { signedIn: true as const, profile, addresses };
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
        await clearCustomerSession(storeSlug);
        return { signedIn: false as const };
      }
      throw error;
    }
  });
}

export async function getProfileAction(input: unknown) {
  return run(async () => {
    const { storeSlug } = parseInput(storeOnly, input);
    return withShopper(storeSlug, (t) => getCustomerProfileApi(storeSlug, t));
  });
}

export async function updateProfileAction(input: unknown) {
  return run(
    async () => {
      const { storeSlug, ...body } = parseInput(profileSchema, input);
      return withShopper(storeSlug, (t) => updateCustomerProfileApi(storeSlug, t, body));
    },
    { operation: "customer.profile" },
  );
}

export async function changePasswordAction(input: unknown) {
  return run(
    async () => {
      const { storeSlug, ...body } = parseInput(changePasswordSchema, input);
      await withShopper(storeSlug, (t) => changeCustomerPasswordApi(storeSlug, t, body));
    },
    { operation: "customer.password" },
  );
}

export async function listAddressesAction(input: unknown) {
  return run(async () => {
    const { storeSlug } = parseInput(storeOnly, input);
    return withShopper(storeSlug, (t) => listCustomerAddressesApi(storeSlug, t));
  });
}

const addressInput = z.object({ storeSlug: storeSlugSchema, address: savedAddressSchema });

export async function addAddressAction(input: unknown) {
  return run(async () => {
    const v = parseInput(addressInput, input);
    return withShopper(v.storeSlug, (t) => addCustomerAddressApi(v.storeSlug, t, v.address));
  });
}

export async function updateAddressAction(input: unknown) {
  return run(async () => {
    const v = parseInput(addressInput.extend({ id: z.string().uuid() }), input);
    return withShopper(v.storeSlug, (t) => updateCustomerAddressApi(v.storeSlug, t, v.id, v.address));
  });
}

export async function deleteAddressAction(input: unknown) {
  return run(async () => {
    const v = parseInput(z.object({ storeSlug: storeSlugSchema, id: z.string().uuid() }), input);
    return withShopper(v.storeSlug, (t) => deleteCustomerAddressApi(v.storeSlug, t, v.id));
  });
}

export async function listOrdersAction(input: unknown) {
  return run(async () => {
    const v = parseInput(z.object({ storeSlug: storeSlugSchema, page: z.number().int().min(1).max(10_000).default(1) }), input);
    return withShopper(v.storeSlug, (t) => listCustomerOrdersApi(v.storeSlug, t, v.page));
  });
}

const orderRef = z.object({ storeSlug: storeSlugSchema, orderNumber: z.number().int().min(1) });

export async function getAccountOrderAction(input: unknown) {
  return run(async () => {
    const v = parseInput(orderRef, input);
    return withShopper(v.storeSlug, (t) => getCustomerOrderApi(v.storeSlug, t, v.orderNumber));
  });
}

export async function cancelAccountOrderAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(orderRef, input);
      return withShopper(v.storeSlug, (t) => cancelCustomerOrderApi(v.storeSlug, t, v.orderNumber));
    },
    { operation: "customer.order.cancel" },
  );
}
