import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = Omit<React.ComponentProps<typeof Button>, "type"> & {
  pending: boolean;
  pendingText?: string;
};

export function SubmitButton({ pending, pendingText, children, disabled, className, ...props }: Props) {
  return (
    <Button type="submit" size="lg" disabled={pending || disabled} className={className ?? "w-full"} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingText ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
