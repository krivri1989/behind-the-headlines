"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Client component for rendering video ads.
 * Supports YouTube embeds (autoplay, muted, unmute button, auto-thumbnail)
 * and VAST-lite video (fetches media URL via /api/ads/vast).
 *
 * Props:
 *   youtubeId — YouTube video ID (for YouTube ads)
 *   vastUrl   — VAST XML URL (for VAST-lite ads)
 */
export function VideoAd({ youtubeId, vastUrl }: { youtubeId?: string; vastUrl?: string }) {
  if (youtubeId) return <YouTubeAd youtubeId={youtubeId} />;
  if (vastUrl) return <VastVideoAd vastUrl={vastUrl} />;
  return null;
}

/** YouTube video ad with autoplay (muted) and unmute button. */
function YouTubeAd({ youtubeId }: { youtubeId: string }) {
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  // Load YouTube IFrame API and create player
  useEffect(() => {
    if (!youtubeId) return;

    // Load the API script once
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    function createPlayer() {
      if (!iframeRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.mute();
            e.target.playVideo();
            setStarted(true);
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      playerRef.current?.destroy?.();
    };
  }, [youtubeId]);

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (muted) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  return (
    <div className="ad-video-wrap">
      {!started && (
        <img
          src={thumbnailUrl}
          alt="Video ad"
          className="ad-video-thumbnail"
          style={{ width: "100%", display: "block" }}
        />
      )}
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&mute=1&controls=0&rel=0&showinfo=0&modestbranding=1&playsinline=1`}
        title="Video advertisement"
        allow="autoplay; encrypted-media"
        frameBorder={0}
        style={{ width: "100%", aspectRatio: "16/9", display: started ? "block" : "none" }}
      />
      <button
        type="button"
        className="ad-video-unmute"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video ad" : "Mute video ad"}
      >
        {muted ? "🔇 Tap to unmute" : "🔊 Mute"}
      </button>
    </div>
  );
}

/** VAST-lite video ad: fetches media URL from /api/ads/vast, plays in <video>. */
function VastVideoAd({ vastUrl }: { vastUrl: string }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads/vast?url=${encodeURIComponent(vastUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setMediaUrl(data.mediaUrl || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [vastUrl]);

  if (loading) {
    return (
      <div className="ad-video-wrap">
        <div style={{ aspectRatio: "16/9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
          Loading ad…
        </div>
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="ad-video-wrap">
        <div style={{ aspectRatio: "16/9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
          Ad unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="ad-video-wrap">
      <video src={mediaUrl} autoPlay muted loop playsInline controls style={{ width: "100%", aspectRatio: "16/9" }} />
    </div>
  );
}

// --- YouTube IFrame API types (minimal) -----------------------------------

type YTPlayer = {
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  destroy?: () => void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
