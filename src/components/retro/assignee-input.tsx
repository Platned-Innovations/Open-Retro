"use client";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";

type Member = { id: string; name: string };

type Props = {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Chip input for multiple assignees — MUI's `Autocomplete` in `multiple`
 * mode, which already is the accessible combobox (arrow keys, Enter,
 * Backspace-to-remove-last, proper ARIA roles) the hand-rolled version here
 * used to reimplement.
 */
export function AssigneeInput({ members, selectedIds, onChange, placeholder, disabled, className }: Props) {
  const selected = selectedIds.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);

  return (
    <Autocomplete
      multiple
      disabled={disabled}
      className={className}
      size="small"
      options={members}
      value={selected}
      getOptionLabel={(m) => m.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, next) => onChange(next.map((m) => m.id))}
      renderValue={(value, getItemProps) =>
        value.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <Chip key={key} label={option.name} size="small" {...itemProps} />;
        })
      }
      renderInput={(params) => <TextField {...params} placeholder={selected.length === 0 ? (placeholder ?? "Type a name…") : ""} />}
    />
  );
}
