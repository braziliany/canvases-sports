const STATUS_MAP = new Map([
  ["未开始", "scheduled"],
  ["待赛", "scheduled"],
  ["已安排", "scheduled"],
  ["进行中", "live"],
  ["中场", "live"],
  ["已结束", "finished"],
  ["完赛", "finished"],
  ["延期", "postponed"],
  ["推迟", "postponed"],
  ["取消", "cancelled"]
]);

export function mapJiangsuFixtureStatus(value) {
  const mapped = STATUS_MAP.get(value?.trim());
  if (!mapped) throw new Error(`Unknown Jiangsu fixture status: ${value}`);
  return mapped;
}
