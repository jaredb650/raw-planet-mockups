import Image from "next/image";

/** Raw Planet logo for the admin shell and login screen. */
export function Mark({ size = 28, variant = "mark" }: { size?: number; variant?: "mark" | "full" }) {
  if (variant === "full") {
    return (
      <Image
        src="/brand/logo-purple.png"
        alt="Raw Planet Experiences"
        width={Math.round(size * 0.883)}
        height={size}
        priority
        style={{ flex: "none", display: "block", width: "auto", height: size }}
      />
    );
  }
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden
      width={Math.round(size * 1.597)}
      height={size}
      priority
      style={{ flex: "none", display: "block", width: "auto", height: size }}
    />
  );
}
