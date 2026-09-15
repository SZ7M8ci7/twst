/** Continue only after a successful checkpoint save, with a cancellable gap. */
export class SearchContinuation {
  private enabled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private resume: () => void, private onIdle: (saved: boolean) => void) {}

  begin(enabled: boolean) {
    this.cancel();
    this.enabled = enabled;
  }

  saved(success: boolean) {
    if (!success || !this.enabled) { this.finish(success); return; }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.resume();
    }, 250);
  }

  /** True means the last batch is already saved and no worker needs stopping. */
  stop(): boolean {
    const betweenBatches = this.timer !== undefined;
    this.cancel();
    if (betweenBatches) this.onIdle(true);
    return betweenBatches;
  }

  finish(saved = true) {
    this.cancel();
    this.onIdle(saved);
  }

  cancel() {
    this.enabled = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
