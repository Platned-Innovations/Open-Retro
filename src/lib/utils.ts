import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge doesn't know @platned/ui's font-size scale exists, so it
 * falls back to treating `text-body`, `text-heading-sm`, etc. as arbitrary
 * text *colors* rather than sizes — and silently drops whichever real color
 * class (`text-brand-on-brand`, `text-default`, ...) shares a `cn()` call
 * with one, since it thinks they're the same conflicting utility. That bug
 * is invisible until you look at the rendered page: the class is still
 * there, it just loses to a size class it should never have been competing
 * with. Registering the scale here fixes it everywhere `cn()` is used, not
 * just the one call site that surfaced it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-body-tiny",
        "text-body-xs",
        "text-body-sm",
        "text-body",
        "text-subheading-sm",
        "text-subheading",
        "text-heading-sm",
        "text-heading",
        "text-subtitle-lg",
        "text-subtitle",
        "text-title",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
