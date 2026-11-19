export async function downloadBattleLogImage(log: HTMLElement, title: string) {
  // Render a separate, unscrolled sheet so the user's place in the dialog is preserved.
  const sheet = log.cloneNode(true) as HTMLElement;
  const style = getComputedStyle(log);
  Object.assign(sheet.style, {
    position: 'absolute', top: '0', left: '0', zIndex: '-1', pointerEvents: 'none',
    boxSizing: 'content-box', width: `${log.clientWidth}px`, padding: '12px',
    backgroundColor: '#ffffff', color: style.color, fontFamily: style.fontFamily,
    fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
  });
  sheet.inert = true;
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'margin:0; font-size:18px; line-height:1.4; overflow-wrap:anywhere';
  sheet.prepend(heading);
  sheet.querySelectorAll<HTMLElement>('.log-turn-title').forEach(label => { label.style.position = 'static'; });
  document.body.append(sheet);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const { width, height } = sheet.getBoundingClientRect();
    // Cap the backing canvas on mobile while keeping every turn in the same image.
    const scale = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(12_000_000 / (width * height)));
    const canvas = await html2canvas(sheet, {
      scale, backgroundColor: '#ffffff', logging: false,
      ignoreElements: el => el.parentElement === document.body && el !== sheet,
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png');
    });
    canvas.width = canvas.height = 1;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } finally {
    sheet.remove();
  }
}
