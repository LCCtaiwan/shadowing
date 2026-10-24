import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, renderNetwork, linkQuestion } from '../app/lib/network.js';

const lexicon = { vocab: {
  'ja:vocab:温める': { text: '温める', reading: 'あたためる', zh: '加熱', pos: '動詞', links: {
    collocations: [{ cue: 'レンジで', text: 'レンジで温める', zh: '用微波爐加熱' }],
    opposite: [{ text: '冷やす', reading: 'ひやす', zh: '冰鎮' }] } },
  'ja:vocab:温泉': { text: '温泉', reading: 'おんせん', zh: '溫泉', pos: '名詞' },
  'ja:vocab:冷やす': { text: '冷やす', reading: 'ひやす', zh: '冰鎮', pos: '動詞' },
  'ja:vocab:払う': { text: '払う', reading: 'はらう', zh: '付錢', pos: '動詞' },
  'ja:vocab:乗る': { text: '乗る', reading: 'のる', zh: '搭乘', pos: '動詞' },
} };

test('連結圖：同漢字自動找出，學過的點亮', () => {
  const net = buildNetwork('ja:vocab:温める', lexicon, new Set(['温泉']), { title: 'コンビニで' });
  const kanji = net.nodes.find(n => n.type === 'kanji');
  assert.equal(kanji.text, '温泉');
  assert.equal(kanji.lit, true);
  assert.equal(net.nodes.find(n => n.type === 'opposite').lit, false);
  assert.match(renderNetwork(net), /<svg/);
});

test('連結題：選項含正解、三選一、同詞性', () => {
  const q = linkQuestion('ja:vocab:温める', lexicon, 'ja:vocab:温める#link');
  assert.equal(q.answer, '温める');
  assert.equal(q.options.length, 3);
  assert.ok(q.options.includes('温める'));
  assert.ok(!q.options.includes('温泉'));
});

test('沒有搭配資料就不出連結題', () => {
  assert.equal(linkQuestion('ja:vocab:払う', lexicon, 'x'), null);
});
