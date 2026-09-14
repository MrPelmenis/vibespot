import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";

/**
 * Shared helpers for route handlers: consistent JSON error responses and small
 * form/query parsing utilities.
 */

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (
    error instanceof Error &&
    (error.name === "MediaError" || error.name === "VideoError")
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export function parseIdList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value;
}

export function formFiles(form: FormData, name: string): File[] {
  return form.getAll(name).filter(isFile);
}

export function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
