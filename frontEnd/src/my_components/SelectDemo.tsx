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
          <SelectItem value="apple">English</SelectItem>
          <SelectItem value="banana">Hindi</SelectItem>
          <SelectItem value="blueberry">Urdu</SelectItem>
          <SelectItem value="grapes">Spanish</SelectItem>
          <SelectItem value="pineapple">Germany</SelectItem>
          {/* <SelectItem value="pineapple">French</SelectItem> */}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
