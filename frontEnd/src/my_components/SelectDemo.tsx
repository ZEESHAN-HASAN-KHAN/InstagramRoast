import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectDemo({ language, onValueChange }) {
  return (
    <Select value={language} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Language</SelectLabel>
          <SelectItem value="english">English</SelectItem>
          <SelectItem value="hinglish">Hinglish</SelectItem>
          <SelectItem value="hindi">Hindi</SelectItem>
          <SelectItem value="اردو">Urdu</SelectItem>
          <SelectItem value="spanish">Spanish</SelectItem>
          <SelectItem value="bangla">Bengali</SelectItem>
          <SelectItem value="korean">Korean</SelectItem>
          {/* <SelectItem value="pineapple">French</SelectItem> */}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
