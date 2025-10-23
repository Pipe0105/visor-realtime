export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "$0";
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseInvoiceTimestamp(value) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value;
    }
    return null;
  }

  if (typeof value === "number") {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) {
      return fromNumber;
    }
    if (Number.isFinite(value)) {
      const fromSeconds = new Date(value * 1000);
      if (!Number.isNaN(fromSeconds.getTime())) {
        return fromSeconds;
      }
    }
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  if (/^\d{10}$/.test(stringValue)) {
    const fromSeconds = new Date(Number(stringValue) * 1000);
    if (!Number.isNaN(fromSeconds.getTime())) {
      return fromSeconds;
    }
  }

  if (/^\d{13}$/.test(stringValue)) {
    const fromMillis = new Date(Number(stringValue));
    if (!Number.isNaN(fromMillis.getTime())) {
      return fromMillis;
    }
  }

  let normalized = stringValue;
  if (/^\d{4}-\d{2}-\d{2}\s/.test(stringValue)) {
    normalized = stringValue.replace(" ", "T");
  }

  const isoLocalMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/
  );

  if (isoLocalMatch) {
    const [
      ,
      yearStr,
      monthStr,
      dayStr,
      hourStr,
      minuteStr,
      secondStr,
      fractional,
    ] = isoLocalMatch;
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = secondStr ? Number(secondStr) : 0;
    const millisecond = fractional
      ? Number(`${fractional}`.padEnd(3, "0").slice(0, 3))
      : 0;

    const candidate = new Date(
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond
    );
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

export function normalizeTimestamp(value) {
  if (value == null) {
    return null;
  }

  const parsed = parseInvoiceTimestamp(value);
  if (parsed) {
    return parsed.toISOString();
  }

  return typeof value === "string" ? value : String(value);
}

export function normalizeInvoice(invoice) {
  if (!invoice || typeof invoice !== "object") {
    return invoice;
  }

  const normalizedTimestamp = normalizeTimestamp(
    invoice.invoice_date ?? invoice.timestamp ?? invoice.created_at ?? null
  );

  const base = { ...invoice };

  if (normalizedTimestamp != null) {
    base.timestamp = normalizedTimestamp;
  } else if (invoice.timestamp != null) {
    base.timestamp =
      normalizeTimestamp(invoice.timestamp) ?? invoice.timestamp ?? null;
  }

  return base;
}

export function getInvoiceIdentifier(invoice) {
  if (!invoice || typeof invoice !== "object") {
    return null;
  }

  const directId =
    invoice.invoice_id ??
    invoice.invoice_number ??
    invoice.id ??
    invoice.uuid ??
    null;

  if (directId != null) {
    return String(directId);
  }

  const normalizedTimestamp = normalizeTimestamp(
    invoice.timestamp ?? invoice.invoice_date ?? invoice.created_at ?? null
  );

  if (invoice.invoice_number && normalizedTimestamp) {
    return `${invoice.invoice_number}-${normalizedTimestamp}`;
  }

  if (normalizedTimestamp) {
    return normalizedTimestamp;
  }

  return null;
}

export function getInvoiceDay(value) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length >= 10) {
    return normalized.slice(0, 10);
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function getInvoiceTimestampValue(invoice) {
  if (!invoice || typeof invoice !== "object") {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedTimestamp = parseInvoiceTimestamp(
    invoice.invoice_date ?? invoice.timestamp ?? invoice.created_at ?? null
  );

  if (parsedTimestamp) {
    return parsedTimestamp.getTime();
  }

  return Number.NEGATIVE_INFINITY;
}

export function sortInvoicesByTimestampDesc(invoice) {
  return [...invoice].sort((a, b) => {
    const timeA = getInvoiceTimestampValue(a);
    const timeB = getInvoiceTimestampValue(b);

    if (timeA === timeB) {
      return String(b?.invoice_number ?? "").localeCompare(
        String(a?.invoice_number ?? ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
    }

    return timeB - timeA;
  });
}
