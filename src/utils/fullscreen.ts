'use client';

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as unknown as {
    fullscreenElement?: Element;
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function toggleFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  if (!isFullscreenActive()) {
    const el = document.documentElement as unknown as {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    if (el.requestFullscreen) {
      return el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      return Promise.resolve(el.webkitRequestFullscreen());
    } else if (el.mozRequestFullScreen) {
      return Promise.resolve(el.mozRequestFullScreen());
    } else if (el.msRequestFullscreen) {
      return Promise.resolve(el.msRequestFullscreen());
    }
  } else {
    const doc = document as unknown as {
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };

    if (doc.exitFullscreen) {
      return doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      return Promise.resolve(doc.webkitExitFullscreen());
    } else if (doc.mozCancelFullScreen) {
      return Promise.resolve(doc.mozCancelFullScreen());
    } else if (doc.msExitFullscreen) {
      return Promise.resolve(doc.msExitFullscreen());
    }
  }
  return Promise.resolve();
}
