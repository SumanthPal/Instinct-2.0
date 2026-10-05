export function extractQuotedContent(str) {
  if (!str) return "";
  const matches = String(str).match(/"([^"]*)"/g);
  return matches ? matches.map((m) => m.slice(1, -1)).join(" ") : str;
}

export function formatDate(date) {
  if (!date) return "";
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
  );
  return normalizedDate.toISOString().split("T")[0];
}

export function getPostDate(item, type = "post") {
  if (!item) return null;
  try {
    if (type === "event") {
      const raw = item.date || item.parsed?.Date;
      if (!raw) return null;
      const dateObj = new Date(raw);
      return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    }
    if (item.posted) {
      const dateObj = new Date(item.posted);
      return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    }
  } catch (e) {
    console.error("Failed to parse date for", type, item, e);
  }
  return null;
}

export function getItemsForDate(items, date, type = "post") {
  const dateStr = formatDate(date);
  return (items || []).filter((item) => {
    const itemDate = getPostDate(item, type);
    return itemDate && formatDate(itemDate) === dateStr;
  });
}

export function hasItemsOnDate(items, date, type = "post") {
  const dateStr = formatDate(date);
  return (items || []).some((item) => {
    const itemDate = getPostDate(item, type);
    return itemDate && formatDate(itemDate) === dateStr;
  });
}

export function calculateActivityScore(clubPosts, followers = 0) {
  if (!clubPosts || clubPosts.length === 0) {
    return { level: null, score: 0, label: "No Activity Data" };
  }

  const posts = clubPosts.slice(0, 9);
  const postDates = posts
    .map((p) => (p.posted ? new Date(p.posted) : null))
    .filter((d) => d !== null)
    .sort((a, b) => b - a);

  if (postDates.length < 2) {
    return { level: null, score: 0, label: "Insufficient Data" };
  }

  const daysSinceLastPost = Math.floor(
    (new Date() - postDates[0]) / (1000 * 60 * 60 * 24),
  );
  let recencyScore = 0;
  if (daysSinceLastPost < 7) recencyScore = 100;
  else if (daysSinceLastPost < 14) recencyScore = 80;
  else if (daysSinceLastPost < 30) recencyScore = 60;
  else if (daysSinceLastPost < 60) recencyScore = 40;
  else if (daysSinceLastPost < 90) recencyScore = 20;

  let totalInterval = 0;
  for (let i = 0; i < postDates.length - 1; i++) {
    totalInterval += (postDates[i] - postDates[i + 1]) / (1000 * 60 * 60 * 24);
  }
  const avgInterval = totalInterval / (postDates.length - 1);
  let frequencyScore = 0;
  if (avgInterval < 7) frequencyScore = 100;
  else if (avgInterval < 14) frequencyScore = 80;
  else if (avgInterval < 30) frequencyScore = 60;
  else if (avgInterval < 60) frequencyScore = 40;
  else frequencyScore = 20;

  let engagementScore = 0;
  if (followers > 2000) engagementScore = 100;
  else if (followers > 1000) engagementScore = 80;
  else if (followers > 500) engagementScore = 60;
  else if (followers > 100) engagementScore = 40;
  else engagementScore = 20;

  const finalScore =
    recencyScore * 0.4 + frequencyScore * 0.4 + engagementScore * 0.2;

  let level = "very-low";
  let label = "Quiet";
  if (finalScore >= 80) {
    level = "very-high";
    label = "Very Active";
  } else if (finalScore >= 65) {
    level = "high";
    label = "Active";
  } else if (finalScore >= 45) {
    level = "medium";
    label = "Moderate";
  } else if (finalScore >= 25) {
    level = "low";
    label = "Occasional";
  }

  return { level, score: Math.round(finalScore), label };
}

export function clubAvatarUrl(clubData) {
  return (
    clubData?.profile_image_url ||
    clubData?.profile_image_path ||
    clubData?.profile_pic ||
    null
  );
}

export function categoryNames(categories) {
  if (!Array.isArray(categories)) return [];
  return categories
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
}
