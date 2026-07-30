"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCandidates, getJobReqs, syncFromSupabase } from "@/lib/store";
import { ALL_COMPANIES, getActiveCompanyId, setActiveCompanyId, type CompanyProfile } from "@/lib/payroll/company-profile";
import { useAuthGate, signOut } from "@/lib/use-auth";
import { Toaster } from "@/components/toast";
import { ErrorBoundary } from "@/components/error-boundary";

type Theme = "light" | "dark" | "system";

interface NavItem {
  id: string;
  label: string;
  href: string;
  badge?: number;
  section: "main" | "pay" | "tools";
  soon?: boolean;
}

export function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Icons ─── */

export function Icon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      {children}
    </svg>
  );
}

export const ICON_PATHS = {
  dashboard: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  users: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  briefcase: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.763.183-1.555.349-2.373.49m-11.31 0a48.11 48.11 0 01-2.373-.49 2.25 2.25 0 01-1.837-2.175V6.75a2.18 2.18 0 00.75-1.661m0 0A48.118 48.118 0 0112 3c2.356 0 4.692.284 6.978.832M12 3v1.5m0 0V3m0 1.5h6.75",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  document: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75M9.75 21v-7.875a3.375 3.375 0 013.375-3.375h3.375M9.75 21H5.625a1.125 1.125 0 01-1.125-1.125v-9.75a1.125 1.125 0 011.125-1.125h9.75",
  scan: "M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M16.5 20.25H18A2.25 2.25 0 0020.25 18v-1.5M7.5 20.25H6A2.25 2.25 0 003.75 18v-1.5M9 12.75h6",
  workspace: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
  report: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75v-.75V4.875C9.75 4.256 10.306 3.75 11 3.75H15M9.75 15.75h4.5M9.75 12h4.5m-6-3h1.5m-1.5 3h1.5m-1.5 3h1.5",
  cog: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z",
  plug: "M13.5 6.75H12v4.5h1.5m-1.5-9h1.5m-3.75 3h15a2.25 2.25 0 012.25 2.25v6.75A2.25 2.25 0 0118 18.75H6A2.25 2.25 0 013.75 16.5v-6.75A2.25 2.25 0 016 7.5h1.5m9 0V6a2.25 2.25 0 00-2.25-2.25H9.75A2.25 2.25 0 007.5 6v1.5",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  bell: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  menu: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  close: "M6 18L18 6M6 6l12 12",
  chevron: "M8.25 4.5l7.5 7.5-7.5 7.5",
  chevronDown: "M19.5 8.25l-7.5 7.5-7.5-7.5",
  sun: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
  moon: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  arrowRight: "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3",
  arrowLeft: "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18",
  check: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125",
  eye: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z",
  eyeCircle: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  sparkles: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z",
  upload: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5",
  documentPdf: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75M9.75 21v-7.875a3.375 3.375 0 013.375-3.375h3.375M9.75 21H5.625a1.125 1.125 0 01-1.125-1.125v-9.75a1.125 1.125 0 011.125-1.125h9.75M15 10.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  warning: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  download: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3",
  history: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  flag: "M3 3v1.5M3 21v-6m0 0h7.5m-7.5 0H3m4.5-6h7.5M21 3v18m0 0h-7.5m7.5 0H21m-4.5 0v-6m0 6h-7.5m7.5-6v-6m0 6H10.5m7.5 0V9.75",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  chevronLeft: "M15.75 19.5L8.25 12l7.5-7.5",
  clipboard: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c.712 0 1.35.217 1.894.591M9 6.75h.008v.008H9V6.75z",
  play: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z",
  star: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  arrowTrend: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  envelope: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  calendarDays: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3h3.75m-3.75 0h3.75m-3.75 0H9",
  xmark: "M6 18L18 6M6 6l12 12",
  chevronUp: "M4.5 15.75l7.5-7.5 7.5 7.5",
  logout: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9",
  trendUp: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  trendDown: "M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776-2.898m0 0l-3.182-5.511m3.182 5.51l-5.511-3.181",
  filter: "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z",
  dots: "M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
  megaphone: "M10.34 2.872a.375.375 0 01.32-.073L19.5 5.564c1.235.412 2.25 1.558 2.25 2.89v3.092c0 1.332-1.015 2.478-2.25 2.89l-8.84 2.764a.375.375 0 01-.32-.073.375.375 0 01-.14-.298V2.872zM3 15.394l-.74-.24a.375.375 0 00-.477.164L.435 17.65a.375.375 0 00.165.476l.74.24a.375.375 0 00.476-.164l1.348-2.333a.375.375 0 00-.164-.475z",
  map: "M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z",
  book: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  scale: "M12 3v17.25m0 0c1.414 0 2.813-.256 4.125-.75M12 20.25c-1.414 0-2.813-.256-4.125-.75M12 3c-1.414 0-2.813.256-4.125.75M12 3c1.414 0 2.813.256 4.125.75M2.25 10.5h19.5M4.5 10.5v1.5a7.5 7.5 0 0015 0v-1.5M8.25 21a50.15 50.15 0 007.5 0",
} as const;

export function SvgPath({ name }: { name: keyof typeof ICON_PATHS }) {
  return <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />;
}

const NAV_ICON_MAP: Record<string, keyof typeof ICON_PATHS> = {
  // 1. Dashboard
  dashboard: "dashboard", analytics: "chart", "report-gen": "document",
  // 2. Employer Branding
  "employer-branding": "sparkles", "ai-trends": "sparkles", "editorial-plan": "calendarDays", engagement: "users",
  // 3. Talent Acquisition
  mpp: "chart", roles: "briefcase", "talent-pool": "users", candidates: "users", "cv-analyzer": "scan", interviews: "calendar", "hiring-report": "report", "hiring-analytics": "chart",
  // 4. Core HR
  employees: "users", ir: "scale", onboarding: "arrowRight", attendance: "clock",
  // 5. Performance & Talent
  performance: "star", succession: "arrowTrend", od: "map",
  // 6. Learning & Development
  courses: "book", competency: "star",
  // 7. Payroll & Rewards
  payroll: "report", laporan: "chart", "form-1721-a1": "document",
  // 8. Settings & Integrations
  "job-portal": "plug", "social-media": "plug",
};

/* ─── UI Primitives ─── */

export function Card({ children, className, padding = true }: { children: React.ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", padding && "p-5", className)}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "secondary", size = "md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-50";
  const sizes = { sm: "rounded-lg px-2.5 py-1 text-xs", md: "rounded-lg px-3 py-1.5 text-sm", lg: "rounded-lg px-5 py-2.5 text-sm" };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return <button type="button" className={cn(base, sizes[size], variants[variant], className)} {...props}>{children}</button>;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{children}</label>;
}

export const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

/* ─── Shell ─── */

export function AppShell({
  activeNavId,
  title,
  subtitle,
  headerActions,
  children,
}: {
  activeNavId: string;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status: authStatus, email: authEmail } = useAuthGate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<CompanyProfile>(() => {
    const id = typeof window !== "undefined" ? getActiveCompanyId() : "11111111-1111-4111-8111-111111111111";
    return ALL_COMPANIES.find((c) => c.id === id) || ALL_COMPANIES[0];
  });

  useEffect(() => {
    const handleCompanyChange = () => {
      const id = getActiveCompanyId();
      const comp = ALL_COMPANIES.find((c) => c.id === id) || ALL_COMPANIES[0];
      setActiveCompany(comp);
    };
    window.addEventListener("pi-company-change", handleCompanyChange);
    return () => window.removeEventListener("pi-company-change", handleCompanyChange);
  }, []);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("hi_theme") as Theme) ?? "system";
  });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const resolve = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    resolve();
    const onChange = () => { if (theme === "system") resolve(); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "light" ? "dark" : t === "dark" ? "system" : "light";
      localStorage.setItem("hi_theme", next);
      return next;
    });
  }, []);

  const [userName, setUserNameState] = useState(() => {
    if (typeof window === "undefined") return "You";
    return localStorage.getItem("hi_user_name") ?? "You";
  });
  const userInitials = userName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "Y";

  const handleEditName = useCallback(() => {
    const next = window.prompt("Your name:", userName);
    if (next && next.trim()) {
      localStorage.setItem("hi_user_name", next.trim());
      setUserNameState(next.trim());
    }
  }, [userName]);

  const [badges, setBadges] = useState({ candidates: 0, roles: 0 });
  useEffect(() => {
    const refresh = () => setBadges({
      candidates: getCandidates().length,
      roles: getJobReqs().filter((r) => r.status === "active").length,
    });
    refresh(); // immediate from localStorage
    if (authStatus === "authed") {
      syncFromSupabase().then(refresh).catch(() => {}); // re-sync from cloud once logged in
    }
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [authStatus]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [router]);

  const navGroups = useMemo(() => [
    {
      label: "Dashboard & Insights",
      items: [
        { id: "dashboard", label: "Overview", href: "/" },
        { id: "analytics", label: "HR Analytics", href: "/analytics" },
        { id: "report-gen", label: "Report Generator", href: "/report" },
      ],
    },
    {
      label: "Employer Branding & Culture",
      items: [
        { id: "employer-branding", label: "AI Content Generator", href: "/employer-branding" },
        { id: "ai-trends", label: "Trend & Ide Konten", href: "/employer-branding/ai-trends" },
        { id: "editorial-plan", label: "Editorial Plan", href: "/employer-branding/editorial" },
        { id: "engagement", label: "Employee Engagement", href: "/employer-branding/engagement", soon: true },
      ],
    },
    {
      label: "Talent Acquisition",
      items: [
        { id: "mpp", label: "Manpower Planning", href: "/planning/mpp" },
        { id: "roles", label: "Open Roles", href: "/roles", badge: badges.roles || undefined },
        { id: "talent-pool", label: "Talent Pool", href: "/talent-pool" },
        { id: "candidates", label: "Candidates", href: "/candidates", badge: badges.candidates || undefined },
        { id: "cv-analyzer", label: "CV Analyzer", href: "/cv-analyzer" },
        { id: "interviews", label: "Interview Workspace", href: "/interview" },
        { id: "hiring-analytics", label: "Hiring Analytics", href: "/analytics/hiring", soon: true },
      ],
    },
    {
      label: "Core HR & IR",
      items: [
        { id: "employees", label: "Employee Directory", href: "/employees" },
        { id: "ir", label: "Industrial Relations", href: "/core-hr/ir", soon: true },
        { id: "onboarding", label: "Onboarding & Offboarding", href: "/pay/onboarding" },
        { id: "attendance", label: "Attendance", href: "/attendance" },
      ],
    },
    {
      label: "Performance & Talent",
      items: [
        { id: "performance", label: "Performance (PMS)", href: "/performance" },
        { id: "succession", label: "Succession Planning", href: "/talent/succession", soon: true },
        { id: "od", label: "Org. Development", href: "/talent/od", soon: true },
      ],
    },
    {
      label: "Learning & Development",
      items: [
        { id: "courses", label: "Training & Courses", href: "/learning/courses", soon: true },
        { id: "competency", label: "Competency Matrix", href: "/learning/competency", soon: true },
      ],
    },
    {
      label: "Payroll & Rewards",
      items: [
        { id: "payroll", label: "Payroll Run", href: "/pay/payroll" },
        { id: "laporan", label: "Laporan Pajak & BPJS", href: "/pay/laporan" },
        { id: "form-1721-a1", label: "Formulir 1721-A1", href: "/pay/laporan/1721-a1" },
      ],
    },
    {
      label: "Settings & Integrations",
      items: [
        { id: "job-portal", label: "Job Portal Integrations", href: "/settings/job-portal", soon: true },
        { id: "social-media", label: "Social Media API", href: "/settings/social-media", soon: true },
      ],
    },
  ], [badges]);

  // Auth gate: show a loader while checking, render nothing while redirecting.
  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500" />
      </div>
    );
  }
  if (authStatus === "anon") return null; // redirecting to /login

  const renderNav = (items: NavItem[]) =>
    items.map((item) => {
      const active = activeNavId === item.id;
      const iconKey = NAV_ICON_MAP[item.id] ?? "dashboard";
      return (
        <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)}
          className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            active ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200")}
          aria-current={active ? "page" : undefined}>
          <Icon className="h-5 w-5 shrink-0"><SvgPath name={iconKey} /></Icon>
          <span className="truncate">{item.label}</span>
          {item.soon && (
            <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">Soon</span>
          )}
          {item.badge !== undefined && !item.soon && (
            <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              active ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
              {item.badge > 999 ? `${(item.badge / 1000).toFixed(1)}k` : item.badge}
            </span>
          )}
        </Link>
      );
    });

  return (
    <div className={cn("flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100", isDark && "dark")} data-theme={theme}>
      {/* Sidebar */}
      {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")} aria-label="Main navigation">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <span className="text-sm font-bold tracking-tight">PI</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">People Intelligence</p>
            <p className="truncate text-xs font-medium text-blue-600 dark:text-blue-400">{activeCompany.shortName}</p>
          </div>
          <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.label}</p>
              <div className="space-y-0.5">{renderNav(group.items as NavItem[])}</div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:gap-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
            <Icon className="h-5 w-5"><SvgPath name="menu" /></Icon>
          </button>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {/* Multi-Tenant Company Selector */}
          <div className={cn("flex items-center gap-2", !headerActions && "ml-auto")}>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 shadow-sm transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:bg-slate-800">
              <span className="text-base" aria-hidden>
                {activeCompany.industry === "broadcast" ? "📺" : "🧵"}
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Perusahaan / Entity
                </span>
                <select
                  value={activeCompany.id}
                  onChange={(e) => {
                    setActiveCompanyId(e.target.value);
                    const found = ALL_COMPANIES.find((c) => c.id === e.target.value) || ALL_COMPANIES[0];
                    setActiveCompany(found);
                    window.location.reload();
                  }}
                  className="cursor-pointer bg-transparent text-xs font-bold text-slate-900 focus:outline-none dark:text-white"
                  title="Switch Company Entity (Multi-Tenant)"
                >
                  {ALL_COMPANIES.map((comp) => (
                    <option key={comp.id} value={comp.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {comp.industry === "broadcast" ? "📺 " : "🧵 "} {comp.shortName} ({comp.headcountTarget} pax)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={cycleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}>
              <Icon className="h-5 w-5"><SvgPath name={isDark ? "sun" : "moon"} /></Icon>
            </button>
            <div className="hidden h-8 w-px bg-slate-200 md:block dark:bg-slate-700" />
            <div className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 md:pr-3">
              <button type="button" onClick={handleEditName} title="Click to change name" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white hover:opacity-90">
                {userInitials}
              </button>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
                <p className="max-w-[12rem] truncate text-xs text-slate-500 dark:text-slate-400">{authEmail || "Recruiter"}</p>
              </div>
            </div>
            {authEmail && (
              <button type="button" onClick={handleSignOut} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Icon className="h-5 w-5"><SvgPath name="logout" /></Icon>
              </button>
            )}
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto">
          {/* Breadcrumb */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
              <Link href="/" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Home</Link>
              <Icon className="h-3.5 w-3.5 text-slate-300"><SvgPath name="chevron" /></Icon>
              <span className="font-medium text-slate-900 dark:text-white">{title}</span>
            </nav>
          </div>

          <div className="space-y-6 p-4 sm:p-6">
            <div className="sm:hidden">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>

          <footer className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
              <p>&copy; 2026 People Intelligence &middot; Platform HR Terpadu</p>
              <p className="tabular-nums">v0.1.0 &middot; Demo portofolio &middot; Data sintetis</p>
            </div>
          </footer>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
