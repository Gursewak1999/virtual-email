import * as React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export interface DurationPickerProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}

export function DurationPicker({
  value,
  onChange,
  options = [30, 45, 60],
}: DurationPickerProps) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select duration" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={String(opt)}>
            {opt} min
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
