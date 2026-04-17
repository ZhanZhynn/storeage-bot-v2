export type CronFieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

type CronFieldSpec = {
  name: CronFieldName;
  min: number;
  max: number;
  allowSevenAsSunday?: boolean;
};

const CRON_FIELD_SPECS: CronFieldSpec[] = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "dayOfMonth", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "dayOfWeek", min: 0, max: 6, allowSevenAsSunday: true },
];

function normalizeWeekdayValue(value: number, spec: CronFieldSpec): number {
  if (spec.allowSevenAsSunday && value === 7) {
    return 0;
  }
  return value;
}

function parseSingleValue(rawValue: string, spec: CronFieldSpec): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${spec.name} value '${rawValue}'`);
  }
  const normalized = normalizeWeekdayValue(parsed, spec);
  if (normalized < spec.min || normalized > spec.max) {
    throw new Error(`Invalid ${spec.name} value '${rawValue}'`);
  }
  return normalized;
}

function addRangeValues(set: Set<number>, start: number, end: number, step: number, spec: CronFieldSpec): void {
  if (!Number.isInteger(step) || step <= 0) {
    throw new Error(`Invalid ${spec.name} step '${step}'`);
  }
  if (start > end) {
    throw new Error(`Invalid ${spec.name} range '${start}-${end}'`);
  }
  for (let value = start; value <= end; value += step) {
    set.add(normalizeWeekdayValue(value, spec));
  }
}

function parseSegment(rawSegment: string, spec: CronFieldSpec, set: Set<number>): void {
  const segment = rawSegment.trim();
  if (!segment) {
    throw new Error(`Invalid ${spec.name} segment`);
  }

  const [baseRaw = "", stepRaw] = segment.split("/");
  const base = baseRaw.trim();
  const step = stepRaw === undefined ? 1 : Number(stepRaw);

  if (base === "*") {
    addRangeValues(set, spec.min, spec.max, step, spec);
    return;
  }

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    if (!startRaw || !endRaw) {
      throw new Error(`Invalid ${spec.name} range '${segment}'`);
    }
    const start = parseSingleValue(startRaw, spec);
    const end = parseSingleValue(endRaw, spec);
    addRangeValues(set, start, end, step, spec);
    return;
  }

  const value = parseSingleValue(base, spec);
  if (stepRaw !== undefined) {
    addRangeValues(set, value, spec.max, step, spec);
    return;
  }
  set.add(value);
}

function parseField(rawField: string, spec: CronFieldSpec): Set<number> {
  const field = rawField.trim();
  if (!field) {
    throw new Error(`Missing ${spec.name} field`);
  }

  const allowedValues = new Set<number>();
  const segments = field.split(",");
  for (const segment of segments) {
    parseSegment(segment, spec, allowedValues);
  }

  if (allowedValues.size === 0) {
    throw new Error(`Invalid ${spec.name} field '${rawField}'`);
  }
  return allowedValues;
}

export function validateCronExpression(expression: string): void {
  const normalized = expression.trim();
  const fields = normalized.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error("Cron expression must have exactly 5 fields");
  }

  fields.forEach((field, index) => {
    parseField(field, CRON_FIELD_SPECS[index]!);
  });
}

export function matchesCronExpression(expression: string, date = new Date()): boolean {
  validateCronExpression(expression);
  const fields = expression.trim().split(/\s+/);
  const dateValues = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ];

  return fields.every((field, index) => parseField(field, CRON_FIELD_SPECS[index]!).has(dateValues[index]!));
}
