'use client';
import { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from "react";
import { fN } from "../lib/format";
import { useToast } from "./toast";
import { SegPill } from "./seg-pill";

/* ═══════════════════════════════════════════ */
/* ═══ PLATFORM DATA — 35 platforms        ═══ */
/* ═══ Grouped: Social (21) Music (9) Utility (5) */
/* ═══════════════════════════════════════════ */

const refillLabel = (tier) => tier === "Budget" ? "No refill if count drops" : tier === "Standard" ? "Free top-up if count drops" : "Won't drop. Lifetime guarantee";
const I = (d, vb = "0 0 24 24") => <svg width="24" height="24" viewBox={vb} fill="currentColor">{d}</svg>;
const IS = (d, vb = "0 0 24 24") => <svg width="24" height="24" viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

export const PLATFORM_GROUPS = [
  { label: "Social Platforms", platforms: [
    { id: "instagram", label: "Instagram", icon: IS(<><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>) },
    { id: "tiktok", label: "TikTok", icon: I(<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.89 2.89 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.11V9.38a6.33 6.33 0 00-.79-.05A6.34 6.34 0 003.14 15.67 6.34 6.34 0 009.48 22a6.34 6.34 0 006.34-6.34V9.17a8.16 8.16 0 004.77 1.53V7.26a4.85 4.85 0 01-1-.57z"/>) },
    { id: "youtube", label: "YouTube", icon: I(<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>) },
    { id: "facebook", label: "Facebook", icon: I(<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>) },
    { id: "twitter", label: "Twitter / X", icon: I(<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>) },
    { id: "telegram", label: "Telegram", icon: I(<path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012.056 0h-.112zm4.962 7.05c.103 0 .232.016.336.098a.554.554 0 01.186.353c.012.06.028.196.016.404-.12 2.514-1.606 8.618-2.27 11.432-.28 1.19-.832 1.59-1.367 1.63-1.161.107-2.044-.768-3.17-1.505-1.76-1.155-2.755-1.874-4.466-2.998-1.977-1.302-.695-2.018.431-3.187.295-.306 5.416-4.965 5.515-5.388.013-.053.024-.25-.093-.354-.117-.104-.29-.068-.414-.04-.176.04-2.985 1.897-8.43 5.57-1.196.822-2.279 1.224-3.248 1.204-.637-.014-1.863-.36-2.774-.656-1.117-.363-2.004-.555-1.927-1.172.04-.322.49-.652 1.35-1.99C7.48 7.68 12.06 5.63 16.906 7.05z"/>, "0 0 24 24") },
    { id: "threads", label: "Threads", icon: I(<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.433 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.508 5.47l-2.4.688c-1.064-3.832-3.538-5.814-7.356-5.89h-.01c-2.792.018-4.862.92-6.15 2.68-1.182 1.617-1.79 3.95-1.815 6.938v.014c.025 2.988.633 5.32 1.816 6.94 1.288 1.76 3.357 2.66 6.15 2.68h.01c2.09-.013 3.9-.536 5.38-1.553 1.41-.97 2.41-2.352 2.968-4.105l2.296.79c-.684 2.164-1.944 3.9-3.742 5.16C18.06 23.22 15.77 23.976 12.186 24z"/>) },
    { id: "snapchat", label: "Snapchat", icon: I(<path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.977-.285a.91.91 0 01.39-.082c.2 0 .38.055.55.164.29.19.39.487.39.738 0 .478-.44.838-.99 1.058-.37.15-.81.258-1.14.347l-.42.125c-.16.06-.24.13-.27.18.42 1.46 1.92 2.37 1.97 2.4.19.1.33.26.39.44.08.23.03.5-.15.74-.27.37-.75.64-1.45.82a3.97 3.97 0 01-.82.158c-.1.018-.21.038-.33.068-.24.059-.35.25-.49.55-.2.4-.5.97-1.47 1.11-.61.09-1.1-.01-1.57-.1-.35-.08-.67-.16-.99-.16-.12 0-.23.01-.35.03-.39.059-.76.18-1.17.31-.59.19-1.26.4-2.1.4s-1.5-.21-2.09-.4c-.41-.13-.78-.25-1.17-.31a2.48 2.48 0 00-.36-.03c-.32 0-.65.079-.99.16-.47.1-.96.19-1.56.1-.97-.14-1.27-.71-1.47-1.11-.14-.3-.25-.49-.49-.55-.12-.03-.22-.05-.33-.069a3.97 3.97 0 01-.82-.158c-.7-.18-1.18-.45-1.45-.82-.18-.24-.23-.51-.15-.74.06-.18.2-.34.39-.44.05-.03 1.55-.94 1.97-2.4-.03-.05-.11-.12-.27-.18l-.42-.125c-.33-.09-.77-.197-1.14-.347-.55-.22-.99-.58-.99-1.058 0-.25.1-.548.39-.738.17-.11.35-.164.55-.164.15 0 .28.03.39.082.32.165.68.269.98.285.2 0 .33-.045.4-.09a18.86 18.86 0 01-.03-.51l-.002-.06c-.105-1.628-.23-3.654.3-4.847C5.865 1.069 9.215.793 10.205.793h1.998z"/>) },
    { id: "linkedin", label: "LinkedIn", icon: I(<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>) },
    { id: "pinterest", label: "Pinterest", icon: I(<path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>) },
    { id: "reddit", label: "Reddit", icon: I(<path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.462.342.342 0 00-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.205-.096z"/>) },
    { id: "discord", label: "Discord", icon: I(<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>) },
    { id: "whatsapp", label: "WhatsApp", icon: I(<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>) },
    { id: "twitch", label: "Twitch", icon: I(<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>) },
    { id: "kick", label: "Kick", icon: I(<><rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor"/><path d="M8 7v10M12 12l4-5M12 12l4 5" stroke="#080b14" strokeWidth="2" strokeLinecap="round" fill="none"/></>) },
    { id: "tumblr", label: "Tumblr", icon: I(<path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 10.068 0h3.504v6.094h4.801v3.653h-4.801v7.387c0 1.723.826 2.317 2.141 2.317a7.25 7.25 0 002.104-.426l1.183 3.35c-.401.501-2.21 1.399-4.437 1.625z"/>) },
    { id: "quora", label: "Quora", icon: I(<path d="M12.738 20.713c-.617-1.253-1.352-2.471-2.554-2.471-.39 0-.782.123-1.048.371l-.595-.891c.614-.707 1.612-1.162 2.876-1.162 1.823 0 2.887.894 3.677 2.054.482-1.04.73-2.384.73-4.025 0-4.647-1.656-7.988-5.046-7.988-3.344 0-5 3.341-5 7.988 0 4.618 1.656 7.94 5 7.94.688 0 1.318-.116 1.96-.316zM12.778 0C19.555 0 24 5.27 24 12.59 24 19.91 19.555 24 12.778 24c-2.36 0-4.376-.653-5.983-1.834l-1.51 1.457H3.22l2.77-4.257C4.207 17.408 3 14.867 3 12.59 3 5.27 7.445 0 12.778 0z"/>) },
    { id: "onlyfans", label: "OnlyFans", icon: I(<><circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="1.5"/></>) },
    { id: "clubhouse", label: "Clubhouse", icon: IS(<><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0114 0v2"/></>) },
    { id: "kwai", label: "Kwai", icon: I(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>) },
    { id: "vimeo", label: "Vimeo", icon: I(<path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>) },
  ]},
  { label: "Music", platforms: [
    { id: "spotify", label: "Spotify", icon: I(<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>) },
    { id: "audiomack", label: "Audiomack", icon: IS(<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>) },
    { id: "boomplay", label: "Boomplay", icon: I(<><circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" fill="none"/><polygon points="10 8 17 12 10 16"/></>) },
    { id: "applemusic", label: "Apple Music", icon: I(<path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.165a10.1 10.1 0 00-1.564-.12C17.294.01 16.444 0 12.012 0c-4.424 0-5.282.01-6.13.04-.54.02-1.078.06-1.61.15A5.159 5.159 0 002.18.88C1.06 1.61.317 2.6 0 3.92a9.23 9.23 0 00-.24 2.19c-.03.84-.04 1.69-.04 6.13 0 4.44.01 5.28.04 6.12.04.74.12 1.49.24 2.19.317 1.32 1.06 2.31 2.18 3.05.67.44 1.41.72 2.2.84.53.09 1.07.13 1.61.15.84.03 1.69.04 6.13.04 4.43 0 5.28-.01 6.12-.04a10.1 10.1 0 001.56-.12 5.13 5.13 0 002.19-.84c1.12-.73 1.86-1.73 2.18-3.04.12-.7.2-1.45.24-2.19.03-.84.04-1.69.04-6.13 0-4.44-.01-5.28-.04-6.12zM17.92 15.6c0 .62-.09 1.22-.27 1.8a3.58 3.58 0 01-1.18 1.68c-.53.42-1.13.66-1.81.72-.42.04-.84 0-1.24-.11a2.09 2.09 0 01-1.5-1.53 2.37 2.37 0 01.53-2.22c.39-.42.87-.7 1.42-.87.46-.15.93-.24 1.4-.31.38-.06.77-.1 1.14-.2.15-.04.29-.11.38-.26.07-.11.1-.24.1-.39V7.46c0-.12-.03-.23-.1-.33a.42.42 0 00-.34-.17c-.1 0-.2.02-.29.06-.09.03-.17.09-.22.17a.68.68 0 00-.1.31l-.01.06v.64l-5.37 1.2v6.95c0 .62-.09 1.22-.27 1.8a3.56 3.56 0 01-1.18 1.67c-.53.42-1.13.66-1.81.73-.42.04-.83 0-1.23-.12a2.09 2.09 0 01-1.5-1.53 2.38 2.38 0 01.53-2.22c.38-.42.87-.7 1.42-.87.45-.14.92-.24 1.39-.31.39-.06.77-.1 1.14-.2.15-.04.3-.11.39-.26.07-.11.1-.24.1-.38V6.37c0-.32.08-.63.27-.89.19-.28.44-.46.76-.54.14-.04.28-.07.42-.09L16.6 4c.18-.04.36-.06.54-.06.43.01.77.2.97.57.1.19.14.4.14.62v10.47h-.32z"/>) },
    { id: "soundcloud", label: "SoundCloud", icon: I(<path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c0-.057-.045-.1-.09-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c0 .055.045.094.09.094s.089-.045.104-.104l.21-1.319-.21-1.334c0-.061-.044-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.12.12.12.06 0 .105-.061.12-.12l.24-2.474-.24-2.548c0-.06-.045-.12-.12-.12m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.135.149.135.075 0 .135-.06.15-.15l.24-2.529-.24-2.64c-.016-.08-.075-.135-.15-.135m1.155.36c-.005-.09-.075-.149-.159-.149-.09 0-.158.06-.164.149l-.217 2.43.2 2.563c0 .09.075.157.163.157.074 0 .148-.068.148-.158l.227-2.563-.227-2.444.029.015zm.809-1.709c-.101 0-.18.09-.18.181l-.21 3.957.187 2.563c0 .09.08.164.18.164.09 0 .18-.075.18-.18l.209-2.563-.209-3.972c0-.104-.09-.18-.18-.18m.959-.914c-.105 0-.195.09-.21.195l-.165 4.871.165 2.548c.016.104.105.18.21.18.104 0 .194-.09.194-.195l.195-2.548-.195-4.871c-.015-.105-.09-.195-.195-.195m.989-.449c-.121 0-.21.09-.225.209l-.165 5.291.165 2.52c.016.12.105.21.225.21.12 0 .21-.09.224-.225l.18-2.52-.18-5.276c0-.12-.105-.21-.21-.21m1.065.105c-.135 0-.24.105-.24.227l-.15 5.156.15 2.505c0 .135.105.24.24.24s.24-.105.24-.24l.165-2.505-.165-5.156c0-.135-.105-.24-.24-.24m1.05-.329c-.15 0-.255.105-.27.24l-.149 5.441.149 2.489c.016.135.121.24.271.24.149 0 .254-.105.254-.24l.15-2.489-.15-5.456c0-.12-.105-.24-.255-.24m1.084-.359c-.016-.15-.135-.255-.27-.255-.15 0-.271.12-.271.27l-.149 5.745.149 2.459c.016.15.135.271.271.271.149 0 .27-.12.27-.271l.15-2.459-.15-5.745v-.015zm1.006-.195c-.165 0-.3.135-.3.3l-.135 5.775.135 2.444c0 .165.135.3.3.3.149 0 .3-.135.3-.3l.15-2.444-.15-5.775c0-.165-.135-.3-.3-.3m1.066 0c-.18 0-.315.135-.315.315L18.9 14.505l.12 2.429c0 .18.135.315.315.315s.315-.135.315-.315l.135-2.429-.135-5.835c0-.18-.135-.315-.315-.315m1.064-.135c-.195 0-.33.15-.345.33l-.12 5.88.12 2.4c.016.18.15.33.345.33.18 0 .33-.15.33-.33l.135-2.4-.135-5.88c0-.18-.15-.33-.33-.33m1.065.135c-.21 0-.345.165-.36.36l-.1 5.415.1 2.369c.015.195.15.36.36.36.195 0 .36-.165.36-.36l.12-2.369-.12-5.415c0-.195-.165-.36-.36-.36"/>) },
    { id: "deezer", label: "Deezer", icon: I(<><rect x="0" y="18" width="4" height="4" rx="1"/><rect x="5" y="14" width="4" height="8" rx="1"/><rect x="10" y="10" width="4" height="12" rx="1"/><rect x="15" y="14" width="4" height="8" rx="1"/><rect x="20" y="6" width="4" height="16" rx="1"/></>) },
    { id: "tidal", label: "Tidal", icon: I(<><polygon points="12 2 16 10 12 18 8 10"/><polygon points="4 10 8 18 4 24 0 18"/><polygon points="20 10 24 18 20 24 16 18"/></>) },
    { id: "shazam", label: "Shazam", icon: I(<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.438 16.77c-1.175 1.054-2.988 1.267-4.401.547-.554-.282-.984-.7-1.32-1.2a4.01 4.01 0 01-.543-1.657c-.033-.257.135-.507.395-.507.21 0 .38.15.41.36.08.57.3 1.11.686 1.536.637.7 1.568.99 2.482.78.607-.14 1.1-.49 1.453-.97.197-.268.28-.56.198-.887-.092-.37-.33-.646-.636-.87-.52-.38-1.11-.63-1.69-.905-.77-.365-1.518-.77-2.08-1.41-.383-.437-.625-.94-.648-1.544-.038-1.01.403-1.8 1.204-2.38a3.14 3.14 0 012.34-.592c.937.1 1.697.53 2.264 1.27.157.203.274.43.36.672.072.2-.044.424-.245.5-.177.065-.38-.01-.474-.17-.225-.38-.53-.685-.915-.913-.645-.38-1.335-.462-2.06-.227-.476.155-.847.45-1.067.91-.22.462-.185.92.063 1.358.244.432.615.73 1.027.976.636.38 1.313.69 1.97 1.033.545.284 1.05.63 1.438 1.112.465.58.594 1.232.428 1.95-.143.617-.493 1.1-.96 1.49z"/>) },
    { id: "mixcloud", label: "Mixcloud", icon: IS(<><circle cx="7" cy="17" r="4"/><circle cx="17" cy="17" r="4"/><path d="M7 13V4l10-2v11"/></>) },
  ]},
  { label: "SEO & Reviews", platforms: [
    { id: "google", label: "Google", icon: I(<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>) },
    { id: "trustpilot", label: "Trustpilot", icon: I(<path d="M12 0l3.09 8.26L22 9.27l-5.5 4.87L18.18 22 12 17.77 5.82 22 7 14.14 1.5 9.27l6.91-1.01L12 0z"/>) },
    { id: "webtraffic", label: "Web Traffic", icon: IS(<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>) },
    { id: "appstore", label: "App Store", icon: I(<path d="M8.809 14.92l6.11-11.037c.084-.153.076-.33-.012-.468a.384.384 0 00-.398-.182c-.168.027-.31.152-.377.31l-2.5 4.528H5.132L9.694 0h2.073l-3.72 6.72h3.862l-4.172 8.2h1.072zm6.145-1.928l-5.476 9.888c-.084.153-.076.33.012.468a.385.385 0 00.398.182c.168-.027.31-.152.377-.31l2.5-4.527h6.5L14.7 24h-2.072l3.72-6.72h-3.862l4.172-8.2h-1.072l-.632 1.012zM3.491 18.2l.766-1.384h3.235l-.766 1.384H3.491zm16.253-12.4l-.766 1.384h-3.235l.766-1.384h3.235z"/>) },
    { id: "playstore", label: "Play Store", icon: I(<path d="M3.609.093A1.016 1.016 0 002.5.87v22.26c0 .437.277.823.684.968l10.972-12.052L3.609.093zm1.345-.79l11.253 11.253 3.23-3.553L5.627-.39a.942.942 0 00-.673.093v-.4zm0 23.394a.998.998 0 00.673.093l12.81-5.693-3.23-3.553L4.954 22.697zm16.282-8.327l-3.835-2.13-3.482 3.827 3.482 3.827 3.835-2.13c.695-.386 1.095-1.063 1.095-1.697s-.4-1.311-1.095-1.697z"/>) },
  ]},
];

export const PLATFORMS = PLATFORM_GROUPS.flatMap(g => g.platforms);

const TS = {
  Budget: { bg: "#fef7ed", border: "#e8d5b8", text: "#854F0B", bgD: "#2d2210", borderD: "#5a4020", label: "💰" },
  Standard: { bg: "#eef4fb", border: "#b8d0e8", text: "#185FA5", bgD: "#0f1e30", borderD: "#1e4070", label: "⚡" },
  Premium: { bg: "#f5eef5", border: "#d4b8d4", text: "#534AB7", bgD: "#221535", borderD: "#3d2060", label: "👑" },
};


function compactPrice(n) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `₦${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₦${n.toLocaleString()}`;
}

function getPresets(min, max) {
  const nice = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const pool = nice.filter(v => v >= min && v <= max);
  if (!pool.length || pool[0] !== min) pool.unshift(min);
  if (pool[pool.length - 1] !== max) pool.push(max);
  if (pool.length <= 5) return pool;
  const step = (pool.length - 1) / 4;
  return [0, 1, 2, 3, 4].map(i => pool[Math.round(i * step)]);
}

const LINK_HINTS = {
  instagram: "https://instagram.com/p/...",
  tiktok: "https://tiktok.com/@.../video/...",
  youtube: "https://youtube.com/watch?v=...",
  facebook: "https://facebook.com/...",
  twitter: "https://x.com/.../status/...",
  telegram: "https://t.me/...",
  threads: "https://threads.net/@...",
  snapchat: "https://snapchat.com/...",
  linkedin: "https://linkedin.com/in/...",
  pinterest: "https://pinterest.com/pin/...",
  reddit: "https://reddit.com/r/.../...",
  discord: "https://discord.gg/...",
  whatsapp: "https://chat.whatsapp.com/...",
  twitch: "https://twitch.tv/...",
  kick: "https://kick.com/...",
  spotify: "https://open.spotify.com/track/...",
  audiomack: "https://audiomack.com/...",
  boomplay: "https://boomplay.com/...",
  applemusic: "https://music.apple.com/...",
  soundcloud: "https://soundcloud.com/...",
  deezer: "https://deezer.com/track/...",
  tidal: "https://tidal.com/track/...",
  google: "https://google.com/maps/...",
  trustpilot: "https://trustpilot.com/review/...",
  webtraffic: "https://yourwebsite.com",
  appstore: "https://apps.apple.com/app/...",
  playstore: "https://play.google.com/store/apps/...",
};

function isValidLink(link) {
  const v = link.trim();
  if (v.length < 5 || v.length > 500) return false;
  if (v.includes("://") || /^https?:?$/i.test(v)) return /^https?:\/\/[^\s/]+\.[^\s/]+/.test(v);
  return /^@?[a-zA-Z0-9._]{1,100}$/.test(v);
}

const CART_KEY = "nitro_bulk_cart_v1";
const CART_TTL = 86400000;

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const { rows, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CART_TTL) { localStorage.removeItem(CART_KEY); return []; }
    return rows || [];
  } catch { return []; }
}
function saveCart(rows) {
  try { localStorage.setItem(CART_KEY, JSON.stringify({ rows, savedAt: Date.now() })); } catch {}
}

/* ═══════════════════════════════════════════ */
/* ═══ ORDER FORM                          ═══ */
/* ═══════════════════════════════════════════ */
export function OrderForm({ selSvc, selTier, platform, qty, setQty, link, setLink, dark, t, onClose, compact, onSubmit, orderLoading, comments, setComments, loyaltyDiscount = 0, loyaltyTier = null }) {
  const minQty = selTier?.min || 100;
  const maxQty = selTier?.max || 50000;
  const qtyNum = Number(qty) || 0;
  const qtyOutOfRange = qty !== "" && qtyNum > 0 && (qtyNum < minQty || qtyNum > maxQty);
  const basePrice = selTier ? Math.round((qtyNum / 1000) * selTier.price) : 0;
  const discountAmount = loyaltyDiscount > 0 ? Math.round(basePrice * (loyaltyDiscount / 100)) : 0;
  const price = Math.max(0, basePrice - discountAmount);
  const s = selTier ? TS[selTier.tier] : null;
  const [linkError, setLinkError] = useState("");

  /* Link validation */
  const validateLink = (val) => {
    setLink(val);
    if (!val.trim()) { setLinkError(""); return; }
    if (isValidLink(val)) { setLinkError(""); return; }
    setLinkError("Enter a valid URL or @username");
  };
  const linkValid = link.trim() && !linkError;

  /* Detect service type from name + type field */
  const svcName = (selSvc?.name || "").toLowerCase();
  const svcType = (selSvc?.type || "").toLowerCase();
  // "Custom Comments" or "Comments" but NOT "Comment Likes"
  const isComment = (svcType.includes("comment") || svcName.includes("comment")) && !svcName.includes("comment like");
  const isMention = svcName.includes("mention");
  // "Poll Votes" but NOT "Upvotes"
  const isPoll = svcName.includes("poll vote") || svcName.includes("poll") && !svcName.includes("upvote");
  // "Reviews (5 Stars)" but NOT "Review Likes"
  const isReview = svcName.includes("review") && !svcName.includes("review like");
  const needsComments = isComment || isReview;
  const needsUsernames = isMention;
  const needsAnswer = isPoll;

  const linkPlaceholder = LINK_HINTS[platform] || `https://${platform}.com/...`;
  const linkLabel = platform === "webtraffic" ? "Website URL" : isPoll ? "Post / Poll URL" : "Link";

  return (
    <div className="p-5 max-md:p-4">
      <div className="flex justify-between items-center mb-3.5">
        <span className="m text-[13px] uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>Place order</span>
        {onClose && <button onClick={onClose} className="bg-transparent border border-solid rounded-lg w-7 h-7 flex items-center justify-center text-base cursor-pointer" style={{ borderColor: t.cardBorder, color: t.textSoft }}>✕</button>}
      </div>
      <div className="mb-3.5">
        <div className="text-base font-semibold max-md:text-[15px]" style={{ color: t.text }}>{selSvc?.name}</div>
        {s && <div className="mt-[3px] text-sm">
          <span className="font-semibold" style={{ color: s.text }}>{s.label} {selTier.tier}</span>
          <span style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
        </div>}
      </div>
      {selTier && <>
        <div className="mb-3.5" data-tour="no-link-input">
          <label className="text-sm block mb-[5px]" style={{ color: t.textMuted }}>{linkLabel}</label>
          <input type="url" inputMode="url" aria-label={linkLabel} disabled={orderLoading} placeholder={linkPlaceholder} value={link} onChange={e => validateLink(e.target.value)} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit] disabled:opacity-50" style={{ borderColor: linkError ? (dark ? "#f87171" : "#dc2626") : dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
          <div className="text-[11px] mt-[3px]" style={{ color: dark ? "#f87171" : "#dc2626", visibility: linkError ? "visible" : "hidden" }}>{linkError || '\u00A0'}</div>
        </div>
        {needsComments && (
          <div className="mb-3.5">
            <label className="text-sm block mb-[5px]" style={{ color: t.textMuted }}>{isReview ? "Reviews" : "Comments"} <span className="font-normal text-[11px]">(one per line)</span></label>
            <textarea disabled={orderLoading} placeholder={isReview ? "Great service, highly recommend!\nFast delivery and excellent quality\nBest experience I've had, 5 stars" : "Great content! 🔥\nLove this post!\nAmazing work, keep it up 💯\nThis is fire 🙌"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[13px] leading-[1.5] outline-none box-border font-[inherit] resize-y disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{(comments || "").split("\n").filter(l => l.trim()).length} {isReview ? "reviews" : "comments"} entered · we'll cycle through them</div>
          </div>
        )}
        {needsUsernames && (
          <div className="mb-3.5">
            <label className="text-sm block mb-[5px]" style={{ color: t.textMuted }}>Usernames to mention <span className="font-normal text-[11px]">(one per line, without @)</span></label>
            <textarea disabled={orderLoading} placeholder={"username1\nusername2\nusername3"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[13px] leading-[1.5] outline-none box-border font-[inherit] resize-y disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{(comments || "").split("\n").filter(l => l.trim()).length} usernames entered</div>
          </div>
        )}
        {needsAnswer && (
          <div className="mb-3.5">
            <label className="text-sm block mb-[5px]" style={{ color: t.textMuted }}>Answer option number</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" disabled={orderLoading} onClick={() => setComments(String(n))} className="flex-1 py-2.5 px-0 rounded-lg text-sm font-semibold cursor-pointer border border-solid disabled:opacity-40" style={{ borderColor: (comments || "") === String(n) ? t.accent : (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"), background: (comments || "") === String(n) ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: (comments || "") === String(n) ? t.accent : t.textMuted }}>Option {n}</button>
              ))}
            </div>
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>Select which poll answer to vote for</div>
          </div>
        )}
        <div className="mb-3.5">
          <label className="text-sm block mb-[5px]" style={{ color: t.textMuted }}>Quantity</label>
          <input type="number" aria-label="Quantity" disabled={orderLoading} value={qty} onChange={e => setQty(e.target.value === "" ? "" : e.target.value)} onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit] disabled:opacity-50" style={{ borderColor: qtyOutOfRange ? (dark ? "rgba(220,38,38,.4)" : "rgba(220,38,38,.3)") : (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)"), background: dark ? "#0d1020" : "#fff", color: t.text }} />
          {qtyOutOfRange && <div className="text-[11px] mt-[3px]" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{qtyNum < minQty ? `Minimum: ${minQty.toLocaleString()}` : `Maximum: ${maxQty.toLocaleString()}`}</div>}
          <div className="flex gap-1 mt-1.5">
            {getPresets(minQty, maxQty).map(q => (
              <button key={q} onClick={() => setQty(q)} disabled={orderLoading} className="m flex-1 py-[5px] rounded-md text-[13px] border border-solid cursor-pointer bg-transparent font-[inherit] disabled:opacity-40" style={{ borderColor: qty === q ? t.accent : t.cardBorder, background: qty === q ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: qty === q ? t.accent : t.textMuted }}>{q >= 1000 ? `${q / 1000}K` : q}</button>
            ))}
          </div>
        </div>
        <div className="rounded-[10px] p-3 mb-3.5 border border-solid" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderColor: t.cardBorder }}>
          <div className="flex justify-between mb-1.5 text-sm" style={{ color: t.textMuted }}><span>Rate</span><span>₦{selTier.price.toLocaleString()} / {selTier.per}</span></div>
          <div className="flex justify-between mb-1.5 text-sm" style={{ color: t.textMuted }}><span>Quantity</span><span>{qtyNum.toLocaleString()}</span></div>
          {discountAmount > 0 && <div className="flex justify-between mb-1.5 text-sm" style={{ color: dark ? "#6ee7b7" : "#059669" }}><span>{loyaltyTier} discount ({loyaltyDiscount}%)</span><span>-₦{discountAmount.toLocaleString()}</span></div>}
          <div className="border-t border-solid pt-2 flex justify-between items-baseline" style={{ borderColor: t.cardBorder }}>
            <span className="font-semibold" style={{ color: t.textMuted }}>Total</span>
            <span className="m text-xl font-semibold max-md:text-lg" style={{ color: t.accent }}>₦{price.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-1 mb-3.5 flex-wrap">
          <span className="m text-xs py-[3px] px-2 rounded-2xl border border-solid" style={{ borderColor: t.cardBorder, color: t.textMuted }}>{refillLabel(selTier.tier)}</span>
          <span className="m text-xs py-[3px] px-2 rounded-2xl border border-solid" style={{ borderColor: t.cardBorder, color: t.textMuted }}>speed: {selTier.speed || "Instant"}</span>
        </div>
        <button onClick={onSubmit} data-tour="no-submit-btn" disabled={!linkValid || qtyOutOfRange || qtyNum <= 0 || ((needsComments || needsUsernames) && !(comments || "").trim()) || (needsAnswer && !(comments || "").trim()) || orderLoading} className="w-full py-3 rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-base font-semibold cursor-pointer sticky bottom-0 z-[2] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.3)]" style={{ opacity: linkValid && !qtyOutOfRange && qtyNum > 0 && (!(needsComments || needsUsernames || needsAnswer) || (comments || "").trim()) && !orderLoading ? 1 : .5 }}>{orderLoading ? "Placing..." : "Place Order"}</button>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NEW ORDER PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function NewOrderPage({ dark, t, user, onOrderSuccess, onViewOrders, platform, setPlatform, selSvc, setSelSvc, selTier, setSelTier, qty, setQty, link, setLink, comments, setComments, catModal, setCatModal }) {
  const toast = useToast();
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [orderModal, setOrderModal] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  // Bulk mode state — hydrate from storage after mount to avoid SSR mismatch
  const [orderMode, setOrderMode] = useState("single");
  const [cartRows, setCartRows] = useState([]);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try { const saved = sessionStorage.getItem("nitro_order_mode"); if (saved) setOrderMode(saved); } catch {}
    const loaded = loadCart();
    if (loaded.length) setCartRows(loaded);
  }, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(null);
  const [bulkError, setBulkError] = useState(null);
  const cartBarRef = useRef(null);
  const cartRowsRef = useRef(null);
  const toastCoalesceRef = useRef({ count: 0, timer: null });
  const mainRef = useRef(null);
  const [cartBounds, setCartBounds] = useState(null);

  useEffect(() => {
    const el = mainRef.current?.closest(".dash-main");
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 1200;
      const inset = isMobile ? 14 : 20;
      setCartBounds({ left: r.left + inset, right: window.innerWidth - r.right + inset, bottom: isMobile ? 56 + 14 : inset });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => { try { sessionStorage.setItem("nitro_order_mode", orderMode); } catch {} }, [orderMode]);
  useEffect(() => { saveCart(cartRows); }, [cartRows]);

  /* Fetch real services from API */
  useEffect(() => {
    async function loadMenu() {
      try {
        const res = await fetch("/api/services/menu");
        if (!res.ok) throw new Error("Failed to load services");
        const data = await res.json();
        setMenuData(data);
      } catch (e) { setMenuError(e.message); }
      setMenuLoading(false);
    }
    loadMenu();
  }, []);

  /* Normalize platform name to sidebar ID */
  const normPlatform = (name) => {
    const map = { "Twitter/X": "twitter", "Apple Music": "applemusic", "SoundCloud": "soundcloud", "OnlyFans": "onlyfans", "TrustPilot": "trustpilot", "Kick": "kick" };
    return map[name] || name.toLowerCase().replace(/[^a-z]/g, "");
  };

  /* Platform counts for sidebar badges */
  const allGroups = menuData?.groups || [];
  const platformCounts = {};
  allGroups.forEach(g => { const k = normPlatform(g.platform); platformCounts[k] = (platformCounts[k] || 0) + 1; });

  /* Map API groups to per-platform service list matching existing shape */
  const services = (() => {
    if (!menuData?.groups) return [];
    return menuData.groups
      .filter(g => normPlatform(g.platform) === platform)
      .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      .map(g => ({
        id: g.id,
        name: g.name,
        type: g.type?.toLowerCase() || "standard",
        ng: g.nigerian,
        tiers: g.tiers.map(tier => ({
          id: tier.id,
          tier: tier.tier,
          price: tier.price,
          per: "1K",
          refill: tier.refill ? "Yes" : "No",
          speed: tier.speed || "0-2 hrs",
          min: tier.min,
          max: tier.max,
          provider: tier.provider || "mtp",
        })),
      }));
  })();

  const types = [...new Set(services.map(s => s.type))];
  const filtered = filterType === "all" ? services : services.filter(s => s.type === filterType);
  const hasOrder = selSvc && selTier;
  const price = selTier ? Math.round(((Number(qty) || 0) / 1000) * selTier.price) : 0;
  const activePlat = PLATFORMS.find(p => p.id === platform);

  useEffect(() => { setSelSvc(null); setSelTier(null); setFilterType("all"); setOrderModal(false); setOrderSuccess(null); setSearch(""); }, [platform]);

  /* Click outside any card → collapse */
  const listRef = useRef(null);
  useEffect(() => {
    if (!selSvc) return;
    const handler = (e) => {
      // If click is inside the service list, the card's own onClick handles it
      // If click is outside the service list entirely, collapse
      if (listRef.current && !listRef.current.contains(e.target)) {
        // Don't collapse if clicking inside order form, modal, bottom bar, or tour overlay
        if (e.target.closest('.no-modal-overlay') || e.target.closest('.no-bottom-bar') || e.target.closest('.no-form-wrap') || e.target.closest('[data-tour-tooltip]')) return;
        setSelSvc(null); setSelTier(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selSvc]);

  const pickService = (svc) => {
    if (selSvc?.id === svc.id) {
      setSelSvc(null); setSelTier(null);
    }
    else { setSelSvc(svc); setSelTier(null); }
  };
  const pickTier = (tier, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    if (orderMode === "bulk") { addToCart(tier, e); return; }
    setSelTier(tier); setQty(tier.min || 100); setOrderModal(true);
  };

  const addToCart = useCallback((tier) => {
    if (cartRows.length >= 50) { toast.info("Cart full", "50-row limit reached"); return; }
    const svc = services.find(s => s.tiers.some(t2 => t2.id === tier.id));
    const svcName = svc?.name || "Service";
    const svcType = (svc?.type || "").toLowerCase();
    const needsComments = (svcType.includes("comment") || svcName.toLowerCase().includes("comment")) && !svcName.toLowerCase().includes("comment like");
    const needsMentions = svcName.toLowerCase().includes("mention");
    const needsPoll = svcName.toLowerCase().includes("poll vote") || (svcName.toLowerCase().includes("poll") && !svcName.toLowerCase().includes("upvote"));
    const needsReview = svcName.toLowerCase().includes("review") && !svcName.toLowerCase().includes("review like");

    setCartRows(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      svcId: svc?.id, tierId: tier.id, tier: tier.tier,
      name: svcName, platform, link: "", qty: tier.min || 1000,
      min: tier.min || 100, max: tier.max || 50000,
      storedPricePer1k: tier.price || 0,
      needsComments: needsComments || needsReview,
      needsMentions, needsPoll, comments: "", commentsOpen: false,
      expanded: true,
    }]);

    // Pulse cart bar
    if (cartBarRef.current) {
      cartBarRef.current.classList.remove("bulk-pulse"); void cartBarRef.current.offsetWidth; cartBarRef.current.classList.add("bulk-pulse");
    }

    // Debounced toast
    const c = toastCoalesceRef.current;
    c.count++;
    clearTimeout(c.timer);
    c.timer = setTimeout(() => {
      if (c.count === 1) toast.success("Added to cart", `${svcName} (${tier.tier})`);
      else toast.success("Added to cart", `${c.count} orders added`);
      c.count = 0;
    }, 800);
  }, [cartRows.length, services, platform, toast]);

  // Tour integration — listen for tour events to auto-select service/tier
  useEffect(() => {
    const handleSelectService = () => {
      const svc = services[0];
      if (svc) { setSelSvc(svc); setSelTier(null); }
    };
    const handleSelectTier = () => {
      const svc = selSvc || services[0];
      if (svc && svc.tiers?.[0]) {
        if (!selSvc) setSelSvc(svc);
        setSelTier(svc.tiers[0]);
        setQty(svc.tiers[0].min || 100);
        setOrderModal(true);
      }
    };
    window.addEventListener("nitro-tour-select-service", handleSelectService);
    window.addEventListener("nitro-tour-select-tier", handleSelectTier);
    return () => {
      window.removeEventListener("nitro-tour-select-service", handleSelectService);
      window.removeEventListener("nitro-tour-select-tier", handleSelectTier);
    };
  }, [services, selSvc]);

  /* Place order */
  const submitOrder = async () => {
    if (!selTier?.id || !link || orderLoading) return;
    setOrderLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: selTier.id, link: link.trim(), quantity: qty, ...(comments?.trim() ? { comments: comments.trim() } : {}), serviceType: selSvc?.type || "" }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Order failed", data.error || "Something went wrong", { position: "bottom" }); setOrderLoading(false); return; }
      setOrderSuccess({ ...data.order, platform: platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "Service" });
      setLink("");
      if (onOrderSuccess) onOrderSuccess();
    } catch (err) {
      const msg = err?.name === "TimeoutError" ? "Request timed out" : "Network error";
      toast.error(msg, "Check your connection and try again.", { position: "bottom" });
    }
    setOrderLoading(false);
  };

  const scrollToRow = (idx) => {
    if (cartRowsRef.current) {
      const el = cartRowsRef.current.querySelector(`[data-row="${idx}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.remove("bulk-row-flash"); void el?.offsetWidth; el?.classList.add("bulk-row-flash");
    }
  };

  const submitBulk = async () => {
    if (bulkLoading || cartRows.length === 0) return;
    setBulkError(null);
    const emptyIdx = cartRows.findIndex(r => !r.link.trim());
    if (emptyIdx >= 0) {
      const count = cartRows.filter(r => !r.link.trim()).length;
      toast.error("Missing links", `${count} row${count > 1 ? "s" : ""} need links`);
      scrollToRow(emptyIdx);
      return;
    }
    const badLink = cartRows.findIndex(r => !isValidLink(r.link));
    if (badLink >= 0) {
      toast.error("Invalid link", `Row ${badLink + 1}: enter a valid URL or @username`);
      scrollToRow(badLink);
      return;
    }
    const qtyBad = cartRows.findIndex(r => r.qty < r.min || r.qty > r.max);
    if (qtyBad >= 0) {
      toast.error("Invalid quantity", `Row ${qtyBad + 1}: must be ${cartRows[qtyBad].min.toLocaleString()}–${cartRows[qtyBad].max.toLocaleString()}`);
      scrollToRow(qtyBad);
      return;
    }
    const dupIdx = cartRows.findIndex((r, i) => isDuplicate(cartRows, i));
    if (dupIdx >= 0) {
      toast.error("Duplicate order", "Remove duplicate rows before placing");
      scrollToRow(dupIdx);
      return;
    }
    const needsComments = cartRows.findIndex(r => (r.needsComments || r.needsMentions) && !r.comments.trim());
    if (needsComments >= 0) {
      toast.error("Missing comments", `Row ${needsComments + 1} needs comments`);
      scrollToRow(needsComments);
      return;
    }

    // Price drift guard — compare cart prices against fresh menu data
    if (menuData?.groups) {
      const drifted = [];
      for (const row of cartRows) {
        const price = getRowPrice(row, menuData);
        const storedPrice = Math.round((row.storedPricePer1k || 0) / 1000 * row.qty);
        if (row.storedPricePer1k && storedPrice > 0 && Math.abs(price - storedPrice) / storedPrice > 0.05) {
          drifted.push(row.id);
        }
      }
      if (drifted.length > 0) {
        toast.error("Prices changed", "Review updated prices before placing");
        setCartRows(prev => prev.map(r => ({ ...r, storedPricePer1k: getRowPricePer1k(r, menuData) })));
        return;
      }
    }

    const idempotencyKey = crypto.randomUUID();
    setBulkLoading(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          orders: cartRows.map(r => ({
            tierId: r.tierId, link: r.link.trim(), quantity: r.qty,
            ...(r.comments.trim() ? { comments: r.comments.trim() } : {}),
          })),
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "Insufficient balance") {
          setBulkError({ type: "balance", needed: data.needed || 0 });
        } else {
          toast.error("Bulk order failed", data.error || "Something went wrong");
        }
        setBulkLoading(false);
        return;
      }
      setBulkSuccess({ ...data, rows: cartRows.map(r => ({ ...r })) });
      setCartRows([]);
      localStorage.removeItem(CART_KEY);
      if (onOrderSuccess) onOrderSuccess();
    } catch (err) {
      const msg = err?.name === "TimeoutError" ? "Request timed out — orders may still be processing" : "Couldn't reach Nitro";
      setBulkError({ type: "network", message: msg });
    }
    setBulkLoading(false);
  };

  function getRowPricePer1k(row, menu) {
    if (!menu?.groups) return 0;
    for (const g of menu.groups) { const ti = g.tiers.find(t2 => t2.id === row.tierId); if (ti) return ti.price; }
    return 0;
  }

  // Keyboard shortcuts: Esc closes cart, Cmd/Ctrl+Enter submits
  const submitBulkRef = useRef(submitBulk);
  submitBulkRef.current = submitBulk;
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && cartOpen) { setCartOpen(false); e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && cartOpen && !bulkLoading && cartRows.length > 0) { submitBulkRef.current(); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cartOpen, bulkLoading, cartRows.length]);

  const [platGroup, setPlatGroup] = useState("Social Platforms");
  const [platExpanded, setPlatExpanded] = useState(false);
  const [platWindowStart, setPlatWindowStart] = useState(0);

  /* Platforms in the selected group with services */
  const groupPlatforms = PLATFORM_GROUPS.find(g => g.label === platGroup)?.platforms || [];
  const visiblePlatforms = groupPlatforms.filter(p => (platformCounts[p.id] || 0) > 0);

  const TierChips = ({ svc }) => (
    <div className="flex gap-1.5 flex-wrap mt-2.5" data-tour="no-tier-select">
      {svc.tiers.map(tier => {
        const s = TS[tier.tier];
        const isSel = selTier?.tier === tier.tier && selSvc?.id === svc.id;
        const PROV_COLORS = { mtp: "#ef4444", jap: "#3b82f6", dao: "#22c55e" };
        return (
          <button key={tier.tier} onClick={e => pickTier(tier, e)} className={`no-tier-chip relative py-1 px-2.5 desktop:py-[7px] desktop:px-3.5 rounded-[20px] text-[11px] desktop:text-[13px] font-semibold cursor-pointer border-[1.5px] border-solid font-[inherit] transition-all duration-150 ease-in-out flex items-center gap-1.5 hover:brightness-110 hover:-translate-y-px${isSel ? " !border-2 shadow-[0_2px_8px_rgba(0,0,0,.2)] -translate-y-px" : ""}`} style={{ background: dark ? s.bgD : s.bg, color: s.text, borderColor: isSel ? s.text : (dark ? s.borderD : s.border) }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PROV_COLORS[tier.provider] || PROV_COLORS.mtp }} />
            {s.label} {tier.tier} · ₦{tier.price.toLocaleString()}
          </button>
        );
      })}
    </div>
  );

  const ServiceCard = ({ svc }) => {
    const isSel = selSvc?.id === svc.id;
    const lowestPrice = Math.min(...svc.tiers.map(ti => ti.price));
    const lowestPer = svc.tiers.find(ti => ti.price === lowestPrice)?.per || "1K";
    const activeTier = isSel && selTier ? selTier : null;
    return (
      <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => pickService(svc)} className={`no-svc-card rounded-xl desktop:rounded-[14px] py-3 px-3.5 md:py-3.5 md:px-4 desktop:py-4 desktop:px-5 cursor-pointer border border-solid transition-all duration-150 ease-in-out hover:border-[rgba(196,125,142,.12)]${isSel ? " relative z-[1]" : ""}`} style={{ borderColor: isSel ? (svc.ng ? (dark ? "#4ade80" : "#16a34a") : t.accent) : t.cardBorder, borderLeftWidth: isSel ? 4 : svc.ng ? 3 : undefined, borderLeftColor: isSel ? (svc.ng ? (dark ? "#4ade80" : "#16a34a") : "#c47d8e") : svc.ng ? "#4ade80" : undefined, background: isSel ? (svc.ng ? (dark ? "#122a1c" : "#d0f0db") : (dark ? "#2a1828" : "#f5e4e8")) : svc.ng ? (dark ? "rgba(30,80,60,.15)" : "#e8f5ee") : t.cardBg, opacity: selSvc && !isSel ? (dark ? .3 : .45) : 1, transform: isSel ? "scale(1.01)" : "scale(1)", boxShadow: isSel ? (svc.ng ? "0 4px 20px rgba(22,163,74,.25), 0 0 0 1.5px rgba(22,163,74,.2)" : "0 4px 20px rgba(196,125,142,.3), 0 0 0 1.5px rgba(196,125,142,.25)") : undefined }}>
        <div className="flex items-start justify-between gap-3 max-md:flex-wrap max-md:gap-1.5">
          <div className="flex-1 min-w-0 max-md:basis-[60%]">
            <div className="text-sm md:text-[15px] desktop:text-base font-medium mb-1" style={{ color: svc.ng ? (dark ? "#5dcaa5" : "#0F6E56") : t.text }}>{svc.name}</div>
            {/* Only show badges when NOT expanded — chips replace them */}
            {!isSel && (
              <div className="flex gap-[3px] flex-wrap">
                {svc.tiers.map(tier => (
                  <span key={tier.tier} className="m text-xs py-0.5 px-[7px] rounded font-semibold border border-solid" style={{ background: dark ? TS[tier.tier].bgD : TS[tier.tier].bg, color: TS[tier.tier].text, borderColor: dark ? TS[tier.tier].borderD : TS[tier.tier].border }}>{tier.tier}</span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] desktop:text-[11px] mb-0.5" style={{ color: t.textMuted }}>{activeTier ? activeTier.tier : "from"}</div>
            <div className="m text-[15px] md:text-base desktop:text-lg font-bold" style={{ color: t.accent }}>₦{(activeTier ? activeTier.price : lowestPrice).toLocaleString()}<span className="text-[11px] font-normal" style={{ color: t.textMuted }}>/{activeTier ? activeTier.per : lowestPer}</span></div>
          </div>
        </div>
        {/* Tier selection chips — always shown when expanded (single or multi) */}
        {isSel && <TierChips svc={svc} />}
        {/* Prompt — shown when expanded but no tier selected yet */}
        {isSel && !activeTier && (
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium py-2 px-3 rounded-lg bg-[rgba(196,125,142,.06)]" style={{ color: t.textMuted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            Select a tier to see details and order
          </div>
        )}
        {/* Tier detail — shown when a tier is picked */}
        {isSel && activeTier && (
          <div className="mt-2.5 py-2.5 px-3 desktop:py-3 desktop:px-3.5 rounded-[10px] flex items-center justify-between gap-3 border border-solid" style={{ background: dark ? `${TS[activeTier.tier].text}08` : `${TS[activeTier.tier].text}06`, borderColor: dark ? `${TS[activeTier.tier].text}18` : `${TS[activeTier.tier].text}12` }}>
            <div className="text-xs" style={{ color: t.textMuted }}>{refillLabel(activeTier.tier)} · {activeTier.speed} · Min {(activeTier.min || 100).toLocaleString()}</div>
            <div className="m text-[15px] font-bold" style={{ color: TS[activeTier.tier].text }}>₦{activeTier.price.toLocaleString()}<span className="text-[11px] font-normal" style={{ color: t.textMuted }}>/{activeTier.per}</span></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={mainRef} style={{ paddingBottom: orderMode === "bulk" ? 82 : 0 }}>
      <div className="pb-2 desktop:pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg desktop:text-[22px] font-semibold" style={{ color: t.text }}>New Order</div>
          <SegPill value={orderMode} options={["single", "bulk"]} onChange={setOrderMode} label="Order mode" dark={dark} t={t} />
        </div>
        <div className="text-sm desktop:text-[15px] max-md:text-xs mt-0.5" style={{ color: t.textMuted }}>{menuData ? `${allGroups.length} services across ${Object.keys(platformCounts).length} platforms` : "Browse and order social media services"}</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Bulk mode banner */}
      {orderMode === "bulk" && (
        <div className="flex items-center gap-2.5 rounded-[10px] py-3 px-4 mb-3 border border-solid" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", borderColor: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)" }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.accent }} />
          <span className="text-[13px] font-medium" style={{ color: t.accent }}>Bulk mode · Tap any tier chip to add it to your cart.</span>
        </div>
      )}

      {/* Mobile/tablet guide */}
      <div className="hidden max-desktop:block">
        <MobileGuide dark={dark} t={t} />
      </div>

      {menuLoading && (
        <div className="p-0">
          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[38px] rounded-lg mb-3.5`} />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="py-3.5 px-4 rounded-xl mb-2 border border-solid" style={{ borderColor: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)", background: dark ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.6)" }}>
              <div className="flex justify-between items-center">
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-4 rounded`} style={{ width: `${45 + i * 8}%` }} />
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-5 w-[70px] rounded`} />
              </div>
            </div>
          ))}
        </div>
      )}
      {menuError && <div className="p-10 text-center" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{menuError}</div>}

      {!menuLoading && !menuError && <>

      {/* ═══ GROUP TABS ═══ */}
      <div className="flex gap-0 mb-3.5 border-b border-solid" data-tour="no-platform-tabs" style={{ borderBottomColor: t.cardBorder }}>
        {PLATFORM_GROUPS.map(g => (
          <button key={g.label} onClick={() => { setPlatGroup(g.label); const first = g.platforms.find(p => (platformCounts[p.id] || 0) > 0); if (first) setPlatform(first.id); }} className={`py-1.5 px-3 text-xs md:py-[7px] md:px-3.5 md:text-[13px] desktop:py-2 desktop:px-4 desktop:text-sm font-medium cursor-pointer border-none border-b-2 border-b-transparent -mb-px bg-transparent font-[inherit] transition-colors duration-150${platGroup === g.label ? " !font-semibold" : ""}`} style={{ color: platGroup === g.label ? t.accent : t.textMuted, borderBottomColor: platGroup === g.label ? t.accent : "transparent" }}>
            {g.label.replace(" Platforms", "").replace("SEO & ", "")}
          </button>
        ))}
      </div>

      {/* ═══ PLATFORM ICONS — desktop only ═══ */}
      <div className="hidden desktop:grid desktop:grid-cols-10 desktop:gap-2 desktop:mb-4">
        {visiblePlatforms.map(p => {
          const isActive = platform === p.id;
          return (
            <button key={p.id} onClick={() => setPlatform(p.id)} className={`no-plat-icon-btn aspect-square rounded-[14px] border-[1.5px] border-solid flex items-center justify-center cursor-pointer font-[inherit] transition-all duration-150 w-full hover:!border-[rgba(196,125,142,.3)]${isActive ? " no-plat-icon-on !border-[2.5px]" : ""}`} style={{ borderColor: isActive ? t.accent : t.cardBorder, background: isActive ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: isActive ? t.accent : (dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.55)") }} title={p.label}>
              <span className="flex items-center justify-center w-6 h-6 text-current">{p.icon}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ MOBILE/TABLET: 5 icon window + expandable grid ═══ */}
      <div className="hidden max-desktop:block mb-3.5">
        <div className="grid grid-cols-5 gap-1.5 md:gap-2 mb-2">
          {visiblePlatforms.slice(platWindowStart, platWindowStart + 5).map(p => {
            const isActive = platform === p.id;
            return (
              <button key={p.id} onClick={() => setPlatform(p.id)} className={`no-mob-plat-btn aspect-square rounded-[10px] md:rounded-xl border-[1.5px] border-solid flex items-center justify-center cursor-pointer font-[inherit] transition-all duration-150${isActive ? " no-mob-plat-on !border-[2.5px]" : ""}`} style={{ borderColor: isActive ? t.accent : t.cardBorder, background: isActive ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: isActive ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)") }}>
                <span className="flex items-center justify-center w-5 h-5 md:w-[22px] md:h-[22px]">{p.icon}</span>
              </button>
            );
          })}
        </div>
        {visiblePlatforms.length > 5 && (
          <button onClick={() => setPlatExpanded(!platExpanded)} className="w-full py-2 rounded-lg border border-dashed bg-transparent text-xs font-medium cursor-pointer font-[inherit] mb-2" style={{ color: t.textMuted, borderColor: t.cardBorder }}>
            {platExpanded ? "Collapse ▴" : `View all ${visiblePlatforms.length} platforms ▾`}
          </button>
        )}
        {platExpanded && (
          <div className="border border-solid rounded-xl p-2.5 mb-2" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
            <div className="grid grid-cols-5 gap-[5px] md:gap-1.5">
              {visiblePlatforms.map((p, i) => {
                const isActive = platform === p.id;
                return (
                  <button key={p.id} onClick={() => { setPlatform(p.id); const rowStart = Math.floor(i / 5) * 5; setPlatWindowStart(Math.min(rowStart, Math.max(0, visiblePlatforms.length - 5))); setPlatExpanded(false); }} className={`no-mob-plat-btn aspect-square rounded-[10px] md:rounded-xl border-[1.5px] border-solid flex items-center justify-center cursor-pointer font-[inherit] transition-all duration-150${isActive ? " no-mob-plat-on !border-[2.5px]" : ""}`} style={{ borderColor: isActive ? t.accent : t.cardBorder, background: isActive ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: isActive ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)") }}>
                    <span className="flex items-center justify-center w-5 h-5 md:w-[22px] md:h-[22px]">{p.icon}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ SECTION HEADER ═══ */}
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-solid" style={{ borderBottomColor: t.cardBorder }}>
        <div className="flex items-center justify-center" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.55)" }}>{activePlat?.icon}</div>
        <span className="text-[17px] font-semibold" style={{ color: t.text }}>{activePlat?.label}</span>
        <span className="text-[13px] ml-auto" style={{ color: t.textMuted }}>{filtered.length} service{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative mb-3.5">
        <input aria-label="Search services" placeholder={`Search ${activePlat?.label || ""} services...`} value={search} onChange={e => setSearch(e.target.value)} className="w-full py-[9px] px-3 pr-8 desktop:py-2.5 desktop:px-3.5 rounded-[10px] border border-solid text-[13px] desktop:text-sm font-[inherit] outline-none box-border focus:ring-2 focus:ring-[#c47d8e]/20 transition-[border-color,box-shadow] duration-200" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.03)" : "#fff", color: t.text }} />
        {search && <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)", color: t.textMuted }}>✕</button>}
      </div>

      {/* ═══ SERVICE CARDS ═══ */}
      <div className="flex flex-col gap-2" data-tour="no-service-list" ref={listRef}>
        {filtered.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
        {filtered.length === 0 && <div className="py-10 text-center text-[15px]" style={{ color: t.textMuted }}>Coming soon.</div>}
      </div>

      {/* Fixed bottom bar — mobile/tablet — single mode only */}
      {orderMode === "single" && hasOrder && (
        <div className="no-bottom-bar flex fixed bottom-0 left-0 right-0 backdrop-blur-[16px] py-2.5 px-5 max-md:px-4 items-center justify-between z-30 gap-3" data-tour="no-order-bar" style={{ background: dark ? "rgba(8,11,20,.97)" : "rgba(244,241,237,.97)", borderTop: `1px solid ${t.cardBorder}` }}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] max-md:text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: t.text }}>{selSvc?.name}</div>
            <div className="text-sm mt-px">
              <span className="font-semibold" style={{ color: TS[selTier.tier].text }}>{TS[selTier.tier].label} {selTier.tier}</span>
              <span style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="m text-lg max-md:text-base font-semibold whitespace-nowrap" style={{ color: t.accent }}>₦{price.toLocaleString()}</span>
            <button onClick={() => setOrderModal(true)} className="py-2.5 px-[22px] max-md:px-[18px] rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer">Order</button>
          </div>
        </div>
      )}

      {/* Order modal — single mode only */}
      {orderMode === "single" && (orderModal || orderSuccess) && hasOrder && (
        <div className="no-modal-overlay flex fixed inset-0 bg-black/40 z-50 items-center max-md:items-end justify-center p-6 max-md:p-0" onClick={() => { setOrderModal(false); setOrderSuccess(null); }} onKeyDown={e=>{if(e.key==='Escape'){setOrderModal(false);setOrderSuccess(null)}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!orderSuccess&&!orderLoading){submitOrder()}}}>
          <div role="dialog" aria-modal="true" aria-label="Order summary" className="w-full max-w-[420px] max-md:max-w-none rounded-2xl max-md:rounded-b-none max-h-[90vh] max-md:max-h-[80vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,.3)] border border-solid max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#ffffff", borderColor: t.cardBorder }}>
            {orderSuccess ? (
              <div className="p-6 max-md:p-5 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="text-lg font-semibold mb-1" style={{ color: t.text }}>Order placed</div>
                <div className="text-sm mb-5" style={{ color: t.textMuted }}>Your order starts processing in 10–15 minutes. You can track progress from your order history.</div>
                <div className="flex flex-col gap-3 rounded-xl p-4 mb-5 text-left" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}` }}>
                  {[["Service", orderSuccess.service], ["Quantity", (orderSuccess.quantity || 0).toLocaleString()], ["Charged", `₦${(orderSuccess.charge || 0).toLocaleString()}`]].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span style={{ color: t.textMuted }}>{label}</span>
                      <span className="font-medium" style={{ color: t.text }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => { setOrderSuccess(null); setOrderModal(true); }} className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border border-solid cursor-pointer" style={{ background: "transparent", borderColor: t.cardBorder, color: t.text }}>Place another</button>
                  {onViewOrders && <button onClick={() => { setOrderSuccess(null); setOrderModal(false); onViewOrders(); }} className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer" style={{ background: t.accent, color: "#fff" }}>View orders</button>}
                </div>
              </div>
            ) : (
              <OrderForm selSvc={selSvc} selTier={selTier} platform={platform} qty={qty} setQty={setQty} link={link} setLink={setLink} comments={comments} setComments={setComments} dark={dark} t={t} onClose={() => setOrderModal(false)} onSubmit={submitOrder} orderLoading={orderLoading} loyaltyDiscount={menuData?.loyaltyDiscount || 0} loyaltyTier={menuData?.loyaltyTier || null} />
            )}
          </div>
        </div>
      )}

      {/* ═══ BULK CART BAR + EXPANDED ═══ */}
      {orderMode === "bulk" && cartBounds && <BulkCartBar ref={cartBarRef} rows={cartRows} dark={dark} t={t} menuData={menuData} bounds={cartBounds} cartOpen={cartOpen} onClick={() => { if (cartRows.length > 0) setCartOpen(true); }} />}
      {orderMode === "bulk" && cartOpen && cartBounds && <BulkCartExpanded rows={cartRows} setRows={setCartRows} dark={dark} t={t} menuData={menuData} bounds={cartBounds} onClose={() => setCartOpen(false)} onClear={() => { setCartRows([]); setCartOpen(false); }} onPlace={submitBulk} loading={bulkLoading} rowsScrollRef={cartRowsRef} bulkError={bulkError} setBulkError={setBulkError} bulkSuccess={bulkSuccess} setBulkSuccess={setBulkSuccess} onViewOrders={onViewOrders} />}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MOBILE/TABLET GUIDE                 ═══ */
/* ═══════════════════════════════════════════ */
function MobileGuide({ dark, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const TS_MINI = { Budget: { icon: "💰", color: "#e0a458" }, Standard: { icon: "⚡", color: "#60a5fa" }, Premium: { icon: "👑", color: "#a78bfa" } };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [open]);

  return (
    <div ref={ref} className="rounded-xl overflow-hidden mb-3 border border-solid" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", boxShadow: dark ? "none" : "0 2px 8px rgba(0,0,0,.04)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-3 px-3.5 bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.text }}>
        <span className="text-sm font-semibold">📖 How Our Services Work</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 text-[13px] leading-[1.7]" style={{ color: t.textMuted }}>
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {Object.entries(TS_MINI).map(([tier, { icon, color }]) => (
              <span key={tier} className="py-1 px-2.5 rounded-md text-[13px] font-semibold" style={{ background: dark ? `${color}15` : `${color}10`, color }}>{icon} {tier}</span>
            ))}
          </div>
          <div className="mb-1.5"><b style={{ color: "#e0a458" }}>Budget</b> — Cheapest. No refill if count drops.</div>
          <div className="mb-1.5"><b style={{ color: "#60a5fa" }}>Standard</b> — Best value. Free top-up if count drops.</div>
          <div className="mb-2.5"><b style={{ color: "#a78bfa" }}>Premium</b> — Top quality. Won't drop. Lifetime guarantee.</div>
          <div className="py-2 px-2.5 rounded-lg mb-2.5 border border-solid" style={{ background: dark ? "rgba(74,222,128,.05)" : "rgba(22,163,74,.03)", borderColor: dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)" }}>
            <span className="font-semibold" style={{ color: dark ? "#4ade80" : "#16a34a" }}>🇳🇬 Nigerian Services</span>
            <span className="ml-1">— Look for the flag! Local engagement for Naija creators.</span>
          </div>
          <div className="text-xs" style={{ color: t.textMuted }}>
            <div className="mb-[3px]">• <b style={{ color: t.text }}>Refill</b> = free top-up if count drops</div>
            <div className="mb-[3px]">• <b style={{ color: t.text }}>Start small</b> — test Budget first</div>
            <div>• Set profile to <b style={{ color: t.text }}>public</b> before ordering</div>
          </div>
          <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("nitro-order-tour")); }} className="mt-3 py-[9px] px-0 w-full rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 border border-solid text-[#c47d8e]" style={{ borderColor: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)", background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Need a walkthrough?
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ BULK CART BAR (collapsed)           ═══ */
/* ═══════════════════════════════════════════ */

const CartIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/><path d="M3 3h2l2.6 13.2a2 2 0 002 1.6h8.4a2 2 0 002-1.6L22 6H6"/></svg>;

function getRowPrice(row, menuData) {
  if (!menuData?.groups) return 0;
  for (const g of menuData.groups) {
    const tier = g.tiers.find(t2 => t2.id === row.tierId);
    if (tier) return Math.round((tier.price / 1000) * row.qty);
  }
  return 0;
}

const BulkCartBar = forwardRef(function BulkCartBar({ rows, dark, t, menuData, bounds, cartOpen, onClick }, ref) {
  const empty = rows.length === 0;
  const platforms = [...new Set(rows.map(r => r.platform))];
  const total = rows.reduce((s, r) => s + getRowPrice(r, menuData), 0);
  const shown = platforms.slice(0, 6);
  const overflow = platforms.length - shown.length;
  const bp = typeof window !== "undefined" && window.innerWidth < 640 ? "sm" : "lg";

  return (
    <div ref={ref} role={empty ? undefined : "button"} tabIndex={empty ? undefined : 0} aria-expanded={cartOpen} aria-label={empty ? "Empty cart" : `${rows.length} orders in cart`} onClick={onClick} onKeyDown={e => { if (!empty && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }} className={`fixed rounded-[16px] py-3 px-4 max-md:py-2.5 max-md:px-3 flex items-center gap-5 max-md:gap-3 border-2 border-solid z-[50] transition-all duration-200 ${empty ? "opacity-85" : "cursor-pointer hover:-translate-y-px"}`} style={{ left: bounds.left, right: bounds.right, bottom: bounds.bottom, background: dark ? "#171d32" : "#fcfaf8", borderColor: dark ? "rgba(196,125,142,.35)" : "rgba(196,125,142,.3)", boxShadow: dark ? "0 -6px 32px rgba(0,0,0,.35), 0 0 0 1px rgba(196,125,142,.1)" : "0 -6px 32px rgba(0,0,0,.1), 0 0 0 1px rgba(196,125,142,.06), 0 4px 16px rgba(196,125,142,.08)" }}>
      {/* Left — cart icon + count */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-[38px] h-[38px] max-md:w-[34px] max-md:h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: t.accent, color: "#fff" }}><CartIcon /></div>
        <div className="flex flex-col gap-px">
          <span className="text-[13.5px] font-semibold leading-tight" style={{ color: empty ? t.textMuted : t.text }}>{empty ? "Your cart" : `${rows.length} ${rows.length === 1 ? "order" : "orders"}`}</span>
          <span className="text-[10.5px] leading-tight" style={{ color: t.textMuted }}>{empty ? "Tap a tier chip to add an order" : "in cart"}</span>
        </div>
      </div>

      {/* Spacer when empty, separator + platforms when filled */}
      {empty && <div className="flex-1" />}
      {!empty && <div className="w-px self-stretch shrink-0" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }} />}
      {!empty && (
        <div className="flex-1 flex items-center min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5">
            {shown.map(p => {
              const plat = PLATFORMS.find(pl => pl.id === p);
              return <span key={p} className="flex items-center justify-center w-5 h-5 shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]" style={{ color: t.textMuted }}>{plat?.icon}</span>;
            })}
            {overflow > 0 && <span className="text-[11px] font-medium shrink-0" style={{ color: t.textMuted }}>+{overflow}</span>}
          </div>
          <span className="text-xs ml-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 hidden desktop:inline" style={{ color: t.textMuted }}>
            {platforms.length <= 3 ? platforms.map(p => PLATFORMS.find(pl => pl.id === p)?.label || p).join(" · ") : `${PLATFORMS.find(pl => pl.id === platforms[0])?.label || platforms[0]} · ${PLATFORMS.find(pl => pl.id === platforms[1])?.label || platforms[1]} · +${platforms.length - 2} more`}
          </span>
        </div>
      )}

      {/* Separator */}
      {!empty && <div className="w-px self-stretch shrink-0" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }} />}

      {/* Right — total + chevron */}
      <div className="flex items-center gap-3.5 shrink-0">
        {!empty && (
          <div className="flex flex-col items-end gap-px">
            <span className="text-[10px] uppercase tracking-[1.5px] font-medium hidden desktop:block" style={{ color: t.textMuted }}>Total</span>
            <span className="text-[17px] max-md:text-[15px] font-semibold whitespace-nowrap" style={{ color: t.accent }}>{bp === "sm" ? compactPrice(total) : `₦${total.toLocaleString()}`}</span>
          </div>
        )}
        <div className="w-[34px] h-[34px] max-md:w-[30px] max-md:h-[30px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: t.accent }}>
          <span className="w-2 h-2 border-r-2 border-t-2 border-solid rotate-[-45deg]" style={{ borderColor: "#fff" }} />
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════ */
/* ═══ BULK CART EXPANDED (overlay)        ═══ */
/* ═══════════════════════════════════════════ */

function isDuplicate(rows, idx) {
  const row = rows[idx];
  if (!row.link.trim()) return false;
  return rows.some((r, i) => i !== idx && r.svcId === row.svcId && r.tier === row.tier && r.link.trim() === row.link.trim());
}

function BulkCartExpanded({ rows, setRows, dark, t, menuData, bounds, onClose, onClear, onPlace, loading, rowsScrollRef, bulkError, setBulkError, bulkSuccess, setBulkSuccess, onViewOrders }) {
  const loyaltyDiscount = menuData?.loyaltyDiscount || 0;
  const loyaltyTier = menuData?.loyaltyTier || null;
  const subtotal = rows.reduce((s, r) => s + getRowPrice(r, menuData), 0);
  const discount = loyaltyDiscount > 0 ? Math.round(subtotal * (loyaltyDiscount / 100)) : 0;
  const total = subtotal - discount;

  const updateRow = (idx, patch) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  const fileInputRef = useRef(null);
  const [uploadIdx, setUploadIdx] = useState(null);

  const handleTxtUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { e.target.value = ""; return; }
    if (file.type && file.type !== "text/plain") { e.target.value = ""; return; }
    file.text().then(text => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length > 10000) lines.length = 10000;
      if (uploadIdx !== null) updateRow(uploadIdx, { comments: lines.join("\n") });
      e.target.value = "";
    });
  };

  useEffect(() => {
    const handler = (e) => {
      const clickedCard = e.target.closest('[data-row]');
      const clickedIdx = clickedCard ? Number(clickedCard.getAttribute('data-row')) : -1;
      setRows(prev => prev.map((r, i) => {
        if (i === clickedIdx) return r;
        if (!r.expanded) return r;
        const emptyLink = !r.link.trim();
        const validLink = !emptyLink && isValidLink(r.link);
        const qtyOk = r.qty >= r.min && r.qty <= r.max;
        const needsComments = (r.needsComments || r.needsMentions) && !r.comments.trim() && !emptyLink;
        const dup = isDuplicate(prev, i);
        if (!validLink || !qtyOk || needsComments || dup) return r;
        return { ...r, expanded: undefined };
      }));
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [setRows]);

  return (
    <>
    <div className="fixed inset-0 z-[55]" onClick={onClose} style={{ background: dark ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.2)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
    <div role="dialog" aria-modal="true" aria-label="Bulk order cart" aria-busy={loading} className="fixed max-h-[85vh] rounded-[14px] border border-solid flex flex-col z-[60] overflow-hidden" style={{ left: bounds.left, right: bounds.right, bottom: bounds.bottom, background: dark ? "#12172a" : "#fff", borderColor: "rgba(196,125,142,.2)", boxShadow: "0 -16px 48px rgba(0,0,0,.14), 0 -4px 12px rgba(0,0,0,.06)" }}>
      <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleTxtUpload} aria-label="Upload comments file" />

      {/* Header */}
      <div className="py-3.5 px-[18px] flex items-center gap-4 border-b border-solid select-none shrink-0" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }}>
        <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: t.accent, color: "#fff" }}><CartIcon /></div>
        <div className="flex flex-col gap-px flex-1 min-w-0">
          <span className="text-[13.5px] font-medium" style={{ color: t.text }}>{rows.length} {rows.length === 1 ? "order" : "orders"}</span>
          <span className="text-[10.5px]" style={{ color: t.textMuted }}>in cart</span>
        </div>
        <button onClick={onClear} disabled={loading} className="py-1 px-2.5 rounded-md border border-solid text-[11px] font-medium cursor-pointer bg-transparent font-[inherit] hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" style={{ borderColor: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", color: t.textMuted }}>Clear cart</button>
        <div className="flex items-center gap-3.5 shrink-0">
          <span className="text-[17px] font-medium" style={{ color: t.accent }}>₦{total.toLocaleString()}</span>
          <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center cursor-pointer" onClick={onClose} style={{ background: t.accent }}>
            <span className="w-2 h-2 border-r-2 border-t-2 border-solid rotate-[135deg]" style={{ borderColor: "#fff" }} />
          </div>
        </div>
      </div>

      {/* Success overlay */}
      {bulkSuccess && (
        <div className="flex-1 overflow-y-auto py-6 px-[18px] max-md:py-4 max-md:px-3.5 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="text-lg font-semibold mb-1" style={{ color: t.text }}>Bulk order placed</div>
          <div className="text-sm mb-4 text-center" style={{ color: t.textMuted }}>{bulkSuccess.total} order{bulkSuccess.total !== 1 ? "s" : ""} placed · {bulkSuccess.placed} processing{bulkSuccess.failed > 0 ? ` · ${bulkSuccess.failed} pending` : ""}</div>
          {bulkSuccess.loyaltyDiscount > 0 && (
            <div className="text-[12.5px] mb-3 py-1.5 px-3 rounded-full" style={{ background: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669" }}>{bulkSuccess.loyaltyTier} discount applied ({bulkSuccess.loyaltyDiscount}%)</div>
          )}
          <div className="w-full rounded-xl p-4 mb-5 border border-solid" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }}>
            <div className="flex justify-between text-sm mb-2" style={{ color: t.textMuted }}>
              <span>Batch</span><span className="font-medium font-[JetBrains_Mono,monospace] text-xs" style={{ color: t.text }}>{bulkSuccess.batchId}</span>
            </div>
            <div className="flex justify-between text-sm mb-2" style={{ color: t.textMuted }}>
              <span>Total charged</span><span className="font-medium" style={{ color: t.accent }}>₦{(bulkSuccess.totalCharge || 0).toLocaleString()}</span>
            </div>
            {(bulkSuccess.orders || []).slice(0, 5).map((o, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-t border-dashed" style={{ borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", color: t.textMuted }}>
                <span className="truncate flex-1 min-w-0 mr-2">{o.service || o.link}</span>
                <span className="shrink-0 font-medium" style={{ color: o.status === "Processing" ? (dark ? "#6ee7b7" : "#059669") : t.accent }}>{o.status}</span>
              </div>
            ))}
            {(bulkSuccess.orders || []).length > 5 && <div className="text-xs mt-1 text-center" style={{ color: t.textMuted }}>+{bulkSuccess.orders.length - 5} more</div>}
          </div>
          <div className="flex gap-3 w-full max-md:flex-col">
            <button onClick={() => { setBulkSuccess(null); onClose(); }} className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border border-solid cursor-pointer" style={{ background: "transparent", borderColor: t.cardBorder, color: t.text }}>Place another</button>
            {onViewOrders && <button onClick={() => { setBulkSuccess(null); onClose(); onViewOrders(); }} className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer" style={{ background: t.accent, color: "#fff" }}>View orders</button>}
          </div>
        </div>
      )}

      {/* Error banners */}
      {!bulkSuccess && bulkError && (
        <div className="mx-[18px] max-md:mx-3.5 mt-3 py-3 px-3.5 rounded-[10px] border border-solid flex items-start gap-3" style={{ background: bulkError.type === "balance" ? (dark ? "rgba(250,204,21,.06)" : "rgba(250,204,21,.08)") : (dark ? "rgba(239,68,68,.06)" : "rgba(239,68,68,.06)"), borderColor: bulkError.type === "balance" ? (dark ? "rgba(250,204,21,.2)" : "rgba(250,204,21,.3)") : (dark ? "rgba(239,68,68,.2)" : "rgba(239,68,68,.2)") }}>
          <span className="text-sm shrink-0 mt-px">{bulkError.type === "balance" ? "💰" : "⚠️"}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium mb-0.5" style={{ color: bulkError.type === "balance" ? (dark ? "#fcd34d" : "#b45309") : (dark ? "#fca5a5" : "#dc2626") }}>{bulkError.type === "balance" ? "Insufficient balance" : "Connection error"}</div>
            <div className="text-[11.5px]" style={{ color: t.textMuted }}>{bulkError.type === "balance" ? `You need ₦${(bulkError.needed || 0).toLocaleString()} more to place this order.` : bulkError.message}</div>
          </div>
          <button onClick={() => setBulkError(null)} className="bg-transparent border-none text-xs cursor-pointer p-1 shrink-0" style={{ color: t.textMuted }}>✕</button>
        </div>
      )}

      {/* Rows */}
      {!bulkSuccess && (
      <div ref={rowsScrollRef} className="overflow-y-auto flex-1 min-h-0 py-4 px-[18px] max-md:py-3 max-md:px-3.5 flex flex-col gap-3">
        {rows.length === 0 && (
          <div className="py-10 text-center text-xs" style={{ color: t.textMuted }}>Cart is empty. Tap any tier chip to add an order.</div>
        )}
        {rows.map((row, idx) => {
          const dup = isDuplicate(rows, idx);
          const emptyLink = !row.link.trim();
          const badLink = !emptyLink && !isValidLink(row.link);
          const qtyBad = row.qty < row.min || row.qty > row.max;
          const needsCommentsWarning = (row.needsComments || row.needsMentions) && !row.comments.trim() && !emptyLink;
          const hasErrors = dup || badLink || qtyBad || needsCommentsWarning;
          const hasValidLink = !emptyLink && isValidLink(row.link);
          const isCollapsed = hasValidLink && !hasErrors && !row.expanded;
          const rowPrice = getRowPrice(row, menuData);
          const commentCount = row.comments ? row.comments.split("\n").filter(l => l.trim()).length : 0;
          const linkPreview = row.link.trim() ? (row.link.replace(/^https?:\/\//, "").slice(0, 40) + (row.link.length > 48 ? "…" : "")) : "";

          if (isCollapsed) return (
            <div key={row.id} data-row={idx} onClick={() => updateRow(idx, { expanded: true })} className="rounded-[12px] py-2.5 px-3.5 max-md:py-2 max-md:px-3 border border-solid cursor-pointer transition-all duration-200 hover:border-[rgba(196,125,142,.25)]" style={{ background: dark ? "rgba(255,255,255,.03)" : "#f7f5f1", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }}>
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]" style={{ color: t.textMuted }}>{PLATFORMS.find(pl => pl.id === row.platform)?.icon}</span>
                <div className="text-[13px] font-medium flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{row.name}</div>
                <span className="text-[10.5px] font-medium py-0.5 px-2.5 rounded-full shrink-0" style={{ background: dark ? TS[row.tier]?.bgD : TS[row.tier]?.bg, color: TS[row.tier]?.text }}>{row.tier}</span>
                <span className="text-[11px] max-w-[120px] truncate font-[JetBrains_Mono,monospace] hidden md:inline" style={{ color: t.textMuted }}>{linkPreview}</span>
                <span className="text-[12.5px] font-medium shrink-0" style={{ color: t.textMuted }}>₦{rowPrice.toLocaleString()}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          );

          return (
            <div key={row.id} data-row={idx} className={`rounded-[12px] p-3.5 px-4 max-md:p-3 max-md:px-3.5 border border-solid transition-all duration-200`} style={{ background: dup ? (dark ? "rgba(226,75,74,.08)" : "#fbe7e7") : badLink ? (dark ? "rgba(226,75,74,.05)" : "#fef5f5") : (dark ? "rgba(255,255,255,.03)" : "#f7f5f1"), borderColor: dup ? (dark ? "#e47373" : "#c23a3a") : badLink ? (dark ? "#e47373" : "#dc2626") : emptyLink ? "rgba(196,125,142,.4)" : qtyBad ? "rgba(196,125,142,.4)" : needsCommentsWarning ? "rgba(196,125,142,.4)" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)") }}>
              {/* Top: platform + name + tier + collapse + remove */}
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex items-center justify-center w-5 h-5 shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]" style={{ color: t.textMuted }}>{PLATFORMS.find(pl => pl.id === row.platform)?.icon}</span>
                <div className="text-[13px] font-medium flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{row.name}</div>
                <span className="text-[10.5px] font-medium py-0.5 px-2.5 rounded-full shrink-0" style={{ background: dark ? TS[row.tier]?.bgD : TS[row.tier]?.bg, color: TS[row.tier]?.text }}>{row.tier}</span>
                {hasValidLink && <button onClick={() => updateRow(idx, { expanded: false })} className="w-[24px] h-[24px] rounded-full bg-transparent border border-solid flex items-center justify-center shrink-0 p-0 cursor-pointer" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", color: t.textMuted }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg></button>}
                <button onClick={() => removeRow(idx)} disabled={loading} className="w-[24px] h-[24px] rounded-full bg-transparent border border-solid flex items-center justify-center text-[10px] shrink-0 p-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", color: t.textMuted }}>✕</button>
              </div>

              {/* Link + qty */}
              <div className="flex gap-2 items-center mb-2.5">
                <input aria-label="Link" disabled={loading} placeholder={LINK_HINTS[row.platform] || `https://${row.platform}.com/...`} value={row.link} onChange={e => updateRow(idx, { link: e.target.value })} className="flex-1 py-2 px-3 rounded-lg border border-solid text-[12px] outline-none min-w-0 font-[JetBrains_Mono,monospace] disabled:opacity-50" style={{ background: emptyLink ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : (dark ? "#0f1322" : "#fff"), borderColor: badLink ? (dark ? "#e47373" : "#dc2626") : emptyLink ? t.accent : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"), color: t.text }} />
                <input aria-label="Quantity" disabled={loading} type="number" min={1} step="1" value={row.qty} onChange={e => { const v = Math.min(row.max, Math.floor(Number(e.target.value)) || 0); updateRow(idx, { qty: v }); }} onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }} className="w-[76px] py-2 px-2.5 rounded-lg border border-solid text-[12px] font-medium text-right outline-none shrink-0 font-[JetBrains_Mono,monospace] disabled:opacity-50" style={{ background: dark ? "#0f1322" : "#fff", borderColor: qtyBad ? t.accent : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"), color: t.text }} />
              </div>

              {/* Presets + price */}
              <div className="flex justify-between items-center gap-3">
                <div className="flex gap-1 flex-wrap">
                  {getPresets(row.min, row.max).map(v => (
                    <button key={v} onClick={() => updateRow(idx, { qty: v })} disabled={loading} className="py-[3px] px-2 rounded-full border border-solid text-[10.5px] font-medium cursor-pointer bg-transparent font-[inherit] disabled:opacity-40" style={{ borderColor: row.qty === v ? t.accent : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"), color: row.qty === v ? t.accent : t.textMuted }}>{v >= 1000 ? `${v / 1000}K` : v}</button>
                  ))}
                </div>
                <span className="text-[12.5px] font-medium shrink-0" style={{ color: t.textMuted }}>₦{rowPrice.toLocaleString()}</span>
              </div>

              {/* Warnings */}
              {dup && <div className="text-[10.5px] mt-1.5 flex items-center gap-1.5" style={{ color: dark ? "#e47373" : "#c23a3a" }}>● Duplicate — remove one or change the tier</div>}
              {emptyLink && !dup && <div className="text-[10.5px] mt-1.5 flex items-center gap-1.5" style={{ color: t.accent }}>○ Paste a link for this row</div>}
              {badLink && !dup && <div className="text-[10.5px] mt-1.5 flex items-center gap-1.5" style={{ color: dark ? "#e47373" : "#dc2626" }}>● Enter a valid URL or @username</div>}
              {qtyBad && !dup && <div className="text-[10.5px] mt-1.5" style={{ color: t.accent }}>{row.qty < row.min ? `Min ${row.min.toLocaleString()} for this service` : `Max ${row.max.toLocaleString()} for this service`}</div>}
              {needsCommentsWarning && !dup && <div className="text-[10.5px] mt-1.5" style={{ color: t.accent }}>○ This service needs at least one comment</div>}

              {/* Comment section */}
              {(row.needsComments || row.needsMentions) && (
                <div className="mt-2 pt-2 border-t border-dashed" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }}>
                  {commentCount > 0 && !row.commentsOpen ? (
                    <>
                      <button onClick={() => updateRow(idx, { commentsOpen: true })} className="inline-flex items-center gap-2 py-[5px] px-3 rounded-full border border-solid text-[11.5px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(127,184,74,.18)" : "#e4f3d9", borderColor: dark ? "#639922" : "#7fb84a", color: dark ? "#b4db7a" : "#27500A" }}>
                        <span className="w-[5px] h-[5px] rounded-full" style={{ background: dark ? "#b4db7a" : "#27500A" }} />
                        <span><b>{commentCount}</b> {row.needsMentions ? "username" : "comment"}{commentCount !== 1 ? "s" : ""}</span>
                        <span className="text-[10.5px] underline ml-1" style={{ color: t.textMuted }}>edit</span>
                      </button>
                      <div className="text-[10.5px] mt-1.5" style={{ color: t.textMuted }}>We'll cycle through them to fill your order</div>
                    </>
                  ) : row.commentsOpen ? (
                    <div className="rounded-lg border border-solid p-2.5" style={{ background: dark ? "#0f1322" : "#fff", borderColor: t.accent }}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-medium" style={{ color: t.text }}>{row.needsMentions ? "Usernames — one per line" : "Seed comments — one per line"}</span>
                        <button onClick={() => updateRow(idx, { commentsOpen: false })} className="bg-transparent border-none text-[11px] cursor-pointer py-0.5 px-1.5 rounded font-[inherit] hover:bg-[rgba(0,0,0,.04)]" style={{ color: t.textMuted }}>Done</button>
                      </div>
                      <textarea placeholder={row.needsMentions ? "username1\nusername2\nusername3" : "Fire post 🔥\nLove this\nLegendary..."} value={row.comments} onChange={e => updateRow(idx, { comments: e.target.value })} rows={4} className="w-full min-h-[90px] rounded-md border border-solid py-2 px-2.5 text-[11.5px] font-[JetBrains_Mono,monospace] outline-none resize-y" style={{ background: dark ? "rgba(255,255,255,.03)" : "#f7f5f1", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", color: t.text }} />
                      <div className="flex justify-between items-center mt-2 text-[10.5px] flex-wrap gap-2" style={{ color: t.textMuted }}>
                        <div className="flex items-center gap-1"><strong style={{ color: t.accent }}>{commentCount}</strong> seed {row.needsMentions ? "username" : "comment"}{commentCount !== 1 ? "s" : ""} · will cycle to fill {row.qty.toLocaleString()}</div>
                        {row.qty > 100 && <button onClick={() => { setUploadIdx(idx); fileInputRef.current?.click(); }} className="inline-flex items-center gap-1 py-1 px-2.5 rounded-md border border-solid text-[10.5px] font-medium cursor-pointer bg-transparent font-[inherit]" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", color: t.textMuted }}>↑ Upload .txt</button>}
                      </div>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => updateRow(idx, { commentsOpen: true })} className="inline-flex items-center gap-2 py-[7px] px-3 rounded-lg border border-solid text-[11.5px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)", borderColor: t.accent, color: t.accent }}>+ Add {row.needsMentions ? "usernames" : "comments"}</button>
                      <div className="text-[10.5px] mt-1.5" style={{ color: t.textMuted }}>We'll cycle through them to fill your order</div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Footer */}
      {!bulkSuccess && rows.length > 0 && (
        <div className="py-3.5 px-[18px] max-md:py-3 max-md:px-3.5 border-t border-solid shrink-0" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }}>
          <div className="flex justify-between text-[12.5px] mb-1.5" style={{ color: t.textMuted }}>
            <span>{rows.length} order{rows.length !== 1 ? "s" : ""} subtotal</span><span>₦{subtotal.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[12.5px] mb-1.5" style={{ color: dark ? "#b4db7a" : "#27500A" }}>
              <span>Loyalty discount ({loyaltyDiscount}%)</span><span>−₦{discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline my-2.5">
            <span className="text-[10px] uppercase tracking-[2px] font-medium" style={{ color: t.textMuted }}>Total</span>
            <span className="text-[22px] font-medium" style={{ color: t.accent }}>₦{total.toLocaleString()}</span>
          </div>
          <button onClick={onPlace} disabled={loading} className="w-full py-3 rounded-[10px] border-none text-[13px] font-medium cursor-pointer font-[inherit] tracking-[.3px]" style={{ background: t.accent, color: "#fff", opacity: loading ? .6 : 1 }}>
            {loading ? "Placing orders..." : `Place ${rows.length} order${rows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SERVICES RIGHT SIDEBAR              ═══ */
/* ═══════════════════════════════════════════ */
export function ServicesSidebar({ dark, t }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-[1px] mb-2.5" style={{ color: t.textMuted }}>Pricing Guide</div>
      {[
        ["Budget", "💰", "Cheapest. No refill if count drops. Good for testing."],
        ["Standard", "⚡", "Best value. Free top-up if count drops."],
        ["Premium", "👑", "Top quality. Won't drop. Lifetime guarantee."],
      ].map(([tier, icon, desc]) => {
        const s = TS[tier];
        return (
          <div key={tier} className="py-2.5 px-3 rounded-[10px] border border-solid mb-1.5" style={{ background: dark ? s.bgD : s.bg, borderColor: dark ? s.borderD : s.border }}>
            <div className="text-[15px] font-semibold mb-[3px]" style={{ color: s.text }}>{icon} {tier}</div>
            <div className="text-sm leading-[1.4]" style={{ color: t.textMuted }}>{desc}</div>
          </div>
        );
      })}

      {/* Nigerian services callout */}
      <div className="mt-3 py-2.5 px-3 rounded-[10px] mb-1.5 border border-solid" style={{ background: dark ? "rgba(74,222,128,.05)" : "rgba(22,163,74,.03)", borderColor: dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)" }}>
        <div className="text-sm font-semibold mb-1" style={{ color: dark ? "#4ade80" : "#16a34a" }}>🇳🇬 Nigerian Services</div>
        <div className="text-[13px] leading-[1.5]" style={{ color: t.textMuted }}>Look for the 🇳🇬 flag! These target Nigerian audiences — real local engagement for Naija creators and businesses.</div>
      </div>

      {/* Pro tips */}
      <div className="text-xs font-semibold uppercase tracking-[1px] mt-4 mb-2" style={{ color: t.textMuted }}>Pro Tips</div>
      <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>
        <div className="mb-1">• <b style={{ color: t.text }}>Refill</b> = free top-up if count drops</div>
        <div className="mb-1">• <b style={{ color: t.text }}>Start small</b> — test a Budget tier first</div>
        <div className="mb-1">• <b style={{ color: t.text }}>Set profile to public</b> before ordering</div>
        <div>• Don't order same link from multiple providers</div>
      </div>

      {/* Walkthrough trigger */}
      <button onClick={() => window.dispatchEvent(new CustomEvent("nitro-order-tour"))} className="mt-4 py-2.5 px-0 w-full rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 border border-solid text-[#c47d8e]" style={{ borderColor: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)", background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Need a walkthrough?
      </button>
    </>
  );
}
