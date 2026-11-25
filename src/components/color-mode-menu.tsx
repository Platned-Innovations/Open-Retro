"use client";

import { useState } from "react";
import { useColorScheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import { Check, Monitor, Moon, Sun } from "lucide-react";

const MODES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

type Mode = (typeof MODES)[number]["value"];

/**
 * Light, dark or follow the OS. MUI keeps the choice in localStorage
 * (`mui-mode`) and InitColorSchemeScript applies it before first paint.
 *
 * `mode` is undefined until the component mounts (the server can't know the
 * stored choice), so the button shows the System icon until then rather than
 * guessing and mismatching on hydration.
 */
export function ColorModeMenu() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const current = MODES.find((m) => m.value === mode) ?? MODES[2];
  const CurrentIcon = current.Icon;

  function choose(value: Mode) {
    setMode(value);
    setAnchor(null);
  }

  return (
    <>
      <Tooltip title="Appearance">
        <IconButton
          aria-label={`Appearance: ${current.label}`}
          aria-haspopup="menu"
          aria-expanded={anchor ? "true" : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: 40, height: 40, color: "text.secondary", "&:hover": { color: "text.primary" } }}
        >
          <CurrentIcon className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.75, minWidth: 168 } } }}
      >
        {MODES.map(({ value, label, Icon }) => {
          const selected = mode === value;
          return (
            <MenuItem key={value} selected={selected} onClick={() => choose(value)}>
              <ListItemIcon sx={{ minWidth: "28px !important", color: "inherit" }}>
                <Icon className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
              {selected && <Check className="h-4 w-4" aria-hidden />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
