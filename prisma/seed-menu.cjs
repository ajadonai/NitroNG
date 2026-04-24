// Nitro Full Menu Seed — Run: node prisma/seed-menu.cjs
// Target: 200+ tiers across 27+ platforms
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const M = [
// ─── INSTAGRAM (14) ───
{n:"Instagram Followers",p:"Instagram",y:"followers",t:[{t:"Budget",a:5752,s:0,sp:"1-5K/day",r:0},{t:"Standard",a:5839,s:0,sp:"5-10K/day",r:1},{t:"Premium",a:8072,s:0,sp:"5-10K/day",r:1}]},
{n:"Instagram Followers — Fast",p:"Instagram",y:"followers",t:[{t:"Standard",a:8068,s:0,sp:"10-50K/day",r:0}]},
{n:"Instagram Likes",p:"Instagram",y:"likes",t:[{t:"Budget",a:2847,s:0,sp:"5-10K/day",r:0},{t:"Standard",a:2499,s:0,sp:"5-15K/day",r:1},{t:"Premium",a:2498,s:0,sp:"5-15K/day",r:1}]},
{n:"Instagram Premium Likes",p:"Instagram",y:"likes",t:[{t:"Premium",a:2518,s:0,sp:"10-20K/day",r:1}]},
{n:"Instagram Reel/Video Views",p:"Instagram",y:"views",t:[{t:"Budget",a:7661,s:0,sp:"10-20M/day",r:0},{t:"Standard",a:2127,s:0,sp:"100-500K/day",r:1},{t:"Premium",a:2504,s:0,sp:"400-800K/day",r:1}]},
{n:"Instagram Video Views — USA 🇺🇸",p:"Instagram",y:"views",t:[{t:"Premium",a:8175,s:0,sp:"10-50K/day",r:0}]},
{n:"Instagram Photo Views",p:"Instagram",y:"views",t:[{t:"Budget",a:8702,s:0,sp:"50-100K/day",r:0},{t:"Standard",a:8703,s:0,sp:"50-300K/day",r:0}]},
{n:"Instagram Story Views",p:"Instagram",y:"views",t:[{t:"Budget",a:3516,s:0,sp:"50-100K/day",r:0},{t:"Standard",a:5214,s:0,sp:"Fast",r:0}]},
{n:"Instagram Shares",p:"Instagram",y:"engagement",t:[{t:"Budget",a:5707,s:0,sp:"50-100K/day",r:0},{t:"Standard",a:2960,s:0,sp:"Fast",r:0},{t:"Premium",a:5208,s:0,sp:"Fast",r:0}]},
{n:"Instagram Saves",p:"Instagram",y:"engagement",t:[{t:"Budget",a:2947,s:0,sp:"50-100K/day",r:0},{t:"Standard",a:5031,s:0,sp:"10-100K/day",r:0}]},
{n:"Instagram Reach + Impressions",p:"Instagram",y:"engagement",t:[{t:"Standard",a:5030,s:0,sp:"Fast",r:0},{t:"Premium",a:2959,s:0,sp:"Fast",r:0}]},
{n:"Instagram Auto Views (Reels)",p:"Instagram",y:"views",t:[{t:"Standard",a:6228,s:0,sp:"100-200K/day",r:0}]},
{n:"Instagram Auto Saves",p:"Instagram",y:"engagement",t:[{t:"Standard",a:6231,s:0,sp:"100-500/day",r:0}]},
{n:"Instagram Auto Reach + Profile Visit",p:"Instagram",y:"engagement",t:[{t:"Standard",a:6230,s:0,sp:"50-100K/day",r:0}]},

{n:"Instagram Custom Comments",p:"Instagram",y:"comments",t:[{t:"Standard",a:2953,s:0,sp:"500-2K/day",r:0},{t:"Premium",a:2517,s:0,sp:"100-500/day",r:0}]},
{n:"Instagram Random Comments",p:"Instagram",y:"comments",t:[{t:"Budget",a:2951,s:0,sp:"500-2K/day",r:0},{t:"Standard",a:5709,s:0,sp:"1-5K/day",r:0}]},
{n:"Instagram Emoji Comments",p:"Instagram",y:"comments",t:[{t:"Budget",a:5710,s:0,sp:"1-5K/day",r:0}]},
// ─── TIKTOK (9) ───
{n:"TikTok Video Views",p:"TikTok",y:"views",t:[{t:"Budget",a:9349,s:0,sp:"500-1M/day",r:1},{t:"Standard",a:2026,s:0,sp:"5-50K/day",r:0},{t:"Premium",a:1130,s:0,sp:"50-500K/day",r:1}]},
{n:"TikTok Likes",p:"TikTok",y:"likes",t:[{t:"Budget",a:1128,s:0,sp:"5-50K/day",r:0},{t:"Standard",a:1126,s:0,sp:"5-50K/day",r:1},{t:"Premium",a:1106,s:0,sp:"5-50K/day",r:1}]},
{n:"TikTok Likes — USA 🇺🇸",p:"TikTok",y:"likes",t:[{t:"Standard",a:1111,s:0,sp:"500-1K/day",r:1},{t:"Premium",a:4862,s:0,sp:"50K/day",r:1}]},
{n:"TikTok Saves",p:"TikTok",y:"engagement",t:[{t:"Budget",a:5025,s:0,sp:"50-100K/day",r:0},{t:"Standard",a:5827,s:0,sp:"100-200K/day",r:1},{t:"Premium",a:1116,s:0,sp:"50-100K/day",r:1}]},
{n:"TikTok Shares",p:"TikTok",y:"engagement",t:[{t:"Budget",a:5026,s:0,sp:"10-50K/day",r:0},{t:"Standard",a:1117,s:0,sp:"10-50K/day",r:1}]},
{n:"TikTok Followers",p:"TikTok",y:"followers",t:[{t:"Standard",a:2594,s:0,sp:"500-2K/day",r:0}]},
{n:"TikTok Live Stream Likes",p:"TikTok",y:"likes",t:[{t:"Budget",a:8894,s:0,sp:"Natural",r:0},{t:"Standard",a:8893,s:0,sp:"Fast",r:0}]},
{n:"TikTok Likes + Views",p:"TikTok",y:"likes",t:[{t:"Standard",a:8118,s:0,sp:"5-10K/day",r:1},{t:"Premium",a:8849,s:0,sp:"10-20K/day",r:1}]},
{n:"TikTok PK Battle Points",p:"TikTok",y:"engagement",t:[{t:"Standard",a:5159,s:0,sp:"50-100K/day",r:0}]},

{n:"TikTok Custom Comments",p:"TikTok",y:"comments",t:[{t:"Standard",a:5160,s:0,sp:"500-2K/day",r:0},{t:"Premium",a:5161,s:0,sp:"100-500/day",r:0}]},
{n:"TikTok Random Comments",p:"TikTok",y:"comments",t:[{t:"Budget",a:5162,s:0,sp:"1-5K/day",r:0}]},
// ─── YOUTUBE (8) ───
{n:"YouTube Views",p:"YouTube",y:"views",t:[{t:"Standard",a:1573,s:0,sp:"100-500/day",r:1}]},
{n:"YouTube Likes",p:"YouTube",y:"likes",t:[{t:"Budget",a:935,s:0,sp:"10-100K/day",r:0},{t:"Standard",a:918,s:0,sp:"5-10K/day",r:1},{t:"Premium",a:6233,s:0,sp:"10-20K/day",r:1}]},
{n:"YouTube Shorts Likes",p:"YouTube",y:"likes",t:[{t:"Standard",a:6234,s:0,sp:"10-20K/day",r:1},{t:"Premium",a:6235,s:0,sp:"10-20K/day",r:1}]},
{n:"YouTube Live Stream Likes",p:"YouTube",y:"likes",t:[{t:"Standard",a:6236,s:0,sp:"10-20K/day",r:1},{t:"Premium",a:6237,s:0,sp:"10-20K/day",r:1}]},
{n:"YouTube Subscribers",p:"YouTube",y:"followers",t:[{t:"Budget",a:2386,s:0,sp:"10-50K/day",r:0}]},
{n:"YouTube Comment Likes",p:"YouTube",y:"engagement",t:[{t:"Standard",a:912,s:0,sp:"5-10K/day",r:1}]},
{n:"YouTube Live Stream Views",p:"YouTube",y:"views",t:[{t:"Budget",a:1547,s:0,sp:"15 min",r:0},{t:"Standard",a:1548,s:0,sp:"30 min",r:0},{t:"Premium",a:1549,s:0,sp:"60 min",r:0}]},
{n:"YouTube Watch Time (60K min)",p:"YouTube",y:"views",t:[{t:"Premium",a:7292,s:0,sp:"Fast",r:1}]},
// ─── TWITTER/X (11) ───
{n:"X/Twitter Tweet Views",p:"Twitter/X",y:"views",t:[{t:"Budget",a:981,s:0,sp:"100-500K/day",r:0},{t:"Standard",a:2990,s:0,sp:"100-200K/day",r:0}]},
{n:"X/Twitter Tweet Views — Last 5 Posts",p:"Twitter/X",y:"views",t:[{t:"Standard",a:8160,s:0,sp:"500-1M/day",r:0}]},
{n:"X/Twitter Tweet Views — Last 10 Posts",p:"Twitter/X",y:"views",t:[{t:"Standard",a:8161,s:0,sp:"500-1M/day",r:0}]},
{n:"X/Twitter Video Views (USA)",p:"Twitter/X",y:"views",t:[{t:"Standard",a:350,s:0,sp:"Fast",r:0}]},
{n:"X/Twitter Followers",p:"Twitter/X",y:"followers",t:[{t:"Budget",a:2594,s:0,sp:"500-2K/day",r:0},{t:"Standard",a:5125,s:0,sp:"1-5K/day",r:0},{t:"Premium",a:8354,s:0,sp:"1-5K/day",r:1}]},
{n:"X/Twitter Followers — USA 🇺🇸",p:"Twitter/X",y:"followers",t:[{t:"Standard",a:4786,s:0,sp:"1-5K/day",r:0},{t:"Premium",a:9115,s:0,sp:"1-5K/day",r:1}]},
{n:"X/Twitter Likes",p:"Twitter/X",y:"likes",t:[{t:"Budget",a:3663,s:0,sp:"500-1K/day",r:0},{t:"Standard",a:3661,s:0,sp:"500-1K/day",r:1},{t:"Premium",a:5802,s:0,sp:"500-1K/day",r:1}]},
{n:"X/Twitter Retweets",p:"Twitter/X",y:"engagement",t:[{t:"Budget",a:1604,s:0,sp:"500-1K/day",r:0},{t:"Standard",a:3308,s:0,sp:"500-1K/day",r:1}]},
{n:"X/Twitter Bookmarks",p:"Twitter/X",y:"engagement",t:[{t:"Standard",a:7484,s:0,sp:"5-10K/day",r:0},{t:"Premium",a:7483,s:0,sp:"5-10K/day",r:1}]},
{n:"X/Twitter Poll Votes",p:"Twitter/X",y:"engagement",t:[{t:"Budget",a:2994,s:0,sp:"20K/day",r:1},{t:"Standard",a:1606,s:0,sp:"200K/day",r:1}]},
{n:"X/Twitter Impressions",p:"Twitter/X",y:"engagement",t:[{t:"Standard",a:4033,s:0,sp:"5-10K/day",r:0}]},

{n:"YouTube Custom Comments",p:"YouTube",y:"comments",t:[{t:"Standard",a:911,s:0,sp:"100-500/day",r:0},{t:"Premium",a:2080,s:0,sp:"50-200/day",r:0}]},
{n:"YouTube Random Comments",p:"YouTube",y:"comments",t:[{t:"Budget",a:913,s:0,sp:"500-2K/day",r:0}]},
// ─── FACEBOOK (11) ───
{n:"Facebook Video Views",p:"Facebook",y:"views",t:[{t:"Budget",a:680,s:0,sp:"20-30K/day",r:1},{t:"Standard",a:7654,s:0,sp:"5-15K/day",r:1},{t:"Premium",a:6336,s:0,sp:"50-100K/day",r:1}]},
{n:"Facebook Reel Views",p:"Facebook",y:"views",t:[{t:"Standard",a:6337,s:0,sp:"20-30K/day",r:1},{t:"Premium",a:6339,s:0,sp:"50-100K/day",r:1}]},
{n:"Facebook Page Followers",p:"Facebook",y:"followers",t:[{t:"Budget",a:4138,s:0,sp:"1-5K/day",r:0},{t:"Standard",a:9028,s:0,sp:"5-15K/day",r:1},{t:"Premium",a:9058,s:0,sp:"5-10K/day",r:1}]},
{n:"Facebook Profile Followers",p:"Facebook",y:"followers",t:[{t:"Standard",a:9342,s:0,sp:"5-50K/day",r:1},{t:"Premium",a:9042,s:0,sp:"10-30K/day",r:1}]},
{n:"Facebook Post Likes",p:"Facebook",y:"likes",t:[{t:"Budget",a:578,s:0,sp:"500-1K/day",r:0},{t:"Standard",a:5133,s:0,sp:"500-2K/day",r:1},{t:"Premium",a:5207,s:0,sp:"1-5K/day",r:1}]},
{n:"Facebook Page Likes + Followers",p:"Facebook",y:"followers",t:[{t:"Budget",a:985,s:0,sp:"1-5K/day",r:0},{t:"Standard",a:1986,s:0,sp:"1-5K/day",r:1}]},
{n:"Facebook Group Members",p:"Facebook",y:"followers",t:[{t:"Standard",a:1724,s:0,sp:"1-5K/day",r:0}]},
{n:"Facebook Post Reactions (Love ❤️)",p:"Facebook",y:"engagement",t:[{t:"Standard",a:5986,s:0,sp:"50-200/day",r:0}]},
{n:"Facebook Post Reactions (Haha 😂)",p:"Facebook",y:"engagement",t:[{t:"Standard",a:5989,s:0,sp:"50-200/day",r:0}]},
{n:"Facebook Live Stream Views",p:"Facebook",y:"views",t:[{t:"Budget",a:618,s:0,sp:"15 min",r:0},{t:"Standard",a:619,s:0,sp:"30 min",r:0}]},
{n:"Facebook Comment Likes",p:"Facebook",y:"likes",t:[{t:"Budget",a:595,s:0,sp:"1-5K/day",r:0},{t:"Standard",a:587,s:0,sp:"1-5K/day",r:1}]},

{n:"Facebook Custom Comments",p:"Facebook",y:"comments",t:[{t:"Standard",a:583,s:0,sp:"500-2K/day",r:0}]},
{n:"Facebook Random Comments",p:"Facebook",y:"comments",t:[{t:"Budget",a:584,s:0,sp:"1-5K/day",r:0}]},
// ─── TELEGRAM (8) ───
{n:"Telegram Post Views",p:"Telegram",y:"views",t:[{t:"Budget",a:4880,s:0,sp:"100-200K/day",r:0},{t:"Standard",a:2949,s:0,sp:"100-200K/day",r:0}]},
{n:"Telegram Post Views — Future Posts",p:"Telegram",y:"views",t:[{t:"Standard",a:8500,s:0,sp:"100-200K/day",r:0}]},
{n:"Telegram Channel Members",p:"Telegram",y:"followers",t:[{t:"Budget",a:1640,s:0,sp:"5-10K/day",r:0},{t:"Standard",a:1639,s:0,sp:"5-10K/day",r:1},{t:"Premium",a:2098,s:0,sp:"10-30K/day",r:1}]},
{n:"Telegram Channel Members — USA 🇺🇸",p:"Telegram",y:"followers",t:[{t:"Premium",a:2937,s:0,sp:"1-5K/day",r:0}]},
{n:"Telegram Reactions (Positive)",p:"Telegram",y:"engagement",t:[{t:"Standard",a:2737,s:0,sp:"Fast",r:0}]},
{n:"Telegram Reactions (❤️)",p:"Telegram",y:"engagement",t:[{t:"Standard",a:7680,s:0,sp:"Fast",r:0}]},
{n:"Telegram Reactions (🔥)",p:"Telegram",y:"engagement",t:[{t:"Standard",a:7681,s:0,sp:"Fast",r:0}]},
{n:"Telegram Premium Members",p:"Telegram",y:"followers",t:[{t:"Premium",a:3521,s:0,sp:"7 days",r:1}]},
// ─── SPOTIFY (8) ───
{n:"Spotify Plays — Global",p:"Spotify",y:"plays",t:[{t:"Standard",a:1612,s:0,sp:"20-30K/day",r:1}]},
{n:"Spotify Plays — USA",p:"Spotify",y:"plays",t:[{t:"Premium",a:2482,s:0,sp:"20-30K/day",r:1}]},
{n:"Spotify Plays — Europe",p:"Spotify",y:"plays",t:[{t:"Standard",a:2024,s:0,sp:"20-30K/day",r:1}]},
{n:"Spotify Plays — Asia",p:"Spotify",y:"plays",t:[{t:"Standard",a:2025,s:0,sp:"20-30K/day",r:1}]},
{n:"Spotify Followers",p:"Spotify",y:"followers",t:[{t:"Standard",a:1981,s:0,sp:"100K-2M/day",r:1}]},
{n:"Spotify Followers — Nigeria 🇳🇬",p:"Spotify",y:"followers",ng:1,t:[{t:"Standard",a:4453,s:0,sp:"1M/day",r:1}]},
{n:"Spotify Followers — USA",p:"Spotify",y:"followers",t:[{t:"Premium",a:2720,s:0,sp:"1M/day",r:1}]},
{n:"Spotify Followers — UK",p:"Spotify",y:"followers",t:[{t:"Premium",a:2719,s:0,sp:"1M/day",r:1}]},
// ─── SNAPCHAT (5) ───
{n:"Snapchat Followers",p:"Snapchat",y:"followers",t:[{t:"Budget",a:8384,s:0,sp:"50-200/day",r:0},{t:"Standard",a:8385,s:0,sp:"500-1K/day",r:1},{t:"Premium",a:8386,s:0,sp:"500-1K/day",r:1}]},
{n:"Snapchat Likes",p:"Snapchat",y:"likes",t:[{t:"Budget",a:8387,s:0,sp:"100-200/day",r:0},{t:"Standard",a:8388,s:0,sp:"500-1K/day",r:1},{t:"Premium",a:8389,s:0,sp:"500-1K/day",r:1}]},
{n:"Snapchat Story Views",p:"Snapchat",y:"views",t:[{t:"Standard",a:8393,s:0,sp:"500-1K/day",r:0},{t:"Premium",a:8394,s:0,sp:"500-1K/day",r:0}]},
{n:"Snapchat Video Likes",p:"Snapchat",y:"likes",t:[{t:"Standard",a:7334,s:0,sp:"500-2K/day",r:0}]},
{n:"Snapchat Friend Requests",p:"Snapchat",y:"followers",t:[{t:"Standard",a:7333,s:0,sp:"500-2K/day",r:0}]},
// ─── LINKEDIN (6) ───
{n:"LinkedIn Post Likes",p:"LinkedIn",y:"likes",t:[{t:"Standard",a:5472,s:0,sp:"500-2K/day",r:0},{t:"Premium",a:9417,s:0,sp:"200-500/day",r:1}]},
{n:"LinkedIn Profile Followers",p:"LinkedIn",y:"followers",t:[{t:"Standard",a:5466,s:0,sp:"100-500/day",r:0},{t:"Premium",a:9109,s:0,sp:"250-1K/day",r:1}]},
{n:"LinkedIn Company Followers",p:"LinkedIn",y:"followers",t:[{t:"Standard",a:5467,s:0,sp:"100-500/day",r:0},{t:"Premium",a:9110,s:0,sp:"250-1K/day",r:1}]},
{n:"LinkedIn Connections",p:"LinkedIn",y:"followers",t:[{t:"Standard",a:5471,s:0,sp:"500-2K/day",r:0},{t:"Premium",a:9418,s:0,sp:"200-500/day",r:1}]},
{n:"LinkedIn Post Share",p:"LinkedIn",y:"engagement",t:[{t:"Standard",a:5473,s:0,sp:"500-2K/day",r:0}]},
{n:"LinkedIn Group Members",p:"LinkedIn",y:"followers",t:[{t:"Standard",a:5468,s:0,sp:"100-500/day",r:0}]},
// ─── THREADS (3) ───
{n:"Threads Likes",p:"Threads",y:"likes",t:[{t:"Standard",a:2776,s:0,sp:"200-1K/day",r:0}]},
{n:"Threads Followers",p:"Threads",y:"followers",t:[{t:"Standard",a:2775,s:0,sp:"200-1K/day",r:0}]},
{n:"Threads Reposts",p:"Threads",y:"engagement",t:[{t:"Standard",a:2461,s:0,sp:"200-1K/day",r:0}]},
// ─── AUDIOMACK (6) ───
{n:"Audiomack Plays",p:"Audiomack",y:"plays",t:[{t:"Standard",a:310,s:0,sp:"Fast",r:0},{t:"Premium",a:2095,s:0,sp:"1M/day",r:1}]},
{n:"Audiomack Album Plays",p:"Audiomack",y:"plays",t:[{t:"Standard",a:311,s:0,sp:"Fast",r:0}]},
{n:"Audiomack Followers",p:"Audiomack",y:"followers",t:[{t:"Standard",a:306,s:0,sp:"Fast",r:0}]},
{n:"Audiomack Likes",p:"Audiomack",y:"likes",t:[{t:"Standard",a:307,s:0,sp:"Fast",r:0}]},
{n:"Audiomack Streams — Nigeria 🇳🇬",p:"Audiomack",y:"plays",ng:1,t:[{t:"Premium",a:320,s:0,sp:"1M/day",r:0}]},
{n:"Audiomack Streams — Ghana 🇬🇭",p:"Audiomack",y:"plays",t:[{t:"Premium",a:321,s:0,sp:"1M/day",r:0}]},
// ─── BOOMPLAY (4) ───
{n:"Boomplay Streams",p:"Boomplay",y:"plays",t:[{t:"Standard",a:1712,s:0,sp:"1-12 hrs",r:0}]},
{n:"Boomplay Streams — Nigeria 🇳🇬",p:"Boomplay",y:"plays",ng:1,t:[{t:"Standard",a:1714,s:0,sp:"1-12 hrs",r:0}]},
{n:"Boomplay Streams — Ghana 🇬🇭",p:"Boomplay",y:"plays",t:[{t:"Standard",a:1715,s:0,sp:"1-12 hrs",r:0}]},
{n:"Boomplay Followers",p:"Boomplay",y:"followers",t:[{t:"Standard",a:1719,s:0,sp:"200/day",r:0}]},
// ─── APPLE MUSIC (2) ───
{n:"Apple Music Plays — Global",p:"Apple Music",y:"plays",t:[{t:"Standard",a:4549,s:0,sp:"250-1K/day",r:1}]},
{n:"Apple Music Plays — USA",p:"Apple Music",y:"plays",t:[{t:"Premium",a:4550,s:0,sp:"250-1K/day",r:1}]},
// ─── SOUNDCLOUD (4) ───
{n:"SoundCloud Plays",p:"SoundCloud",y:"plays",t:[{t:"Standard",a:2197,s:0,sp:"100-500/day",r:1}]},
{n:"SoundCloud Followers",p:"SoundCloud",y:"followers",t:[{t:"Standard",a:2198,s:0,sp:"200-500/day",r:1}]},
{n:"SoundCloud Likes",p:"SoundCloud",y:"likes",t:[{t:"Standard",a:2205,s:0,sp:"100-500/day",r:1}]},
{n:"SoundCloud Reposts",p:"SoundCloud",y:"engagement",t:[{t:"Standard",a:2207,s:0,sp:"100-500/day",r:1}]},
// ─── DEEZER (2) ───
{n:"Deezer Followers",p:"Deezer",y:"followers",t:[{t:"Standard",a:293,s:0,sp:"100K/day",r:1}]},
{n:"Deezer Likes",p:"Deezer",y:"likes",t:[{t:"Standard",a:294,s:0,sp:"100K/day",r:1}]},
// ─── SHAZAM (1) ───
{n:"Shazam Plays — USA",p:"Shazam",y:"plays",t:[{t:"Standard",a:1601,s:0,sp:"100-500/day",r:0}]},
// ─── MIXCLOUD (3) ───
{n:"Mixcloud Plays",p:"Mixcloud",y:"plays",t:[{t:"Standard",a:7929,s:0,sp:"Fast",r:0}]},
{n:"Mixcloud Followers",p:"Mixcloud",y:"followers",t:[{t:"Standard",a:1598,s:0,sp:"Fast",r:0}]},
{n:"Mixcloud Likes",p:"Mixcloud",y:"likes",t:[{t:"Standard",a:1600,s:0,sp:"Fast",r:0}]},
// ─── VIMEO (1) ───
{n:"Vimeo Views",p:"Vimeo",y:"views",t:[{t:"Standard",a:794,s:0,sp:"24hrs",r:0}]},
// ─── DISCORD (4) ───
{n:"Discord Members (Offline)",p:"Discord",y:"followers",t:[{t:"Standard",a:7344,s:0,sp:"Fast",r:1},{t:"Premium",a:2892,s:0,sp:"Fast",r:1}]},
{n:"Discord Server Boost (2x, 1mo)",p:"Discord",y:"engagement",t:[{t:"Standard",a:5135,s:0,sp:"1 month",r:1}]},
{n:"Discord Server Boost (2x, 3mo)",p:"Discord",y:"engagement",t:[{t:"Premium",a:5142,s:0,sp:"3 months",r:1}]},
{n:"Discord Server Boost (4x, 1mo)",p:"Discord",y:"engagement",t:[{t:"Premium",a:5136,s:0,sp:"1 month",r:1}]},
// ─── REDDIT (5) ───
{n:"Reddit Views",p:"Reddit",y:"views",t:[{t:"Budget",a:1955,s:0,sp:"100K/day",r:1},{t:"Standard",a:8107,s:0,sp:"1-2M/day",r:0}]},
{n:"Reddit Shares",p:"Reddit",y:"engagement",t:[{t:"Standard",a:8108,s:0,sp:"1-2M/day",r:0}]},
{n:"Reddit Views — USA",p:"Reddit",y:"views",t:[{t:"Premium",a:8110,s:0,sp:"1-2M/day",r:0}]},
{n:"Reddit Views — UK",p:"Reddit",y:"views",t:[{t:"Premium",a:8111,s:0,sp:"1-2M/day",r:0}]},
{n:"Reddit Views + Shares",p:"Reddit",y:"views",t:[{t:"Standard",a:1957,s:0,sp:"100K/day",r:1}]},
// ─── PINTEREST (4) ───
{n:"Pinterest Likes",p:"Pinterest",y:"likes",t:[{t:"Standard",a:2913,s:0,sp:"100-1K/day",r:0},{t:"Premium",a:5511,s:0,sp:"250-500/day",r:0}]},
{n:"Pinterest Followers",p:"Pinterest",y:"followers",t:[{t:"Standard",a:2922,s:0,sp:"1-2K/day",r:0}]},
{n:"Pinterest Saves",p:"Pinterest",y:"engagement",t:[{t:"Standard",a:2912,s:0,sp:"100-1K/day",r:0}]},
{n:"Pinterest Real Followers",p:"Pinterest",y:"followers",t:[{t:"Premium",a:5287,s:0,sp:"250-500/day",r:0}]},
// ─── TUMBLR (3) ───
{n:"Tumblr Likes",p:"Tumblr",y:"likes",t:[{t:"Standard",a:7976,s:0,sp:"50-200/day",r:0}]},
{n:"Tumblr Reblogs",p:"Tumblr",y:"engagement",t:[{t:"Standard",a:7977,s:0,sp:"50-200/day",r:0}]},
{n:"Tumblr Followers",p:"Tumblr",y:"followers",t:[{t:"Premium",a:7975,s:0,sp:"50-200/day",r:0}]},
// ─── KICK (4) ───
{n:"Kick Clip Views",p:"Kick",y:"views",t:[{t:"Standard",a:7512,s:0,sp:"10-50K/day",r:0}]},
{n:"Kick Video Views",p:"Kick",y:"views",t:[{t:"Standard",a:8050,s:0,sp:"10-50K/day",r:0}]},
{n:"Kick Followers",p:"Kick",y:"followers",t:[{t:"Standard",a:7265,s:0,sp:"1-5K/day",r:0}]},
{n:"Kick Live Viewers (1hr)",p:"Kick",y:"views",t:[{t:"Standard",a:3771,s:0,sp:"1 hour",r:0}]},
// ─── QUORA (4) ───
{n:"Quora Views",p:"Quora",y:"views",t:[{t:"Standard",a:5963,s:0,sp:"100-500K/day",r:1}]},
{n:"Quora Followers",p:"Quora",y:"followers",t:[{t:"Standard",a:8045,s:0,sp:"500-1K/day",r:1}]},
{n:"Quora Upvotes",p:"Quora",y:"engagement",t:[{t:"Standard",a:957,s:0,sp:"1-5K/day",r:1}]},
{n:"Quora Shares",p:"Quora",y:"engagement",t:[{t:"Standard",a:3604,s:0,sp:"1-5K/day",r:1}]},
// ─── WHATSAPP (1) ───
{n:"WhatsApp Channel Members",p:"WhatsApp",y:"followers",t:[{t:"Standard",a:4885,s:0,sp:"500-2K/day",r:0}]},
// ─── ONLYFANS (2) ───
{n:"OnlyFans Followers",p:"OnlyFans",y:"followers",t:[{t:"Budget",a:8402,s:0,sp:"500-1K/day",r:0},{t:"Standard",a:8403,s:0,sp:"500-1K/day",r:1},{t:"Premium",a:8404,s:0,sp:"500-1K/day",r:1}]},
{n:"OnlyFans Likes",p:"OnlyFans",y:"likes",t:[{t:"Budget",a:8405,s:0,sp:"500-1K/day",r:0},{t:"Standard",a:8406,s:0,sp:"500-1K/day",r:1}]},
// ─── TRUSTPILOT (1) ───
{n:"TrustPilot Reviews (5 Stars)",p:"TrustPilot",y:"reviews",t:[{t:"Premium",a:1616,s:0,sp:"Custom",r:1}]},
// ─── GOOGLE (1) ───
{n:"Google Review Likes",p:"Google",y:"reviews",t:[{t:"Standard",a:8653,s:0,sp:"Custom",r:0}]},
// ─── TWITCH (3) ───
{n:"Twitch Followers",p:"Twitch",y:"followers",t:[{t:"Standard",a:7789,s:0,sp:"1K/day",r:1}]},
{n:"Twitch Clip Views",p:"Twitch",y:"views",t:[{t:"Standard",a:7791,s:0,sp:"Fast",r:0}]},
{n:"Twitch Video Views",p:"Twitch",y:"views",t:[{t:"Standard",a:7790,s:0,sp:"Fast",r:0}]},
// ─── 🇳🇬 INSTAGRAM NIGERIAN (7) ───
{n:"Instagram Followers — Nigerian 🇳🇬",p:"Instagram",y:"followers",ng:1,t:[{t:"Budget",a:2716,s:0,sp:"0-24hr",r:0},{t:"Standard",a:6242,s:0,sp:"0-24hr",r:1},{t:"Premium",a:5381,s:0,sp:"0-24hr",r:1}]},
{n:"Instagram Likes — Nigerian 🇳🇬",p:"Instagram",y:"likes",ng:1,t:[{t:"Standard",a:2731,s:0,sp:"0-24hr",r:0}]},
{n:"Instagram Comments — Nigerian 🇳🇬",p:"Instagram",y:"comments",ng:1,t:[{t:"Budget",a:2732,s:0,sp:"0-24hr",r:0},{t:"Premium",a:2733,s:0,sp:"0-24hr",r:0}]},
{n:"Instagram Saves — Nigerian 🇳🇬",p:"Instagram",y:"engagement",ng:1,t:[{t:"Standard",a:2736,s:0,sp:"0-24hr",r:0}]},
{n:"Instagram Reposts — Nigerian 🇳🇬",p:"Instagram",y:"engagement",ng:1,t:[{t:"Standard",a:2734,s:0,sp:"0-24hr",r:0}]},
{n:"Instagram Story Shares — Nigerian 🇳🇬",p:"Instagram",y:"engagement",ng:1,t:[{t:"Standard",a:2735,s:0,sp:"0-24hr",r:0}]},
{n:"Instagram Channel Members — Nigerian 🇳🇬",p:"Instagram",y:"followers",ng:1,t:[{t:"Standard",a:2293,s:0,sp:"Fast",r:0}]},
// ─── 🇳🇬 TIKTOK NIGERIAN (7) ───
{n:"TikTok Followers — Nigerian 🇳🇬",p:"TikTok",y:"followers",ng:1,t:[{t:"Budget",a:626,s:0,sp:"0-24hr",r:1},{t:"Premium",a:2748,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Likes — Nigerian 🇳🇬",p:"TikTok",y:"likes",ng:1,t:[{t:"Budget",a:627,s:0,sp:"0-24hr",r:1},{t:"Premium",a:2749,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Views — Nigerian 🇳🇬",p:"TikTok",y:"views",ng:1,t:[{t:"Standard",a:2752,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Comments — Nigerian 🇳🇬",p:"TikTok",y:"comments",ng:1,t:[{t:"Standard",a:2750,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Saves — Nigerian 🇳🇬",p:"TikTok",y:"engagement",ng:1,t:[{t:"Standard",a:2753,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Duet — Nigerian 🇳🇬",p:"TikTok",y:"engagement",ng:1,t:[{t:"Premium",a:2754,s:0,sp:"0-24hr",r:0}]},
{n:"TikTok Use Sound — Nigerian 🇳🇬",p:"TikTok",y:"engagement",ng:1,t:[{t:"Premium",a:2751,s:0,sp:"0-24hr",r:0}]},
// ─── 🇳🇬 TWITTER/X NIGERIAN (5) ───
{n:"X/Twitter Views — Nigerian 🇳🇬",p:"Twitter/X",y:"views",ng:1,t:[{t:"Budget",a:5917,s:0,sp:"Fast",r:1},{t:"Premium",a:2744,s:0,sp:"0-24hr",r:0}]},
{n:"X/Twitter Likes — Nigerian 🇳🇬",p:"Twitter/X",y:"likes",ng:1,t:[{t:"Standard",a:4512,s:0,sp:"0-24hr",r:0}]},
{n:"X/Twitter Comments — Nigerian 🇳🇬",p:"Twitter/X",y:"comments",ng:1,t:[{t:"Budget",a:2746,s:0,sp:"0-24hr",r:0},{t:"Premium",a:2747,s:0,sp:"0-24hr",r:0}]},
{n:"X/Twitter Retweets — Nigerian 🇳🇬",p:"Twitter/X",y:"engagement",ng:1,t:[{t:"Standard",a:2743,s:0,sp:"0-24hr",r:0}]},
{n:"X/Twitter Followers — Nigerian 🇳🇬",p:"Twitter/X",y:"followers",ng:1,t:[{t:"Standard",a:2742,s:0,sp:"0-24hr",r:0}]},
// ─── 🇳🇬 FACEBOOK NIGERIAN (11) ───
{n:"Facebook Followers — Nigerian 🇳🇬",p:"Facebook",y:"followers",ng:1,t:[{t:"Budget",a:2760,s:0,sp:"0-24hr",r:0},{t:"Standard",a:973,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Page Likes — Nigerian 🇳🇬",p:"Facebook",y:"likes",ng:1,t:[{t:"Budget",a:2761,s:0,sp:"0-24hr",r:0},{t:"Standard",a:948,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Post Likes — Nigerian 🇳🇬",p:"Facebook",y:"likes",ng:1,t:[{t:"Budget",a:2762,s:0,sp:"0-24hr",r:0},{t:"Standard",a:990,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Post Reactions — Nigerian 🇳🇬",p:"Facebook",y:"engagement",ng:1,t:[{t:"Standard",a:1020,s:0,sp:"0-24hr",r:1},{t:"Premium",a:1022,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Views — Nigerian 🇳🇬",p:"Facebook",y:"views",ng:1,t:[{t:"Standard",a:2768,s:0,sp:"Fast",r:0}]},
{n:"Facebook Shares — Nigerian 🇳🇬",p:"Facebook",y:"engagement",ng:1,t:[{t:"Budget",a:2763,s:0,sp:"0-24hr",r:0},{t:"Standard",a:1135,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Group Members — Nigerian 🇳🇬",p:"Facebook",y:"followers",ng:1,t:[{t:"Budget",a:2766,s:0,sp:"0-24hr",r:0},{t:"Standard",a:1009,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Comments — Nigerian 🇳🇬",p:"Facebook",y:"comments",ng:1,t:[{t:"Budget",a:1079,s:0,sp:"0-24hr",r:1},{t:"Standard",a:1080,s:0,sp:"0-24hr",r:1},{t:"Premium",a:1081,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Comment Reactions — Nigerian 🇳🇬",p:"Facebook",y:"engagement",ng:1,t:[{t:"Standard",a:1085,s:0,sp:"0-24hr",r:1}]},
{n:"Facebook Reviews — Nigerian 🇳🇬",p:"Facebook",y:"reviews",ng:1,t:[{t:"Budget",a:1115,s:0,sp:"0-24hr",r:1},{t:"Standard",a:1114,s:0,sp:"0-24hr",r:1},{t:"Premium",a:2767,s:0,sp:"0-24hr",r:0}]},
{n:"Facebook Event Interest — Nigerian 🇳🇬",p:"Facebook",y:"engagement",ng:1,t:[{t:"Standard",a:1134,s:0,sp:"0-24hr",r:1}]},
// ─── 🇳🇬 YOUTUBE NIGERIAN (4) ───
{n:"YouTube Views — Nigerian 🇳🇬",p:"YouTube",y:"views",ng:1,t:[{t:"Budget",a:2755,s:0,sp:"Fast",r:0},{t:"Standard",a:2058,s:0,sp:"70K/day",r:0}]},
{n:"YouTube Likes — Nigerian 🇳🇬",p:"YouTube",y:"likes",ng:1,t:[{t:"Budget",a:2429,s:0,sp:"100K/day",r:1},{t:"Standard",a:4205,s:0,sp:"Fast",r:0},{t:"Premium",a:2756,s:0,sp:"0-24hr",r:0}]},
{n:"YouTube Comments — Nigerian 🇳🇬",p:"YouTube",y:"comments",ng:1,t:[{t:"Budget",a:2758,s:0,sp:"0-24hr",r:0},{t:"Premium",a:2759,s:0,sp:"0-24hr",r:0}]},
{n:"YouTube Subscribers — Nigerian 🇳🇬",p:"YouTube",y:"followers",ng:1,t:[{t:"Premium",a:5376,s:0,sp:"0-24hr",r:0}]},
// ─── 🇳🇬 THREADS NIGERIAN (4) ───
{n:"Threads Followers — Nigerian 🇳🇬",p:"Threads",y:"followers",ng:1,t:[{t:"Standard",a:2737,s:0,sp:"0-24hr",r:0}]},
{n:"Threads Likes — Nigerian 🇳🇬",p:"Threads",y:"likes",ng:1,t:[{t:"Standard",a:2738,s:0,sp:"0-24hr",r:0}]},
{n:"Threads Comments — Nigerian 🇳🇬",p:"Threads",y:"comments",ng:1,t:[{t:"Standard",a:2739,s:0,sp:"0-24hr",r:0}]},
{n:"Threads Reposts — Nigerian 🇳🇬",p:"Threads",y:"engagement",ng:1,t:[{t:"Budget",a:2741,s:0,sp:"0-24hr",r:0},{t:"Standard",a:2740,s:0,sp:"0-24hr",r:0}]},
];
async function seed(){
console.log('🌱 Seeding Nitro full menu...\n');
const allApi=[...new Set(M.flatMap(g=>g.t.map(x=>x.a)))];
// Lookup by apiId — handles multi-provider (first match wins, DAO services have unique apiIds)
const svcs=await p.service.findMany({where:{apiId:{in:allApi}},select:{id:true,apiId:true,provider:true}});
const m={};svcs.forEach(s=>{if(!m[s.apiId])m[s.apiId]=s.id;});
const miss=allApi.filter(id=>!m[id]);
if(miss.length)console.log('⚠️  Missing apiIds:',miss.join(', '),'\n');
await p.serviceTier.deleteMany();await p.serviceGroup.deleteMany();
console.log('🗑️  Cleared existing menu\n');
let gc=0,tc=0,sk=0,ngc=0;
for(let i=0;i<M.length;i++){const g=M[i];
const grp=await p.serviceGroup.create({data:{name:g.n,platform:g.p,type:g.y||'Standard',nigerian:!!g.ng,enabled:true,sortOrder:i+1}});gc++;if(g.ng)ngc++;
for(let j=0;j<g.t.length;j++){const x=g.t[j];const sid=m[x.a];
if(!sid){console.log('   ⏭️  Skip:',g.n,'→',x.t,'(apiId',x.a,'missing)');sk++;continue;}
await p.serviceTier.create({data:{groupId:grp.id,serviceId:sid,tier:x.t,sellPer1k:x.s,refill:!!x.r,speed:x.sp,enabled:true,sortOrder:j+1}});tc++;}
console.log('   ✅',g.p,'→',g.n,'('+g.t.length+' tiers)'+(g.ng?' 🇳🇬':''));}
const plats=[...new Set(M.map(g=>g.p))];
console.log('\n🎉 Done!',gc,'groups,',tc,'tiers,',sk,'skipped');
console.log('🇳🇬',ngc,'Nigerian groups');
console.log('📊',plats.length,'platforms:',plats.join(', '));
}
seed().catch(e=>{console.error('❌',e.message);}).finally(()=>p.$disconnect());
