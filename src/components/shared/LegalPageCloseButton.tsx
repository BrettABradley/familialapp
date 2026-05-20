import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LegalPageCloseButton = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div
      className="fixed top-0 right-0 z-50 p-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
    >
      <Button
        variant="secondary"
        size="icon"
        onClick={handleClose}
        aria-label="Close"
        className="rounded-full shadow-md border border-border h-10 w-10"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default LegalPageCloseButton;
