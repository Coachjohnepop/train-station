export function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail === "object") {
    const d = detail as {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
    const fieldMsgs = d.fieldErrors
      ? Object.entries(d.fieldErrors).flatMap(([k, v]) =>
          v.map((m) => `${k}: ${m}`),
        )
      : [];
    const formMsgs = d.formErrors ?? [];
    const combined = [...formMsgs, ...fieldMsgs].join(" · ");
    if (combined) return combined;
  }
  return "Something went wrong — please try again.";
}

/** @alias formatApiErrorDetail */
export const formatApiError = formatApiErrorDetail;