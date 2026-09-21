import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { EyeOff } from "lucide-react";

/**
 * Stands in for the cards safe ideation is withholding.
 *
 * Saying how many there are matters: an empty-looking column reads as "nobody
 * has written anything", which is discouraging and untrue. The cards
 * themselves were never fetched — this count comes from a separate aggregate.
 */
export function HiddenCardsNotice({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", justifyContent: "center", border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 2, px: 1.5, py: 2 }}
    >
      <EyeOff className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
        {count === 1 ? "1 card from someone else" : `${count} cards from others`}, hidden until collecting ends
      </Typography>
    </Stack>
  );
}
