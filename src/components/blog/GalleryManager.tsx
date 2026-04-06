import { useState, useRef } from "react";
import { GalleryImage, generateId } from "@/lib/blog-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, Film, Image } from "lucide-react";

interface GalleryManagerProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
}

const GalleryManager = ({ images, onChange }: GalleryManagerProps) => {
  const [newTitle, setNewTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        onChange([
          ...images,
          {
            id: generateId(),
            url,
            title: newTitle.trim() || file.name,
            type: isVideo ? "video" : "image",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    setNewTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    onChange(images.filter((img) => img.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    onChange(images.map((img) => (img.id === id ? { ...img, title } : img)));
  };

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((img) => (
            <div key={img.id} className="rounded-lg border border-border bg-muted/30 overflow-hidden group">
              <div className="relative aspect-video">
                {img.type === "video" ? (
                  <video src={img.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2 left-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
                    {img.type === "video" ? <Film className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                    {img.type === "video" ? "Vidéo" : "Image"}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(img.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-2">
                <Input
                  value={img.title}
                  onChange={(e) => updateTitle(img.id, e.target.value)}
                  placeholder="Titre du média"
                  className="text-xs h-8"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImagePlus className="h-4 w-4" />
          <span>Ajouter une image ou vidéo</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Fichier (image ou vidéo)</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="mt-1 text-sm cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Titre (optionnel)</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre du média"
              className="mt-1 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryManager;
