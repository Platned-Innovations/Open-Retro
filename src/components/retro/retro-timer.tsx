"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer, Play, Square } from "lucide-react";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { startTimer, stopTimer } from "@/server/actions/retros";
import { useAction } from "@/lib/useAction";

const PRESETS = [
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

export function RetroTimer({
  retrospectiveId,
  timerEndsAt,
  canModerate,
}: {
  retrospectiveId: string;
  timerEndsAt: Date | null;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState(String(PRESETS[1].seconds));
  const { run, isPending } = useAction();

  if (timerEndsAt) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Countdown key={timerEndsAt.getTime()} endsAt={timerEndsAt} onExpire={() => router.refresh()} />
        {canModerate && (
          <IconButton size="small" aria-label="Stop timer" onClick={() => run(() => stopTimer(retrospectiveId))}>
            <Square className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </Stack>
    );
  }

  if (!canModerate) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <TextField select size="small" value={preset} onChange={(e) => setPreset(e.target.value)} sx={{ width: 100 }}>
        {PRESETS.map((p) => (
          <MenuItem key={p.seconds} value={String(p.seconds)}>
            {p.label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="outlined"
        size="small"
        disabled={isPending}
        onClick={() => run(() => startTimer(retrospectiveId, Number(preset)))}
        startIcon={<Play className="h-3.5 w-3.5" />}
      >
        Start timer
      </Button>
    </Stack>
  );
}

/** Remounted (via `key`) whenever `endsAt` changes, so it never needs an
 * effect to react to prop changes -- only to the ticking clock itself. */
function Countdown({ endsAt, onExpire }: { endsAt: Date; onExpire: () => void }) {
  // Starts at null on both server and client so the very first render always
  // matches (no hydration mismatch from Date.now() differing by a few ms of
  // network latency between the SSR pass and the browser). The real value is
  // only ever computed client-side, inside a timer callback.
  const [remaining, setRemaining] = useState<number | null>(null);

  // `onExpire` is recreated on every parent render, so it must never be an
  // effect dependency. It used to be one, and the result was a refresh loop:
  // expiry called router.refresh() -> the board re-rendered -> a new onExpire
  // identity re-ran the effect -> `remaining` was still 0 (nothing clears
  // `timerEndsAt` on expiry, only stopTimer does) -> it fired again, forever,
  // for every participant. Holding it in a ref keeps the effect below keyed to
  // the clock alone.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    // `hasFired` lives inside the effect, so it resets exactly when it should:
    // Countdown is remounted via `key` whenever `endsAt` changes.
    let hasFired = false;

    const tick = () => {
      const next = Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 1000));
      setRemaining(next);
      if (next > 0 || hasFired) return;
      hasFired = true;
      // `interval` is declared below, but `tick` only ever runs from a timer
      // callback — never during this effect's synchronous body — so it is
      // always initialised by the time we get here.
      clearInterval(interval);
      onExpireRef.current();
    };

    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [endsAt]);

  const minutes = remaining !== null ? Math.floor(remaining / 60) : null;
  const seconds = remaining !== null ? remaining % 60 : null;
  const low = remaining !== null && remaining <= 30;

  return (
    <Chip
      icon={<Timer className="h-3.5 w-3.5" />}
      label={minutes !== null && seconds !== null ? `${minutes}:${seconds.toString().padStart(2, "0")}` : "--:--"}
      color={low ? "error" : "default"}
      variant="outlined"
      sx={{ fontVariantNumeric: "tabular-nums" }}
    />
  );
}
