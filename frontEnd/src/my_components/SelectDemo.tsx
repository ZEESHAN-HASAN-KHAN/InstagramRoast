import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectDemoProps {
  value: string;
  onChange: (value: string) => void;
}

export function SelectDemo({value, onChange}: SelectDemoProps) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Language</SelectLabel>
          <SelectItem value="english">English</SelectItem>
          <SelectItem value="hindi">Hindi</SelectItem>
          <SelectItem value="urdu">Urdu</SelectItem>
          <SelectItem value="spanish">Spanish</SelectItem>
          <SelectItem value="germany">Germany</SelectItem>
          {/* <SelectItem value="pineapple">French</SelectItem> */}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
