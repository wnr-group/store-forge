"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTES } from "@/config/app";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const titleCase = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Breadcrumb trail derived from the URL: /dashboard/products/<id>/edit -> Overview / Products / Details / Edit. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1); // drop "dashboard"
  const crumbs = segments.map((seg, i) => ({
    label: UUID.test(seg) ? "Details" : titleCase(seg),
    href: `${ROUTES.dashboard}/${segments.slice(0, i + 1).join("/")}`,
  }));

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className={crumbs.length ? "hidden sm:inline-flex" : undefined}>
          {crumbs.length ? (
            <BreadcrumbLink render={<Link href={ROUTES.dashboard} />}>Overview</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Overview</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={c.href}>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem className={last ? undefined : "hidden sm:inline-flex"}>
                {last ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
