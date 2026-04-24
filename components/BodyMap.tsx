"use client";

import { useEffect, useState } from "react";
import type { BodyRegionId } from "@/lib/types";

type BodyMapView = "front" | "back";

type BodyMapProps = {
  view: BodyMapView;
  selectedRegions?: BodyRegionId[];
  onRegionClick?: (region: BodyRegionId) => void;
};

const VIEW_IMAGE_PRIMARY: Record<BodyMapView, string> = {
  front: "/body-map/front.png",
  back: "/body-map/back.png",
};

const VIEW_IMAGE_FALLBACK: Record<BodyMapView, string> = {
  front: "/body-map/front.svg",
  back: "/body-map/back.svg",
};

const FRONT_OVERLAY_FRAME = {
  x: 223.19,
  y: 333.66,
  width: 173.3,
  height: 473.14,
};

function regionPathClass(selected: boolean) {
  return `cursor-pointer transition-colors duration-150 pointer-events-auto ${
    selected
      ? "fill-blue-500/45 stroke-blue-400 hover:fill-blue-400/50"
      : "fill-blue-500/0 stroke-slate-400/35 hover:fill-blue-500/25 hover:stroke-blue-300/60 active:fill-blue-500/30"
  }`;
}

export function BodyMap({ view, selectedRegions = [], onRegionClick }: BodyMapProps) {
  const [imgSrc, setImgSrc] = useState<string>(VIEW_IMAGE_PRIMARY[view]);

  useEffect(() => {
    setImgSrc(VIEW_IMAGE_PRIMARY[view]);
  }, [view]);

  return (
    <div className="relative aspect-3/5 w-full overflow-hidden rounded-xl">
      <img
        src={imgSrc}
        alt={`${view} body map`}
        className="h-full w-full object-contain object-center mix-blend-screen"
        draggable={false}
        onError={() => {
          if (imgSrc !== VIEW_IMAGE_FALLBACK[view]) {
            setImgSrc(VIEW_IMAGE_FALLBACK[view]);
          }
        }}
      />

      {/* SVG overlay canvas */}
      <svg
        viewBox="0 0 618 824"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {/* ── FRONT ── */}
        {view === "front" && (
          <>
            {/* Main front overlay group from your 177x476 export */}
            <svg
              x={FRONT_OVERLAY_FRAME.x}
              y={FRONT_OVERLAY_FRAME.y}
              width={FRONT_OVERLAY_FRAME.width}
              height={FRONT_OVERLAY_FRAME.height}
              viewBox="0 0 177 476"
              overflow="visible"
            >
              <path
                d="M9.31264 70.5C5.8127 70.5 19.3127 12.9995 24.8126 1.50003C28.6731 -6.57151 92.5373 90.9093 85.3126 88.5006C76.3126 85.5 67.3127 70.5 9.31264 70.5Z"
                onClick={() => onRegionClick?.("left_hip")}
                className={regionPathClass(selectedRegions.includes("left_hip"))}
                strokeWidth="1"
                role="button"
                aria-label="Left hip"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("left_hip")}
              />
              <path
                d="M26.8126 412.5C33.3673 393.049 -1.6874 282.244 12.3126 275.5C26.3126 268.756 60.3126 268.5 71.8126 275.5C83.3126 282.5 58.7357 377.5 63.8126 410.5L63.9061 411.108C68.9172 443.675 71.0896 457.794 53.8126 468.5C36.4286 479.273 11.2855 477.378 2.3126 459C-6.66029 440.622 20.2579 431.951 26.8126 412.5Z"
                onClick={() => onRegionClick?.("left_ankle_foot")}
                className={regionPathClass(selectedRegions.includes("left_ankle_foot"))}
                strokeWidth="1"
                role="button"
                aria-label="Left foot"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("left_ankle_foot")}
              />
              <path
                d="M149.412 412.655C142.858 393.204 177.912 282.399 163.912 275.655C149.912 268.91 115.912 268.655 104.412 275.655C92.9122 282.655 117.489 377.655 112.412 410.655L112.319 411.262C107.308 443.83 105.135 457.948 122.412 468.655C139.796 479.427 164.939 477.532 173.912 459.155C182.885 440.777 155.967 432.106 149.412 412.655Z"
                onClick={() => onRegionClick?.("right_ankle_foot")}
                className={regionPathClass(selectedRegions.includes("right_ankle_foot"))}
                strokeWidth="1"
                role="button"
                aria-label="Right foot"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("right_ankle_foot")}
              />
              <path
                d="M22.8126 269.5C-5.18735 279.155 27.3126 247 9.81265 190.5C3.222 169.222 83.9774 177.649 80.8126 190.5C64.3127 257.5 84.8126 279.5 62.8127 269.5C49.6752 263.529 33.3126 265.879 22.8126 269.5Z"
                onClick={() => onRegionClick?.("left_knee")}
                className={regionPathClass(selectedRegions.includes("left_knee"))}
                strokeWidth="1"
                role="button"
                aria-label="Left knee"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("left_knee")}
              />
              <path
                d="M151.403 268.488C179.403 278.143 146.903 245.988 164.403 189.488C170.994 168.21 90.2385 176.637 93.4033 189.488C109.903 256.488 89.4033 278.488 111.403 268.488C124.541 262.517 140.903 264.867 151.403 268.488Z"
                onClick={() => onRegionClick?.("right_knee")}
                className={regionPathClass(selectedRegions.includes("right_knee"))}
                strokeWidth="1"
                role="button"
                aria-label="Right knee"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("right_knee")}
              />
              <path
                d="M8.81264 179C4.31261 180.671 -0.687369 91.4334 8.81264 77.5C16.3126 66.5001 75.3126 77.5 89.3126 96C96.2128 105.118 83.3126 183.5 83.3126 183.5C83.3126 183.5 43.8127 166 8.81264 179Z"
                onClick={() => onRegionClick?.("left_upper_leg")}
                className={regionPathClass(selectedRegions.includes("left_upper_leg"))}
                strokeWidth="1"
                role="button"
                aria-label="Left upper leg"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("left_upper_leg")}
              />
              <path
                d="M165.843 178.385C170.343 180.057 175.343 90.8187 165.843 76.8853C158.343 65.8854 99.343 76.8853 85.343 95.3853C78.4429 104.503 91.343 182.885 91.343 182.885C91.343 182.885 130.843 165.385 165.843 178.385Z"
                onClick={() => onRegionClick?.("right_upper_leg")}
                className={regionPathClass(selectedRegions.includes("right_upper_leg"))}
                strokeWidth="1"
                role="button"
                aria-label="Right upper leg"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("right_upper_leg")}
              />
              <path
                d="M164.882 69.9751C168.382 69.9751 154.882 12.4746 149.382 0.975132C145.521 -7.09641 81.6571 90.3844 88.8818 87.9757C97.8818 84.9751 106.882 69.9751 164.882 69.9751Z"
                onClick={() => onRegionClick?.("right_hip")}
                className={regionPathClass(selectedRegions.includes("right_hip"))}
                strokeWidth="1"
                role="button"
                aria-label="Right hip"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("right_hip")}
              />
            </svg>

            {/* Abdomen overlay from your 134x143 export; fine-tune x/y if needed */}
            <svg
              x={244.2}
              y={219.43}
              width={132.21}
              height={141.08}
              viewBox="0 0 134 143"
              overflow="visible"
            >
              <path
                d="M2.29719 106.07C-2.7028 95.0696 3.79744 29.5697 8.79721 11.5697C12.6859 -2.43037 118.836 -3.93037 124.797 11.5697C132.297 31.0696 135.797 88.0696 129.297 102.57C121.31 120.387 101.778 141.975 67.7972 141.57C34.2412 141.169 7.9445 118.494 2.29719 106.07Z"
                onClick={() => onRegionClick?.("abdomen")}
                className={regionPathClass(selectedRegions.includes("abdomen"))}
                strokeWidth="1"
                role="button"
                aria-label="Abdomen"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRegionClick?.("abdomen")}
              />
            </svg>
          </>
        )}

        {/* ── BACK ── */}
        {view === "back" && (
          <>
            {/* TODO: add back-view paths */}
          </>
        )}
      </svg>
    </div>
  );
}
