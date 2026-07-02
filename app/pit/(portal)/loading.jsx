"use client";
import { useTheme } from "@/components/shared-nav";

function Bar({ w, h = 12, dark }) {
  const a = dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)";
  const b = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
  return <div className="rounded-md" style={{ width: w, height: h, background: `linear-gradient(90deg,${a} 25%,${b} 37%,${a} 63%)`, backgroundSize: "400% 100%", animation: "skel-shimmer 1.8s ease infinite" }} />;
}

function Card({ h = 100, dark, t }) {
  return <div className="rounded-[14px]" style={{ height: h, background: t.surface, border: `1px solid ${t.surfaceBrd}` }} />;
}

export default function PitLoading() {
  const { dark, t } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
        <Card h={95} dark={dark} t={t} />
        <Card h={95} dark={dark} t={t} />
      </div>
      <Card h={80} dark={dark} t={t} />
      <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="py-[10px] px-[18px]" style={{ borderBottom: `1px solid ${t.surfaceBrd}` }}>
          <Bar w={120} h={12} dark={dark} />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 px-[18px] py-[14px]" style={{ borderTop: i > 1 ? `1px solid ${t.surfaceBrd}` : undefined }}>
            <div className="flex-1 flex flex-col gap-2">
              <Bar w={140} h={13} dark={dark} />
              <Bar w={90} h={10} dark={dark} />
            </div>
            <Bar w={70} h={13} dark={dark} />
          </div>
        ))}
      </div>
    </div>
  );
}
