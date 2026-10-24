import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, preview, newCardState, formatInterval, MIN, DAY } from '../app/lib/fsrs.js';

const T0 = Date.UTC(2026, 9, 26, 1);

test('新卡：重來 1 分、困難約 5.5 分、良好 10 分、簡單直接畢業', () => {
  const [again, hard, good, easy] = preview(newCardState(), T0);
  assert.equal(again, 1 * MIN);
  assert.equal(hard, 5.5 * MIN);
  assert.equal(good, 10 * MIN);
  assert.ok(easy >= DAY);
});

test('學習步驟：良好兩次後畢業成 review，間隔至少 1 天', () => {
  let c = schedule(newCardState(), 3, T0);
  assert.equal(c.state, 'learning');
  assert.equal(c.step, 1);
  c = schedule(c, 3, c.due);
  assert.equal(c.state, 'review');
  assert.ok(c.due - c.last >= DAY);
});

test('review 卡：困難 ≤ 良好 < 簡單，且間隔隨複習變長', () => {
  let c = schedule(schedule(newCardState(), 3, T0), 3, T0 + 10 * MIN);
  const now = c.due;
  const [, hard, good, easy] = preview(c, now);
  assert.ok(hard <= good && good < easy);
  const next = schedule(c, 3, now);
  assert.ok(next.due - now > c.due - c.last);
});

test('review 卡按重來：進入重新學習、lapses 加一、10 分鐘後再出', () => {
  const c = schedule(schedule(newCardState(), 4, T0), 1, T0 + 5 * DAY);
  assert.equal(c.state, 'relearning');
  assert.equal(c.lapses, 1);
  assert.equal(c.due - c.last, 10 * MIN);
});

test('不改動原卡片物件', () => {
  const c = newCardState();
  schedule(c, 3, T0);
  assert.equal(c.state, 'new');
  assert.equal(c.reps, 0);
});

test('間隔顯示', () => {
  assert.equal(formatInterval(MIN), '1分');
  assert.equal(formatInterval(3 * DAY), '3日');
  assert.equal(formatInterval(60 * DAY), '2か月');
});
