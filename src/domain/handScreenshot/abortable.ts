// OCR workers may stop without settling their outstanding job promises.
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', cancel);
    const cancel = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener('abort', cancel, { once: true });
    work.then(value => {
      cleanup();
      if (signal.aborted) reject(signal.reason); else resolve(value);
    }, error => { cleanup(); reject(error); });
    if (signal.aborted) cancel();
  });
}
