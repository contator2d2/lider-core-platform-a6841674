import logoAsset from "@/assets/lidercore-logo.png.asset.json";

type Props = {
  className?: string;
  variant?: "full" | "mark";
  alt?: string;
};

/**
 * Official LÍDER C.O.R.E. wordmark (Neo Pessoas).
 * - `full`: wide horizontal lockup — use in headers, footers, expanded sidebar.
 * - `mark`: cropped to the orange "o" symbol — use in compact/collapsed contexts.
 */
export function Logo({ className, variant = "full", alt = "LÍDER C.O.R.E." }: Props) {
  if (variant === "mark") {
    // Crop the logo to show just the orange "o" symbol.
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          backgroundImage: `url(${logoAsset.url})`,
          backgroundRepeat: "no-repeat",
          // Focus on the orange "o" in the top wordmark
          backgroundPosition: "48% 50%",
          backgroundSize: "400% auto",
          aspectRatio: "1 / 1",
        }}
        role="img"
        aria-label={alt}
      />
    );
  }
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={className}
      style={{ objectFit: "contain", objectPosition: "left center" }}
    />
  );
}