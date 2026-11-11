import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefault24hDeadline,
  buildOffsetDeadline,
  formatDeadlineDisplay,
  getExpectedNextOrderStatus,
  getOrderStatusMeta,
  isSequentialOrderStatusTransition,
  toDateTimeLocalValue,
} from './crmOrderUtils';

test('getOrderStatusMeta resolves known status and falls back to new', () => {
  assert.equal(getOrderStatusMeta('ready').label, 'Готов к выдаче');
  assert.equal(getOrderStatusMeta('unknown_status').id, 'new');
});

test('sequential order status transitions require step-by-step pipeline progression', () => {
  assert.equal(getExpectedNextOrderStatus('new'), 'awaiting_payment');
  assert.equal(getExpectedNextOrderStatus('completed'), null);
  assert.equal(isSequentialOrderStatusTransition('new', 'awaiting_payment'), true);
  assert.equal(isSequentialOrderStatusTransition('new', 'ready'), false);
  assert.equal(isSequentialOrderStatusTransition('in_progress', 'cancelled'), false);
  assert.equal(isSequentialOrderStatusTransition('cancelled', 'new'), false);
});

test('deadline builders clamp working hours and format human-readable output', () => {
  const earlyBase = new Date(2026, 4, 10, 7, 30, 0);
  assert.equal(buildDefault24hDeadline(earlyBase), '2026-05-11T10:00');

  const lateBase = new Date(2026, 4, 10, 21, 15, 0);
  assert.equal(buildDefault24hDeadline(lateBase), '2026-05-11T18:00');

  assert.equal(buildOffsetDeadline(48, earlyBase), '2026-05-12T16:00');
  assert.equal(toDateTimeLocalValue('2026-05-12'), '2026-05-12T16:00');
  assert.equal(formatDeadlineDisplay('2026-05-12T14:30'), '12.05.2026, 14:30');
  assert.equal(formatDeadlineDisplay(''), '24 ч после оплаты (не подтверждён)');
});
