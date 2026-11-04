import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { customers, orders, type Customer, type Order } from "@/lib/db/schema";
import { REVENUE_ORDER_STATUSES } from "@/lib/db/schema/enums";
import { mapErrors } from "@/lib/db/errors";
import { AppError } from "@/lib/errors";
import { withTenantDb } from "@/lib/tenant/context";
import { PAGE_SIZE, type CustomerListQuery } from "@/lib/validations/catalog";
import type { Paged } from "./product.service";

export type CustomerRow = Customer & { orderCount: number; totalSpentMinor: number; lastOrderAt: Date | null };

const revenueStatuses = sql.join(REVENUE_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `);

/** Per-customer order aggregates, computed in SQL from real orders (revenue statuses only for spend). */
const orderCount = sql<number>`(select count(*)::int from ${orders} o where o.customer_id = ${customers.id})`;
const spent = sql<number>`coalesce((select sum(o.total_minor) from ${orders} o where o.customer_id = ${customers.id} and o.status in (${revenueStatuses})), 0)::float8`;
const lastOrder = sql<Date | null>`(select max(o.placed_at) from ${orders} o where o.customer_id = ${customers.id})`;

export async function listCustomers(q: CustomerListQuery): Promise<Paged<CustomerRow>> {
  return withTenantDb({}, async (tx, ctx) => {
    const where: (SQL | undefined)[] = [eq(customers.tenantId, ctx.tenantId)];
    if (q.q) {
      const term = `%${q.q.replace(/[%_\\]/g, "\\$&")}%`;
      where.push(or(ilike(customers.fullName, term), ilike(customers.email, term), ilike(customers.phone, term)));
    }
    const dir = q.dir === "asc" ? asc : desc;
    const order = q.sort === "name" ? dir(customers.fullName) : q.sort === "spent" ? dir(spent) : q.sort === "orders" ? dir(orderCount) : dir(customers.createdAt);
    const cond = and(...where) as SQL;
    const [rows, [{ total }]] = await Promise.all([
      tx
        .select({ customer: customers, orderCount, totalSpentMinor: spent, lastOrderAt: lastOrder })
        .from(customers)
        .where(cond)
        .orderBy(order, asc(customers.id))
        .limit(PAGE_SIZE)
        .offset((q.page - 1) * PAGE_SIZE),
      tx.select({ total: sql<number>`count(*)::int` }).from(customers).where(cond),
    ]);
    return {
      items: rows.map((r) => ({ ...r.customer, orderCount: r.orderCount, totalSpentMinor: Number(r.totalSpentMinor), lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null })),
      total,
      page: q.page,
      pageSize: PAGE_SIZE,
    };
  });
}

export async function getCustomer(id: string): Promise<{ customer: CustomerRow; orders: Order[] } | null> {
  return withTenantDb({}, async (tx, ctx) => {
    const [row] = await tx
      .select({ customer: customers, orderCount, totalSpentMinor: spent, lastOrderAt: lastOrder })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)));
    if (!row) return null;
    const history = await tx.select().from(orders).where(and(eq(orders.customerId, id), eq(orders.tenantId, ctx.tenantId))).orderBy(desc(orders.placedAt)).limit(50);
    return {
      customer: { ...row.customer, orderCount: row.orderCount, totalSpentMinor: Number(row.totalSpentMinor), lastOrderAt: row.lastOrderAt ? new Date(row.lastOrderAt) : null },
      orders: history,
    };
  });
}

type Values = { fullName: string; email: string; phone: string | null; notes: string | null };

export async function createCustomer(v: Values): Promise<{ id: string }> {
  return withTenantDb({ permission: "customers:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const [row] = await tx.insert(customers).values({ tenantId: ctx.tenantId, ...v }).returning({ id: customers.id });
      return row;
    }),
  );
}

export async function updateCustomer(id: string, v: Values): Promise<void> {
  await withTenantDb({ permission: "customers:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const rows = await tx.update(customers).set(v).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId))).returning({ id: customers.id });
      if (!rows.length) throw new AppError("NOT_FOUND", "That customer no longer exists.");
    }),
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  await withTenantDb({ permission: "customers:delete" }, (tx, ctx) =>
    mapErrors(async () => {
      const rows = await tx.delete(customers).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId))).returning({ id: customers.id });
      if (!rows.length) throw new AppError("NOT_FOUND", "That customer no longer exists.");
    }),
  );
}
