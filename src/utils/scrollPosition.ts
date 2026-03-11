const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const waitForAnimationFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve());
});

export async function waitForLayoutStability(frameCount = 2) {
  for (let i = 0; i < frameCount; i += 1) {
    await waitForAnimationFrame();
  }
}

export function scrollElementWithinContainerToCenter(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetTop = container.scrollTop + (targetRect.top - containerRect.top);
  const nextTop = targetTop - (container.clientHeight - targetRect.height) / 2;
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

  container.scrollTo({
    top: clamp(nextTop, 0, maxTop),
    behavior,
  });
}

export function scrollElementToViewportCenter(
  target: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
) {
  const targetRect = target.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const nextTop = window.scrollY + targetRect.top - (viewportHeight - targetRect.height) / 2;
  const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  window.scrollTo({
    top: clamp(nextTop, 0, maxTop),
    behavior,
  });
}

export function findNearestVerticalScrollContainer(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

    if (isScrollable && current.scrollHeight > current.clientHeight + 1) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}