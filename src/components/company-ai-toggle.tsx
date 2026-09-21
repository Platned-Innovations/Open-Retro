"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { setCompanyAiFeatures } from "@/server/actions/companies";
import { useAction } from "@/lib/useAction";

/**
 * The company's own decision about whether its retrospectives may leave the
 * infrastructure.
 *
 * Shown to members as well as admins, read-only, because "is our data being
 * sent anywhere" is a question everyone who writes a card is entitled to an
 * answer to — not just the person who set it.
 */
export function CompanyAiToggle({
  companyId,
  enabled,
  canEdit,
}: {
  companyId: string;
  enabled: boolean;
  canEdit: boolean;
}) {
  const { run, isPending } = useAction();
  const [checked, setChecked] = useState(enabled);

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <AutoAwesomeIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              AI features
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
        <FormControlLabel
          control={
            <Switch
              checked={checked}
              disabled={!canEdit || isPending}
              onChange={(e) => {
                const next = e.target.checked;
                setChecked(next);
                run(() => setCompanyAiFeatures({ companyId, enabled: next }), {
                  // Put the switch back where it was if the server refused, rather
                  // than leaving it showing a setting that isn't in effect.
                  onError: () => setChecked(!next),
                });
              }}
            />
          }
          label="Allow retrospective content to be sent to an AI provider"
        />

        {checked ? (
          <Alert severity="warning">
            Card text from this company&apos;s retrospectives may be sent to a third-party model
            provider. Anonymous boards stay anonymous — no names or ids are ever included — but the
            words themselves leave our infrastructure.
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Off. Nothing from this company&apos;s retrospectives leaves our infrastructure. Insights,
            themes and trends are unaffected — they are computed locally and work either way.
          </Typography>
        )}

        {!canEdit && (
          <Typography variant="caption" color="text.secondary">
            Only a company admin can change this.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
