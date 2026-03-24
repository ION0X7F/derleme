type UsageRecord<TPeriodType extends string = string> = {
  used: number;
  limit: number;
  periodKey: string;
  periodType: TPeriodType;
};

export function createUnlimitedUsageSnapshot() {
  return {
    allowed: true,
    used: 0,
    limit: 999999,
    remaining: 999999,
    periodKey: "unlimited",
    periodType: "lifetime",
  } as const;
}

export function projectUsageAfterIncrement<TPeriodType extends string>(
  before: UsageRecord<TPeriodType>,
  nextUsed: number
) {
  const used = Math.max(0, nextUsed);
  const remaining = Math.max(before.limit - used, 0);

  return {
    allowed: used < before.limit,
    used,
    limit: before.limit,
    remaining,
    periodKey: before.periodKey,
    periodType: before.periodType,
  };
}
