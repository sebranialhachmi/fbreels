/** Counting semaphore: bounds simultaneous provider calls. Slots are handed off directly to waiters. */
export class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private max: number) {}

  async run<T>(fn: () => Promise<T>, maxQueue = 50): Promise<T> {
    if (this.active < this.max) {
      this.active++;
    } else {
      if (this.waiters.length >= maxQueue) throw new Error('QUEUE_FULL');
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}
