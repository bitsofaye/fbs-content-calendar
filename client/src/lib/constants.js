// Status vocabulary from the FBS workbook dropdowns
export const STATUSES = [
  { value: 'IDEA', label: 'Idea', cls: 'bg-slate-100 text-slate-600 ring-slate-300', dot: '#94a3b8', phase: 'ideas' },
  { value: 'IN_PROGRESS', label: 'In progress', cls: 'bg-sky-50 text-sky-700 ring-sky-200', dot: '#0284c7', phase: 'production' },
  { value: 'CREATED', label: 'Created', cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200', dot: '#0891b2', phase: 'production' },
  { value: 'EDITED', label: 'Edited', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: '#4f46e5', phase: 'production' },
  { value: 'TO_EDIT', label: 'To edit', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: '#ea580c', phase: 'production' },
  { value: 'FOR_APPROVAL', label: 'For approval', cls: 'bg-amber-50 text-amber-800 ring-amber-300', dot: '#d97706', phase: 'review' },
  { value: 'REJECTED', label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200', dot: '#dc2626', phase: 'review' },
  { value: 'APPROVED', label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: '#059669', phase: 'ready' },
  { value: 'SCHEDULED', label: 'Scheduled', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: '#0d9488', phase: 'ready' },
  { value: 'ON_HOLD', label: 'On hold', cls: 'bg-stone-100 text-stone-700 ring-stone-300', dot: '#78716c', phase: 'ready' },
  { value: 'RESCHEDULE', label: 'Reschedule', cls: 'bg-yellow-50 text-yellow-800 ring-yellow-300', dot: '#ca8a04', phase: 'ready' },
  { value: 'PUBLISHED', label: 'Published', cls: 'bg-green-100 text-green-800 ring-green-300', dot: '#16a34a', phase: 'live' },
  { value: 'BOOSTED', label: 'Boosted', cls: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200', dot: '#c026d3', phase: 'live' },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

export const PHASES = [
  { id: 'ideas', label: 'Ideas', dropStatus: 'IDEA' },
  { id: 'production', label: 'Production', dropStatus: 'IN_PROGRESS' },
  { id: 'review', label: 'Review', dropStatus: 'FOR_APPROVAL' },
  { id: 'ready', label: 'Ready', dropStatus: 'APPROVED' },
  { id: 'live', label: 'Live', dropStatus: 'PUBLISHED' },
];

// Placement vocabulary from the workbook's PLATFORMS dropdown
// colors follow each platform's own app icon (Facebook blue, Instagram pink, LinkedIn blue,
// YouTube red, TikTok black; Stories use Instagram's purple)
export const PLACEMENTS = [
  { value: 'FB_POST', label: 'Facebook Post', short: 'FB', color: '#1877f2' },
  { value: 'IG_POST', label: 'Instagram Post', short: 'IG', color: '#e1306c' },
  { value: 'LINKEDIN_POST', label: 'LinkedIn Post', short: 'in', color: '#0a66c2' },
  { value: 'FB_REELS', label: 'Facebook Reels', short: 'FBR', color: '#1877f2' },
  { value: 'IG_REELS', label: 'Instagram Reels', short: 'IGR', color: '#e1306c' },
  { value: 'YT_SHORTS', label: 'YouTube Shorts', short: 'YTS', color: '#ff0000' },
  { value: 'YT_CLIPS', label: 'YouTube Clips', short: 'YTC', color: '#ff0000' },
  { value: 'YT_VIDEO', label: 'YouTube Video', short: 'YT', color: '#ff0000' },
  { value: 'TIKTOK', label: 'TikTok', short: 'TT', color: '#000000' },
  { value: 'STORY', label: 'Story', short: 'ST', color: '#833ab4' },
];
export const PLACEMENT = Object.fromEntries(PLACEMENTS.map((p) => [p.value, p]));

export const BOOSTS = [
  { value: 'ORGANIC', label: 'Organic' },
  { value: 'PAID', label: 'Paid' },
  { value: 'BOOSTED', label: 'Boosted' },
];

export const FEEDBACK = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'BAD', label: 'Bad' },
];

export const FORMATS = ['Graphic', 'Carousel', 'Infographic', 'Short Video', 'Video', 'Reel', 'Testimonial Write-up', 'Text', 'Canva Graphics'];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Statuses a client reviewer can act on
export const REVIEWABLE = ['FOR_APPROVAL', 'TO_EDIT', 'REJECTED', 'EDITED', 'CREATED', 'IN_PROGRESS', 'APPROVED', 'SCHEDULED', 'ON_HOLD', 'RESCHEDULE'];
