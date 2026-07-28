import "server-only";

export type RelatedJobResult = {
  title: string;
  company: string;
  location: string;
  platform: string;
  url: string;
  postedAt: string | null;
  reason: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickHtml(block: string, pattern: RegExp) {
  const match = block.match(pattern);
  return match ? decodeHtml(match[1].replace(/<[^>]+>/g, "")) : "";
}

export function parseLinkedInJobs(html: string): RelatedJobResult[] {
  return html
    .split('class="base-card')
    .slice(1)
    .map((block) => {
      const url = decodeHtml(block.match(/href="([^"]+)"/)?.[1] ?? "").split("?")[0];
      const title = pickHtml(block, /base-search-card__title[^>]*>([\s\S]*?)<\/h3>/);
      const company = pickHtml(
        block,
        /base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/,
      );
      const location = pickHtml(
        block,
        /job-search-card__location[^>]*>([\s\S]*?)<\/span>/,
      );
      const postedAt = block.match(/datetime="([^"]+)"/)?.[1] ?? null;

      return {
        title,
        company,
        location,
        platform: "LinkedIn",
        url,
        postedAt,
        reason: "",
      };
    })
    .filter((job) => job.title && job.company && job.location && job.url.startsWith("https://"))
    .slice(0, 15);
}

export async function fetchLinkedInJobs(query: string, location: string) {
  const params = new URLSearchParams({
    keywords: query,
    location: location || "Vietnam",
    start: "0",
  });
  const res = await fetch(
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 CareerLens job finder",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return [];
  return parseLinkedInJobs(await res.text());
}
