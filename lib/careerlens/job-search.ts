export type RelatedJobResult = {
  title: string;
  company: string;
  location: string;
  platform: string;
  url: string;
  postedAt: string | null;
  reason: string;
};

export function jobSearchLinks(query: string, location: string): RelatedJobResult[] {
  return [{
    title: query, company: "", location, platform: "LinkedIn", postedAt: null,
    url: `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: query, location })}`,
    reason: "Open job search to view current postings. This link is not a verified vacancy.",
  }];
}
