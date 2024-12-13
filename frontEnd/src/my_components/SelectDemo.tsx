import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectDemo() {
  return (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Language</SelectLabel>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="en-hi">Hindi</SelectItem>
          <SelectItem value="en-ur">Urdu</SelectItem>
          <SelectItem value="sp">Spanish</SelectItem>
          <SelectItem value="gr">Germany</SelectItem>
          {/* <SelectItem value="pineapple">French</SelectItem> */}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
