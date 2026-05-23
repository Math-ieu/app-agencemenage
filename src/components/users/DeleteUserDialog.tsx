import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User } from "@/lib/user-schema";

type Props = {
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteUserDialog({ user, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Le compte de{" "}
            <span className="font-medium text-foreground">{user?.fullName}</span>{" "}
            sera définitivement supprimé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
