import { createTheme, type Shadows } from "@mui/material/styles";
import { ds, inkMix, palettes } from "@/lib/design";

export { ds };

/**
 * One design system for the whole app, dealt by tasteskill for a software
 * product: palette "white-mint-tiles", type pairing Chivo + Chivo Mono, the
 * soft radius scale. Light, dark and system modes.
 *
 *  - Light: the action colour is the ink itself. Primary buttons, the active
 *    step, the selected tab: all #232323 on white, so nothing competes with
 *    the content people are writing on the board.
 *  - Dark: the palette's inverse ground. The page is near-black, the text is
 *    light, and mint takes over as the action colour.
 *  - Mint marks "this one, now" in both: the card under discussion, the
 *    open-items count, a focused field's ring.
 *  - Lines are ink at 11% (rest) and ~20% (strong), never a separate grey.
 *
 * Colours come in twice: `colorSchemes` gives MUI real values per scheme (it
 * derives hover and disabled shades from them), and every override below
 * uses the CSS variables in `ds`, which globals.css switches with the `.dark`
 * class. The mode is the MUI `mui-mode` setting (light, dark or system),
 * applied before first paint by InitColorSchemeScript in the root layout.
 *
 * Radius is one scale: 8 (controls), 12 (inputs, panels, menus), 20 (cards,
 * dialogs). `shape.borderRadius` stays 8 so `sx={{ borderRadius: n }}`
 * multiples land on that scale: 1 = 8, 1.5 = 12, 2.5 = 20.
 */

const t = (props: string) =>
  props
    .split(",")
    .map((p) => `${p.trim()} ${ds.dur} ${ds.ease}`)
    .join(", ");

/** Hover only where a pointer can actually hover: a phone never keeps a stuck hover. */
const HOVER = "@media (hover: hover) and (pointer: fine)";

/** Soft, low shadows: a menu or dialog floats a little, nothing more. */
const shadows = Array.from({ length: 25 }, (_, i) => {
  if (i === 0) return "none";
  const y = Math.min(2 + i * 2, 32);
  const blur = Math.min(8 + i * 4, 64);
  return `0 1px 2px rgba(0,0,0,0.05), 0 ${y}px ${blur}px -${Math.round(y / 2)}px rgba(0,0,0,0.18)`;
}) as Shadows;

const displayHeading = {
  fontFamily: ds.fontText,
  fontWeight: 400,
  letterSpacing: "-0.03em",
  textWrap: "balance",
} as const;

function schemePalette(mode: "light" | "dark") {
  const p = palettes[mode];
  const dark = mode === "dark";
  return {
    mode,
    primary: {
      main: p.action,
      light: dark ? "#c9ffe1" : "#4a4a4a",
      dark: dark ? "#7fe8ae" : "#111111",
      contrastText: p.actionInk,
    },
    secondary: {
      main: p.accent,
      light: "#c9ffe1",
      dark: "#5fe39a",
      contrastText: p.accentInk,
    },
    success: { main: dark ? "#3ecf8e" : "#1e8a5a", contrastText: dark ? "#0f1f17" : "#ffffff" },
    warning: { main: dark ? "#f0a93b" : "#c77700", contrastText: dark ? "#1f1405" : "#ffffff" },
    error: { main: dark ? "#ff6b5e" : "#d33a2f", contrastText: dark ? "#1f0806" : "#ffffff" },
    info: { main: dark ? "#6ea8ff" : "#2a6fd6", contrastText: dark ? "#06132b" : "#ffffff" },
    text: {
      primary: p.ink,
      secondary: p.muted,
      disabled: dark ? "rgba(237,237,237,0.38)" : "rgba(35,35,35,0.38)",
    },
    background: {
      default: p.bg,
      paper: p.card,
    },
    divider: p.line,
    action: dark
      ? { hover: "rgba(237,237,237,0.06)", selected: "rgba(237,237,237,0.1)", focus: "rgba(237,237,237,0.14)" }
      : { hover: "rgba(35,35,35,0.04)", selected: "rgba(35,35,35,0.07)", focus: "rgba(35,35,35,0.1)" },
  };
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: { palette: schemePalette("light") },
    dark: { palette: schemePalette("dark") },
  },
  shape: {
    borderRadius: ds.r.sm,
  },
  shadows,
  typography: {
    fontFamily: ds.fontText,
    fontWeightBold: 600,
    h1: { ...displayHeading, fontSize: "clamp(38px, 3.24vw + 25.4px, 72px)", lineHeight: 1.04, letterSpacing: "-0.04em" },
    h2: { ...displayHeading, fontSize: "clamp(30px, 1.72vw + 23.3px, 48px)", lineHeight: 1.1 },
    h3: { ...displayHeading, fontSize: "clamp(28px, 1.2vw + 22px, 40px)", lineHeight: 1.1 },
    h4: { ...displayHeading, fontSize: "clamp(26px, 0.8vw + 21px, 34px)", lineHeight: 1.12 },
    h5: { ...displayHeading, fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.02em" },
    h6: { fontWeight: 500, fontSize: 18, lineHeight: 1.3, letterSpacing: "-0.01em" },
    subtitle1: { fontWeight: 500, fontSize: 16, lineHeight: 1.4 },
    subtitle2: { fontWeight: 500, fontSize: 14, lineHeight: 1.4 },
    body1: { fontSize: 16, lineHeight: 1.55 },
    body2: { fontSize: 14, lineHeight: 1.5 },
    caption: { fontSize: 13, lineHeight: 1.4, letterSpacing: "0.01em" },
    overline: {
      fontFamily: ds.fontMono,
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    button: { fontWeight: 500, letterSpacing: 0, textTransform: "none" },
  },
  transitions: {
    easing: {
      easeOut: ds.ease,
      easeInOut: ds.ease,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: ds.bg,
          color: ds.ink,
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
          fontFeatureSettings: '"ss01", "cv11"',
        },
        "::selection": { backgroundColor: ds.accent, color: ds.accentInk },
        ":focus-visible": { outline: `2px solid ${ds.ink}`, outlineOffset: 2 },
        ":root": { colorScheme: "light" },
        ":root.dark": { colorScheme: "dark" },
        ".Mui-focusVisible": { outline: `2px solid ${ds.ink}`, outlineOffset: 2 },
      },
    },

    // ------------------------------------------------------------ buttons
    MuiButtonBase: {
      // No ink ripple: a button answers by stepping and pressing instead, and
      // keyboard focus gets the ring from CssBaseline above.
      defaultProps: { disableRipple: true },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: ds.r.sm,
          fontWeight: 500,
          whiteSpace: "nowrap",
          transition: t("background-color, color, border-color, transform"),
          [HOVER]: { "&:hover": { transform: "translateY(-1px)" } },
          "&:active": { transform: "translateY(1px) scale(.985)" },
          "&.Mui-disabled": { transform: "none" },
        },
        sizeSmall: { height: 32, padding: "0 12px", fontSize: 13.5 },
        sizeMedium: { height: 40, padding: "0 16px", fontSize: 14.5 },
        sizeLarge: { height: 44, padding: "0 20px", fontSize: 16 },
        startIcon: { marginRight: 6 },
        endIcon: { marginLeft: 6 },
      },
      variants: [
        {
          props: { variant: "contained", color: "primary" },
          style: {
            "&:hover": { backgroundColor: `color-mix(in oklab, ${ds.action} 86%, ${ds.bg})` },
            "&.Mui-disabled": { backgroundColor: inkMix(12), color: inkMix(40) },
          },
        },
        {
          props: { variant: "contained", color: "secondary" },
          style: { "&:hover": { backgroundColor: `color-mix(in oklab, ${ds.accent} 88%, ${ds.ink})` } },
        },
        {
          props: { variant: "outlined", color: "primary" },
          style: {
            color: ds.ink,
            backgroundColor: ds.bg,
            borderColor: ds.lineStrong,
            "&:hover": { backgroundColor: `color-mix(in oklab, ${ds.bg} 94%, ${ds.ink})`, borderColor: inkMix(35) },
          },
        },
        {
          props: { variant: "outlined", color: "inherit" },
          style: { borderColor: ds.lineStrong, "&:hover": { borderColor: inkMix(35) } },
        },
        {
          props: { variant: "text", color: "primary" },
          style: { color: ds.ink, "&:hover": { backgroundColor: inkMix(5) } },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: ds.r.sm,
          transition: t("background-color, color, transform"),
          "&:hover": { backgroundColor: inkMix(6) },
          "&:active": { transform: "scale(.94)" },
        },
        sizeSmall: { padding: 6 },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { backgroundColor: ds.surface, borderRadius: ds.r.sm, padding: 3, gap: 2 },
        grouped: { border: 0, borderRadius: `${ds.r.sm - 2}px !important`, margin: 0 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          color: ds.muted,
          border: 0,
          transition: t("background-color, color, box-shadow"),
          "&.Mui-selected": {
            backgroundColor: ds.bg,
            color: ds.ink,
            boxShadow: `0 1px 2px ${inkMix(8)}, 0 0 0 1px ${ds.line}`,
            "&:hover": { backgroundColor: ds.bg },
          },
        },
      },
    },
    MuiFab: {
      defaultProps: { disableRipple: true },
    },

    // ------------------------------------------------------------ surfaces
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: ds.line },
        rounded: { borderRadius: ds.r.md },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderRadius: ds.r.lg,
          borderColor: ds.line,
          transition: t("transform, border-color, box-shadow"),
          // A card that is a link lifts 2px under the pointer: the whole tile
          // answers, not just a tint inside it.
          [HOVER]: {
            "&:has(> .MuiCardActionArea-root:hover)": {
              transform: "translateY(-2px)",
              borderColor: ds.lineStrong,
              boxShadow: `0 10px 24px -14px ${inkMix(28)}`,
            },
          },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: "transparent" } },
        focusHighlight: { display: "none" },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: "20px 20px 12px" },
        title: { fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" },
        subheader: { fontSize: 13, color: ds.muted },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: "12px 20px 20px", "&:last-child": { paddingBottom: 20 } },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: { backgroundImage: "none", backgroundColor: ds.bg, color: ds.ink, borderBottom: `1px solid ${ds.line}` },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: ds.line } },
    },

    // ------------------------------------------------------------ overlays
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: ds.r.lg,
          border: `1px solid ${ds.line}`,
          boxShadow: `0 1px 2px ${inkMix(5)}, 0 32px 64px -24px ${inkMix(30)}`,
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { "&:not(.MuiBackdrop-invisible)": { backgroundColor: inkMix(32), backdropFilter: "blur(2px)" } },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.25, padding: "24px 24px 8px" },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: "8px 24px" } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: "16px 24px 24px", gap: 8, "& > :not(style) ~ :not(style)": { marginLeft: 0 } } },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: ds.r.md,
          border: `1px solid ${ds.line}`,
          boxShadow: `0 1px 2px ${inkMix(4)}, 0 16px 40px -16px ${inkMix(22)}`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: { list: { padding: 4 } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 14,
          borderRadius: 6,
          minHeight: 36,
          "&:hover": { backgroundColor: inkMix(5) },
          "&.Mui-selected": { backgroundColor: inkMix(7) },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: false },
      styleOverrides: {
        tooltip: { backgroundColor: ds.ink, color: ds.bg, fontSize: 12.5, fontWeight: 500, borderRadius: 6, padding: "6px 10px" },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { borderRadius: ds.r.md, border: `1px solid ${ds.line}`, marginTop: 4 },
        option: { fontSize: 14, borderRadius: 6, margin: "0 4px" },
      },
    },

    // ------------------------------------------------------------ fields
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: ds.r.sm,
          backgroundColor: ds.bg,
          transition: t("box-shadow"),
          "& .MuiOutlinedInput-notchedOutline": { borderColor: ds.lineStrong, transition: t("border-color") },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: inkMix(40) },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: ds.ink, borderWidth: 1 },
          "&.Mui-focused": { boxShadow: `0 0 0 3px ${ds.focusRing}` },
          "&.Mui-error.Mui-focused": { boxShadow: "0 0 0 3px rgba(211, 58, 47, 0.2)" },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: ds.muted, "&.Mui-focused": { color: ds.ink } },
      },
    },
    MuiFormLabel: {
      styleOverrides: { root: { "&.Mui-focused": { color: ds.ink } } },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 999, backgroundColor: inkMix(35), opacity: 1 },
        thumb: { boxShadow: `0 1px 2px ${inkMix(25)}` },
        switchBase: {
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: ds.action, opacity: 1 },
          "&.Mui-checked .MuiSwitch-thumb": { backgroundColor: ds.actionInk },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { color: ds.lineStrong, "&.Mui-checked": { color: ds.ink } } },
    },
    MuiRadio: {
      styleOverrides: { root: { color: ds.lineStrong, "&.Mui-checked": { color: ds.ink } } },
    },

    // ------------------------------------------------------------ navigation
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 2, borderRadius: 2, backgroundColor: ds.ink },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 500,
          fontSize: 14.5,
          color: ds.muted,
          transition: t("color"),
          "&:hover": { color: ds.ink },
          "&.Mui-selected": { color: ds.ink },
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: { root: { fontSize: 14 }, separator: { color: inkMix(30), marginInline: 6 } },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: {
        root: {
          textUnderlineOffset: 4,
          textDecorationColor: ds.lineStrong,
          transition: t("color, text-decoration-color"),
          "&:hover": { textDecorationColor: "currentColor" },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: inkMix(10),
          "&:not(.Mui-active):not(.Mui-completed) .MuiStepIcon-text": { fill: ds.muted },
          "&.Mui-active": { color: ds.ink },
          "&.Mui-completed": { color: ds.ink },
        },
        text: { fontFamily: ds.fontMono, fontWeight: 500, fontSize: 12 },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontSize: 13.5,
          color: ds.muted,
          "&.Mui-active": { color: ds.ink, fontWeight: 500 },
          "&.Mui-completed": { color: ds.ink, fontWeight: 400 },
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: { line: { borderColor: ds.line } },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: ds.r.sm,
          "&.Mui-selected": { backgroundColor: ds.action, color: ds.actionInk, "&:hover": { backgroundColor: `color-mix(in oklab, ${ds.action} 86%, ${ds.bg})` } },
        },
      },
    },

    // ------------------------------------------------------------ data display
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 999, fontSize: 13 },
        sizeSmall: { height: 24, fontSize: 12.5 },
        outlined: { borderColor: ds.lineStrong },
        filled: {},
        colorDefault: { backgroundColor: ds.surface },
        icon: { marginLeft: 8, ".MuiChip-sizeSmall > &": { marginLeft: 6 } },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: 14 },
        rounded: { borderRadius: ds.r.sm },
      },
    },
    MuiBadge: {
      styleOverrides: { badge: { fontWeight: 600, fontFamily: ds.fontMono } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: ds.r.md, alignItems: "center", fontSize: 14 },
        standard: { border: "1px solid", borderColor: "transparent" },
      },
      variants: [
        {
          props: { variant: "standard", severity: "info" },
          style: { backgroundColor: ds.bg, color: ds.ink, borderColor: ds.line, "& .MuiAlert-icon": { color: ds.ink } },
        },
      ],
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: inkMix(8) },
        bar: { borderRadius: 999 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: ds.line, fontSize: 14 },
        head: { fontWeight: 500, fontSize: 13, color: ds.muted, letterSpacing: "0.01em" },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { "&:last-child td": { borderBottom: 0 } } },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: inkMix(6) }, rounded: { borderRadius: ds.r.md } },
    },
  },
});
