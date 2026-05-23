import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Trash2 } from "lucide-react";

type Props = {
  value?: string;
  onChange: (v: string | undefined) => void;
  name?: string;
};

export function AvatarUploader({ value, onChange, name }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const initials = (name ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 ring-2 ring-border">
        <AvatarImage src={value} alt="Avatar" />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Changer la photo
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive animate-fade-in"
            onClick={() => onChange(undefined)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Retirer
          </Button>
        )}
      </div>
    </div>
  );
}
