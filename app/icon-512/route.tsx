import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
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
            width: 408,
            height: 408,
            borderRadius: 96,
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b0d10",
            fontSize: 296,
            fontWeight: 900,
            letterSpacing: -10,
            fontFamily: "system-ui",
          }}
        >
          %
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
