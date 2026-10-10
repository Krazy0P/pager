import { flushSync } from "react-dom";

/**
 * Triggers a fluid circular ripple animation expanding from the toggle button
 * when switching between light and dark themes.
 *
 * Uses the modern View Transitions API (Chromium, Edge, Safari 18+) with a
 * radial scale fallback for browsers that don't yet support view transitions.
 */
export function toggleThemeWithRipple(
  event: React.MouseEvent<HTMLElement> | MouseEvent,
  currentTheme: string | undefined,
  setTheme: (theme: string) => void
) {
  if (typeof window === "undefined") {
    return;
  }

  const isDark =
    currentTheme === "dark" ||
    (!currentTheme && document.documentElement.classList.contains("dark"));
  const nextTheme = isDark ? "light" : "dark";

  // Honor user's reduced motion accessibility preference
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTheme(nextTheme);
    return;
  }

  // Determine origin coordinates from click or button center
  const currentTarget = event.currentTarget as HTMLElement | null;
  const target = event.target as HTMLElement | null;
  const buttonElement = currentTarget || target;

  let x = event.clientX;
  let y = event.clientY;

  if ((!x || !y) && buttonElement) {
    const rect = buttonElement.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  if (!x || !y) {
    x = window.innerWidth / 2;
    y = window.innerHeight / 2;
  }

  // Calculate distance from origin to furthest corner of the viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // Micro-ripple pulse on the button itself
  if (buttonElement) {
    const buttonRipple = document.createElement("span");
    buttonRipple.className = "theme-button-ripple";
    buttonElement.style.position = "relative";
    buttonElement.appendChild(buttonRipple);
    setTimeout(() => {
      buttonRipple.remove();
    }, 600);
  }

  // View Transitions API
  const doc = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => {
      ready: Promise<void>;
      finished: Promise<void>;
    };
  };

  if (typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
    return;
  }

  // Fallback for browsers without View Transitions support
  const overlay = document.createElement("div");
  const diameter = endRadius * 2;
  overlay.style.position = "fixed";
  overlay.style.left = `${x - endRadius}px`;
  overlay.style.top = `${y - endRadius}px`;
  overlay.style.width = `${diameter}px`;
  overlay.style.height = `${diameter}px`;
  overlay.style.borderRadius = "50%";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "999999";
  overlay.style.backgroundColor = isDark ? "#ffffff" : "#090d16";
  overlay.style.transform = "scale(0)";
  overlay.style.opacity = "1";
  overlay.style.transition =
    "transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.transform = "scale(1)";
  });

  setTimeout(() => {
    setTheme(nextTheme);
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
    }, 250);
  }, 280);
}
