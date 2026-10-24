// 依內容索引與進度決定「今天要做什麼」。日期鎖：上課日之前看不到；漏掉的會依序補上。

export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const available = (items, today) => items.filter(x => x.date <= today);

/** 最早一個已解鎖、還沒完成的項目；全部完成時回傳 null。 */
export const nextUnfinished = (items, today, done) => available(items, today).find(x => !done[x.id]) || null;

export function todayTasks(index, progress, today) {
  const episode = nextUnfinished(index.episodes, today, progress.episodes);
  const drill = nextUnfinished(index.drills, today, progress.drills);
  const upcoming = index.episodes.find(x => x.date > today) || null;
  const behind = available(index.episodes, today).filter(x => !progress.episodes[x.id]).length;
  return { episode, drill, upcoming, behind };
}

export function daysUntil(dateStr, today) {
  return Math.round((Date.parse(dateStr) - Date.parse(today)) / 864e5);
}

/** 連續練習天數：從今天（今天還沒練就從昨天）往回數。 */
export function streak(days, today) {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00`);
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(isoDate(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** 本週（週一開始）每天是否有練習。 */
export function weekDots(days, today) {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00`);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    const key = isoDate(x);
    return { key, done: set.has(key), today: key === today, future: key > today };
  });
}
