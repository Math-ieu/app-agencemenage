import { AVAILABLE_SERVICES } from "@/lib/blog-data";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";

interface ServiceSelectorProps {
  selected: string[];
  onChange: (services: string[]) => void;
  label?: string;
}

const ServiceSelector = ({ selected, onChange, label }: ServiceSelectorProps) => {
  const toggle = (service: string) => {
    if (selected.includes(service)) {
      onChange(selected.filter((s) => s !== service));
    } else {
      onChange([...selected, service]);
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_SERVICES.map((service) => {
          const isSelected = selected.includes(service);
          return (
            <Badge
              key={service}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-colors text-xs ${
                isSelected
                  ? "bg-accent text-accent-foreground hover:bg-accent/80"
                  : "hover:bg-muted"
              }`}
              onClick={() => toggle(service)}
            >
              {isSelected && <Check className="h-3 w-3 mr-1" />}
              {service}
              {isSelected && <X className="h-3 w-3 ml-1" />}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceSelector;
