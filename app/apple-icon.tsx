import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS auto-rounds and adds the home-screen squircle, so we fill edge-to-edge
  // with the brand background and put the % on top.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#22c55e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0b0d10",
          fontSize: 140,
          fontWeight: 900,
          letterSpacing: -4,
          fontFamily: "system-ui",
        }}
      >
        %
      </div>
    ),
    { ...size },
  );
}
