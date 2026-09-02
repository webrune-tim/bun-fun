"use client";

import React, { ComponentProps, forwardRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type TransitionType =
  | "forward"
  | "backward"
  | "gallery"
  | "demo"
  | "fade";

export interface NavigateOptions {
  type?: TransitionType;
  replace?: boolean;
}
// Register cross-document transition lifecycle listeners (CSS-Tricks Parts 1 & 2)
if (typeof window !== "undefined") {
  window.addEventListener("pagereveal", (event) => {
    const vtEvent = event as {
      viewTransition?: {
        finished?: Promise<void>;
        ready?: Promise<void>;
      };
    };
    if (!vtEvent.viewTransition) return;

    vtEvent.viewTransition.finished?.catch(() => {
      // Gracefully catch timeout or abort on incoming transitions
    });
  });

  window.addEventListener("pageswap", (event) => {
    const vtEvent = event as {
      viewTransition?: {
        finished?: Promise<void>;
        ready?: Promise<void>;
      };
    };
    if (!vtEvent.viewTransition) return;

    vtEvent.viewTransition.finished?.catch(() => {
      // Gracefully catch timeout or abort on outgoing transitions
    });
  });
}

/**
 * Custom router hook providing View Transition API integration with Next.js navigation.
 * Conforms to https://web.dev/learn/css/view-transitions-spas and CSS-Tricks Parts 1 & 2.
 */
export function useTransitionRouter() {
  const router = useRouter();

  const push = (href: string, options?: NavigateOptions) => {
    navigateWithTransition(href, false, options);
  };

  const replace = (href: string, options?: NavigateOptions) => {
    navigateWithTransition(href, true, options);
  };

  const navigateWithTransition = (
    href: string,
    isReplace: boolean,
    options?: NavigateOptions
  ) => {
    if (
      typeof document === "undefined" ||
      !("startViewTransition" in document) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (isReplace) {
        router.replace(href);
      } else {
        router.push(href);
      }
      return;
    }

    const doc = document as Document & {
      startViewTransition: (
        paramsOrCb:
          | (() => void)
          | {
              update: () => void;
              types?: string[];
            }
      ) => {
        ready?: Promise<void>;
        finished?: Promise<void>;
        updateCallbackDone?: Promise<void>;
      };
    };

    const updateDOM = () => {
      if (isReplace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    };

    try {
      let transition;
      if (options?.type) {
        try {
          transition = doc.startViewTransition({
            update: updateDOM,
            types: [options.type],
          });
        } catch {
          transition = doc.startViewTransition(updateDOM);
        }
      } else {
        transition = doc.startViewTransition(updateDOM);
      }

      // Safely catch any aborted / timed-out / superseded transition rejections
      transition?.finished?.catch(() => {});
      transition?.ready?.catch(() => {});
      transition?.updateCallbackDone?.catch(() => {});
    } catch {
      // If startViewTransition throws synchronously, fallback to direct router navigation
      updateDOM();
    }
  };

  return {
    ...router,
    push,
    replace,
  };
}

export interface TransitionLinkProps
  extends Omit<ComponentProps<typeof Link>, "onClick"> {
  transitionType?: TransitionType;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Drop-in replacement for next/link that triggers the CSS View Transitions API.
 */
export const TransitionLink = forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  (
    {
      href,
      transitionType = "forward",
      replace: isReplace = false,
      onClick,
      children,
      ...rest
    },
    ref
  ) => {
    const { push, replace } = useTransitionRouter();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }

      e.preventDefault();
      onClick?.(e);

      const targetUrl =
        typeof href === "string"
          ? href
          : typeof href === "object" && href !== null && "pathname" in href
          ? (href.pathname as string) || "/"
          : String(href);

      if (isReplace) {
        replace(targetUrl, { type: transitionType });
      } else {
        push(targetUrl, { type: transitionType });
      }
    };

    return (
      <Link
        ref={ref}
        href={href}
        replace={isReplace}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </Link>
    );
  }
);

TransitionLink.displayName = "TransitionLink";

