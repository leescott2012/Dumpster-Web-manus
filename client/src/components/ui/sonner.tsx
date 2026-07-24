import { Toaster as Sonner, type ToasterProps } from "sonner";

var Toaster = function(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
