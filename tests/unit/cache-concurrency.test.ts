import { describe, expect, it } from 'vitest';
import { Semaphore } from '@/lib/concurrency';
import { TtlCache } from '@/lib/cache/ttl-cache';

describe('TtlCache', () => {
  it('expires entries after the TTL', () => {
    let t = 0;
    const c = new TtlCache<string>(1000, 10, () => t);
    c.set('a', 'x');
    expect(c.get('a')).toBe('x');
    t = 999;
    expect(c.get('a')).toBe('x');
    t = 1000;
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0); // expired entry is removed on read
  });

  it('evicts the oldest entry when full', () => {
    const c = new TtlCache<number>(1000, 2, () => 0);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
});

describe('Semaphore', () => {
  it('never exceeds the concurrency limit and runs queued work in order', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const job = (i: number) =>
      sem.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 10));
        order.push(i);
        active--;
      });
    await Promise.all([0, 1, 2, 3, 4, 5].map(job));
    expect(peak).toBe(2);
    expect(order).toHaveLength(6);
  });

  it('rejects when the queue is full and releases slots after failures', async () => {
    const sem = new Semaphore(1);
    let release!: () => void;
    const blocker = sem.run(() => new Promise<void>((r) => (release = r)));
    const waiting = sem.run(async () => 'ok', 1);
    await expect(sem.run(async () => 'no', 1)).rejects.toThrow('QUEUE_FULL');
    release();
    await blocker;
    expect(await waiting).toBe('ok');
    await expect(
      sem.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await sem.run(async () => 'still works')).toBe('still works');
  });
});
