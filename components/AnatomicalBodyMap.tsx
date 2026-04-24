"use client";

import type { BodyRegionId } from "@/lib/types";

type RegionSpec = {
  regionId: BodyRegionId;
  svgId: string;
  label: string;
  d: string;
};

type AnatomicalBodyMapProps = {
  view: "front" | "back";
  selectedRegions: Set<BodyRegionId>;
  onSelectRegion: (regionId: BodyRegionId) => void;
  title: string;
};

const frontRegions: RegionSpec[] = [
  {
    regionId: "head_neck",
    svgId: "head-neck",
    label: "Head and neck",
    d: "M90 18 C78 20 70 31 70 43 C70 56 77 66 85 70 L85 86 C85 92 89 97 94 97 C99 97 103 92 103 86 L103 70 C111 66 118 56 118 43 C118 30 109 20 96 18 Z",
  },
  {
    regionId: "left_shoulder",
    svgId: "left-shoulder",
    label: "Left shoulder",
    d: "M53 96 C59 88 67 83 77 80 C77 89 74 99 68 108 C62 112 56 112 49 108 Z",
  },
  {
    regionId: "right_shoulder",
    svgId: "right-shoulder",
    label: "Right shoulder",
    d: "M131 96 C125 88 117 83 107 80 C107 89 110 99 116 108 C122 112 128 112 135 108 Z",
  },
  {
    regionId: "chest",
    svgId: "chest",
    label: "Chest",
    d: "M69 100 C76 94 84 91 94 91 C104 91 112 94 119 100 L114 149 C107 154 100 157 94 157 C88 157 81 154 74 149 Z",
  },
  {
    regionId: "abdomen",
    svgId: "abdomen",
    label: "Abdomen",
    d: "M74 150 C81 154 87 156 94 156 C101 156 107 154 114 150 L113 193 C106 199 100 202 94 202 C88 202 82 199 75 193 Z",
  },
  {
    regionId: "left_hip",
    svgId: "left-hip",
    label: "Left hip",
    d: "M60 187 C66 185 72 187 77 194 C76 201 72 207 66 211 C61 209 57 204 56 197 Z",
  },
  {
    regionId: "right_hip",
    svgId: "right-hip",
    label: "Right hip",
    d: "M128 187 C122 185 116 187 111 194 C112 201 116 207 122 211 C127 209 131 204 132 197 Z",
  },
  {
    regionId: "left_upper_leg",
    svgId: "left-upper-leg",
    label: "Left upper leg",
    d: "M65 211 C72 217 77 227 77 238 L74 285 C69 293 63 296 56 291 L52 243 C53 230 57 220 65 211 Z",
  },
  {
    regionId: "right_upper_leg",
    svgId: "right-upper-leg",
    label: "Right upper leg",
    d: "M123 211 C116 217 111 227 111 238 L114 285 C119 293 125 296 132 291 L136 243 C135 230 131 220 123 211 Z",
  },
  {
    regionId: "left_knee",
    svgId: "left-knee",
    label: "Left knee",
    d: "M57 292 C63 289 68 289 74 292 L73 310 C67 313 62 313 56 310 Z",
  },
  {
    regionId: "right_knee",
    svgId: "right-knee",
    label: "Right knee",
    d: "M114 292 C120 289 125 289 131 292 L132 310 C126 313 121 313 115 310 Z",
  },
  {
    regionId: "left_lower_leg",
    svgId: "left-lower-leg",
    label: "Left lower leg",
    d: "M56 311 C62 315 67 315 73 311 L71 350 C66 358 60 359 54 351 Z",
  },
  {
    regionId: "right_lower_leg",
    svgId: "right-lower-leg",
    label: "Right lower leg",
    d: "M115 311 C121 315 126 315 132 311 L134 351 C128 359 122 358 117 350 Z",
  },
  {
    regionId: "left_ankle_foot",
    svgId: "left-foot",
    label: "Left foot",
    d: "M53 351 C60 356 66 357 72 352 L74 365 C66 373 53 374 46 367 Z",
  },
  {
    regionId: "right_ankle_foot",
    svgId: "right-foot",
    label: "Right foot",
    d: "M116 352 C122 357 128 356 135 351 L141 367 C134 374 121 373 113 365 Z",
  },
];

const backRegions: RegionSpec[] = [
  {
    regionId: "head_neck",
    svgId: "head-neck",
    label: "Head and neck",
    d: "M90 18 C78 20 70 31 70 43 C70 56 77 66 85 70 L85 87 C85 93 89 98 94 98 C99 98 103 93 103 87 L103 70 C111 66 118 56 118 43 C118 30 109 20 96 18 Z",
  },
  {
    regionId: "left_shoulder",
    svgId: "left-shoulder",
    label: "Left shoulder",
    d: "M52 96 C59 88 67 83 78 80 C79 89 76 99 69 107 C63 112 57 112 50 108 Z",
  },
  {
    regionId: "right_shoulder",
    svgId: "right-shoulder",
    label: "Right shoulder",
    d: "M132 96 C125 88 117 83 106 80 C105 89 108 99 115 107 C121 112 127 112 134 108 Z",
  },
  {
    regionId: "upper_back",
    svgId: "upper-back",
    label: "Upper back",
    d: "M69 100 C76 95 85 92 94 92 C103 92 112 95 119 100 L116 151 C108 157 101 160 94 160 C87 160 80 157 72 151 Z",
  },
  {
    regionId: "lower_back",
    svgId: "lower-back",
    label: "Lower back",
    d: "M72 152 C79 157 86 160 94 160 C102 160 109 157 116 152 L115 196 C108 202 101 205 94 205 C87 205 80 202 73 196 Z",
  },
  {
    regionId: "left_hip",
    svgId: "left-hip",
    label: "Left hip",
    d: "M61 196 C67 193 73 194 78 200 C77 208 73 214 67 218 C61 216 57 211 56 204 Z",
  },
  {
    regionId: "right_hip",
    svgId: "right-hip",
    label: "Right hip",
    d: "M127 196 C121 193 115 194 110 200 C111 208 115 214 121 218 C127 216 131 211 132 204 Z",
  },
  {
    regionId: "left_upper_leg",
    svgId: "left-upper-leg",
    label: "Left upper leg",
    d: "M66 218 C73 225 77 235 77 246 L74 291 C69 299 63 302 56 296 L52 249 C53 236 57 227 66 218 Z",
  },
  {
    regionId: "right_upper_leg",
    svgId: "right-upper-leg",
    label: "Right upper leg",
    d: "M122 218 C115 225 111 235 111 246 L114 291 C119 299 125 302 132 296 L136 249 C135 236 131 227 122 218 Z",
  },
  {
    regionId: "left_knee",
    svgId: "left-knee",
    label: "Left knee",
    d: "M57 297 C63 294 68 294 74 297 L74 315 C68 318 63 318 57 315 Z",
  },
  {
    regionId: "right_knee",
    svgId: "right-knee",
    label: "Right knee",
    d: "M114 297 C120 294 125 294 131 297 L131 315 C125 318 120 318 114 315 Z",
  },
  {
    regionId: "left_lower_leg",
    svgId: "left-lower-leg",
    label: "Left lower leg",
    d: "M57 316 C63 320 68 320 74 316 L72 352 C67 361 61 362 55 354 Z",
  },
  {
    regionId: "right_lower_leg",
    svgId: "right-lower-leg",
    label: "Right lower leg",
    d: "M114 316 C120 320 125 320 131 316 L133 354 C127 362 121 361 116 352 Z",
  },
  {
    regionId: "left_ankle_foot",
    svgId: "left-foot",
    label: "Left foot",
    d: "M54 354 C60 359 66 360 72 355 L75 369 C67 377 54 378 47 371 Z",
  },
  {
    regionId: "right_ankle_foot",
    svgId: "right-foot",
    label: "Right foot",
    d: "M116 355 C122 360 128 359 134 354 L141 371 C134 378 121 377 113 369 Z",
  },
];

function contourPaths(view: "front" | "back") {
  if (view === "front") {
    return [
      "M70 112 C78 106 86 104 94 104 C102 104 110 106 118 112",
      "M76 116 C80 126 80 135 76 146",
      "M112 116 C108 126 108 135 112 146",
      "M75 142 C81 147 87 149 94 149 C101 149 107 147 113 142",
      "M86 150 C88 162 88 173 86 186",
      "M102 150 C100 162 100 173 102 186",
      "M76 172 C82 176 88 178 94 178 C100 178 106 176 112 172",
      "M72 206 C75 214 77 223 76 232",
      "M116 206 C113 214 111 223 112 232",
      "M65 232 C68 246 68 262 65 282",
      "M123 232 C120 246 120 262 123 282",
      "M59 318 C62 324 65 332 65 340",
      "M129 318 C126 324 123 332 123 340",
    ];
  }

  return [
    "M71 112 C79 106 87 104 94 104 C101 104 109 106 117 112",
    "M78 116 C82 124 83 132 80 142",
    "M110 116 C106 124 105 132 108 142",
    "M74 144 C80 150 87 154 94 154 C101 154 108 150 114 144",
    "M86 151 C89 161 89 171 87 182",
    "M102 151 C99 161 99 171 101 182",
    "M75 175 C81 181 87 184 94 184 C101 184 107 181 113 175",
    "M73 212 C76 220 77 229 76 240",
    "M115 212 C112 220 111 229 112 240",
    "M66 239 C69 252 69 269 66 287",
    "M122 239 C119 252 119 269 122 287",
    "M60 322 C63 330 65 338 65 347",
    "M128 322 C125 330 123 338 123 347",
  ];
}

export function AnatomicalBodyMap({ view, selectedRegions, onSelectRegion, title }: AnatomicalBodyMapProps) {
  const regions = view === "front" ? frontRegions : backRegions;
  const contours = contourPaths(view);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-2">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</p>
      <div className="mx-auto w-full max-w-44 rounded-xl bg-slate-900 px-3 py-2">
        <svg viewBox="0 0 188 390" className="h-auto w-full" preserveAspectRatio="xMidYMid meet" aria-label={`${title} anatomical body map`}>
          <defs>
            <linearGradient id={`anatomy-shade-${view}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          <path
            d="M90 18 C78 20 70 31 70 43 C70 56 77 66 85 70 L85 86 C85 93 89 98 94 98 C99 98 103 93 103 86 L103 70 C111 66 118 56 118 43 C118 30 109 20 96 18 Z M53 96 C65 85 79 80 94 80 C109 80 123 85 135 96 L126 130 L132 197 C125 214 117 220 108 223 L111 248 L114 291 L132 291 L136 248 L139 352 L141 371 C133 379 121 378 113 369 L114 316 L111 246 C109 235 103 228 94 225 C85 228 79 235 77 246 L74 316 L75 369 C67 379 54 379 47 371 L54 354 L52 249 L56 296 L74 291 L77 246 L80 223 C71 220 63 214 56 197 L62 130 Z"
            fill="#94a3b8"
            fillOpacity="0.35"
          />
          <path
            d="M71 104 C78 98 86 95 94 95 C102 95 110 98 117 104 L112 195 C106 201 100 204 94 204 C88 204 82 201 76 195 Z"
            fill={`url(#anatomy-shade-${view})`}
          />

          {contours.map((path, index) => (
            <path
              key={`${view}-contour-${index}`}
              d={path}
              fill="none"
              stroke="#cbd5e1"
              strokeOpacity="0.26"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          ))}

          {regions.map((region) => {
            const isSelected = selectedRegions.has(region.regionId);
            return (
              <path
                key={`${view}-${region.svgId}`}
                id={`${region.svgId}-${view}`}
                data-region-id={region.svgId}
                d={region.d}
                role="button"
                tabIndex={0}
                aria-label={region.label}
                fill={isSelected ? "#3b82f6" : "#94a3b8"}
                fillOpacity={isSelected ? 0.42 : 0.26}
                stroke={isSelected ? "#60a5fa" : "#cbd5e1"}
                strokeOpacity={isSelected ? 0.9 : 0.35}
                strokeWidth={isSelected ? 1.4 : 1.1}
                className="cursor-pointer transition duration-150 hover:brightness-125 hover:fill-blue-500 hover:fill-opacity-45 active:brightness-150 focus-visible:outline-none"
                onClick={() => onSelectRegion(region.regionId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRegion(region.regionId);
                  }
                }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
