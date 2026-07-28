import { describe, expect, it } from "vitest";

import { parseLinkedInJobs } from "@/lib/careerlens/job-search";

describe("CareerLens live job search", () => {
  it("parses LinkedIn public job cards into direct platform links", () => {
    const html = `
      <div class="base-card job-search-card">
        <a class="base-card__full-link" href="https://vn.linkedin.com/jobs/view/data-analyst-at-example-123?position=1&amp;pageNum=0">
          <span class="sr-only">Data Analyst</span>
        </a>
        <h3 class="base-search-card__title">Data Analyst</h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://www.linkedin.com/company/example">Example &amp; Co</a>
        </h4>
        <span class="job-search-card__location">Ho Chi Minh City, Vietnam</span>
        <time class="job-search-card__listdate" datetime="2026-07-18"></time>
      </div>
    `;

    expect(parseLinkedInJobs(html)).toEqual([
      {
        title: "Data Analyst",
        company: "Example & Co",
        location: "Ho Chi Minh City, Vietnam",
        platform: "LinkedIn",
        url: "https://vn.linkedin.com/jobs/view/data-analyst-at-example-123",
        postedAt: "2026-07-18",
        reason: "",
      },
    ]);
  });
});
