// Generate consistent avatar colors based on username
// Similar to how ChatGPT generates different colors for different users

const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // violet
  '#06b6d4', // cyan
];

// Simple hash function to convert string to number
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Get consistent color for a username
export function getAvatarColor(username) {
  if (!username) return AVATAR_COLORS[0];
  const hash = hashString(username);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Get initials from username
export function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
}
