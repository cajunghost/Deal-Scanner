import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0d10",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 152,
            height: 152,
            borderRadius: 36,
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b0d10",
            fontSize: 110,
            fontWeight: 900,
            letterSpacing: -4,
            fontFamily: "system-ui",
          }}
        >
          %
        </div>
      </div>
    ),
    { ...size },
  );
}
