"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle, InlineAlert, Toggle } from "@platned/ui";
import { Sparkles } from "lucide-react";
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
    <Card>
      <CardHeader size="sm">
        <CardTitle size="sm" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          AI features
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-3">
        <Toggle
          checked={checked}
          disabled={!canEdit || isPending}
          onChange={(next) => {
            setChecked(next);
            run(() => setCompanyAiFeatures({ companyId, enabled: next }), {
              // Put the switch back where it was if the server refused, rather
              // than leaving it showing a setting that isn't in effect.
              onError: () => setChecked(!next),
            });
          }}
          label="Allow retrospective content to be sent to an AI provider"
        />

        {checked ? (
          <InlineAlert tone="warning">
            Card text from this company&apos;s retrospectives may be sent to a third-party model
            provider. Anonymous boards stay anonymous — no names or ids are ever included — but the
            words themselves leave our infrastructure.
          </InlineAlert>
        ) : (
          <p className="text-body-sm text-default-secondary">
            Off. Nothing from this company&apos;s retrospectives leaves our infrastructure.
            Insights, themes and trends are unaffected — they are computed locally and work either
            way.
          </p>
        )}

        {!canEdit && (
          <p className="text-body-tiny text-default-secondary">
            Only a company admin can change this.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
