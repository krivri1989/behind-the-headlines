"use client";

import Link from "next/link";
import { Search, Menu, X, Facebook, Twitter, Linkedin, Youtube, Instagram, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

// WhatsApp icon — not in lucide, use inline SVG
function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.935 9.935 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.958 9.958 0 01-1.529-5.34c.001-5.495 4.471-9.964 9.965-9.964 2.64 0 5.12 1.03 6.986 2.898a9.82 9.82 0 012.893 6.984c-.003 5.498-4.472 9.968-9.965 9.968m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.134 1.585 5.931L0 24l6.33-1.666c1.774.967 3.773 1.476 5.81 1.477H12.053c6.554 0 11.89-5.335 11.893-11.893a11.83 11.83 0 00-3.533-8.413z" />
    </svg>
  );
}

type Category = { id: string; name: string; slug: string };
type MenuItem = { label: string; href: string; order: number; visible: boolean };
type Settings = Record<string, unknown> | null;

type LocationWeather = {
  place: string;
  temp: number | null;
  loading: boolean;
  error: boolean;
};

async function getPlaceName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`, {
      headers: { "User-Agent": "BehindTheHeadlines/1.0" },
    });
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.district || data.address?.state || data.address?.county || "Local";
  } catch {
    return "Local";
  }
}

async function getTemperature(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`);
    const data = await res.json();
    return data.current?.temperature_2m ?? null;
  } catch {
    return null;
  }
}

export function PublicHeader({
  settings,
  categories,
  menuItems,
}: {
  settings: Settings;
  categories: Category[];
  menuItems: MenuItem[];
}) {
  const publicationName = (settings?.publicationName as string) || "Behind The Headlines";
  const tagline = (settings?.tagline as string) || "";
  const logoUrl = (settings?.logoUrl as string) || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [weather, setWeather] = useState<LocationWeather>({ place: "", temp: null, loading: true, error: false });

  const [currentTime, setCurrentTime] = useState("");
  const [logoError, setLogoError] = useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  function formatIstTime(date: Date): string {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).toLowerCase().replace(/\s/, "").replace("am", "AM").replace("pm", "PM");
  }

  useEffect(() => {
    setCurrentTime(formatIstTime(new Date()));
    const interval = setInterval(() => setCurrentTime(formatIstTime(new Date())), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather({ place: "", temp: null, loading: false, error: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const [place, temp] = await Promise.all([
          getPlaceName(latitude, longitude),
          getTemperature(latitude, longitude),
        ]);
        setWeather({ place, temp, loading: false, error: place === "Local" && temp === null });
      },
      () => {
        setWeather({ place: "", temp: null, loading: false, error: true });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  const dateTimeString = currentTime ? `${today} | Updated ${currentTime} IST` : today;

  const socialLinks = [
    { icon: Facebook, href: "https://www.facebook.com/bthnews/", label: "Facebook", className: "social-facebook" },
    { icon: Twitter, href: "https://x.com/bthoriginal", label: "X", className: "social-twitter" },
    { icon: Linkedin, href: "https://www.linkedin.com/company/bthnews/", label: "LinkedIn", className: "social-linkedin" },
    { icon: Youtube, href: "https://www.youtube.com/@JanJagranDarpan", label: "YouTube", className: "social-youtube" },
    { icon: Instagram, href: "https://www.instagram.com/bthnews", label: "Instagram", className: "social-instagram" },
    { icon: WhatsAppIcon, href: "https://whatsapp.com/channel/0029VaXMaJl84OmGArtrIY1a", label: "WhatsApp", className: "social-whatsapp" },
  ];

  return (
    <header className="public-header">
      {/* Top stripe: India | Date/Time | Weather | Sign In | Social */}
      <div className="header-topbar">
        <div className="header-topbar-inner">
          <div className="header-topbar-left">
            <div className="header-edition">
              <span className="india-flag" aria-hidden="true">🇮🇳</span>
              <span className="header-edition-text">India</span>
              <span className="header-edition-sep">|</span>
              <span className="header-edition-lang">English</span>
            </div>

            <span className="header-date">{dateTimeString}</span>
          </div>

          <div className="header-topbar-right">
            <div className="header-weather" title="Based on your current location">
              {weather.loading ? (
                <span className="weather-loading">Locating…</span>
              ) : weather.error ? null : (
                <>
                  <MapPin size={13} />
                  <span className="weather-place">{weather.place}</span>
                  {weather.temp !== null && (
                    <span className="weather-temp">{weather.temp}°C</span>
                  )}
                </>
              )}
            </div>

            <Link href="/login" className="header-signin">Sign In</Link>

            <div className="header-social">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={"header-social-link " + social.className}
                  aria-label={social.label}
                >
                  <social.icon size={15} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="header-main">
        <div className="header-main-inner">
          <button className="header-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/" className="header-logo">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={publicationName}
                height={52}
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="header-logo-text">{publicationName}</span>
            )}
          </Link>
          <form action="/search" method="GET" className="header-search">
            <Search size={16} />
            <input type="text" name="q" placeholder="Search news..." aria-label="Search" />
          </form>
        </div>
      </div>

      {/* Navigation bar */}
      <nav className={"header-nav" + (mobileOpen ? " mobile-open" : "")}>
        <div className="header-nav-inner">
          {menuItems.filter((item) => item.visible).sort((a, b) => a.order - b.order).map((item, i) => (
            <Link key={i} href={item.href} className="nav-item" onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
