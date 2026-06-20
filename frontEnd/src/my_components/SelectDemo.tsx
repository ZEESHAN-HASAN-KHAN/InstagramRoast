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
  language: string;
  onValueChange: (value: string) => void;
}

export function SelectDemo({ language, onValueChange }: SelectDemoProps) {
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
          {/* <SelectItem value="اردو">Urdu</SelectItem> */}
          <SelectItem value="spanish">Spanish</SelectItem>
          <SelectItem value="bangla">Bengali</SelectItem>
          <SelectItem value="bahasa indonesia">Bahasa Indonesia</SelectItem>
          <SelectItem value="singlish">Singlish (Singapore)</SelectItem>
          <SelectItem value="italian">Italian</SelectItem>
          <SelectItem value="french">French</SelectItem>
          <SelectItem value="german">German</SelectItem>
          <SelectItem value="malay">Malay (Malaysia)</SelectItem>
          {/* <SelectItem value="korean">Korean</SelectItem> */}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
