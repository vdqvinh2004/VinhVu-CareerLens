import { AVAILABLE_MODELS } from "@/lib/ai";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFollowedCareerRoadmap } from "@/lib/careerlens/roadmaps";
import type { CareerRecommendation } from "@/lib/careerlens/schemas";
import { getTranslations } from "next-intl/server";

import { AIChat } from "./ai-assistant/_components/ai-chat";

function countRoadmapTasks(recommendation: CareerRecommendation) {
  return recommendation.roadmap.reduce((count, stage) => {
    if (stage.stage_type === "learning") {
      return count + stage.subjects.length + stage.certificates.length + stage.research_and_competitions.length + stage.milestones.length;
    }
    if (stage.stage_type === "internship") {
      return count + stage.cv_preparation.length + stage.applied_knowledge.length + stage.interview_preparation.length;
    }
    return count + stage.first_90_days.length + stage.promotion_path.length;
  }, 0);
}

export default async function DashboardPage() {
  const [viewer, t] = await Promise.all([
    requirePermission(PERMISSIONS.DASHBOARD_ACCESS),
    getTranslations("Dashboard"),
  ]);
  const followedRoadmap =
    viewer.actor.kind === "user"
      ? await getFollowedCareerRoadmap(viewer.actor.userId)
      : null;
  const recommendation = followedRoadmap
    ? followedRoadmap.guidanceOutput.recommendations[followedRoadmap.selectedRecommendationIndex] ??
      followedRoadmap.guidanceOutput.recommendations[0]
    : null;
  const totalCount = recommendation ? countRoadmapTasks(recommendation) : 0;
  const completedCount = Math.min(followedRoadmap?.followProgress.length ?? 0, totalCount);
  const followedProgress =
    followedRoadmap && recommendation
      ? {
          title: recommendation.path_title,
          href: `/dashboard/careerlens?roadmap=${followedRoadmap.id}`,
          progress: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
          completedCount,
          totalCount,
        }
      : null;

  return (
    <div className="ai-workspace-surface h-[calc(100dvh-3.5rem)] overflow-hidden bg-background md:h-dvh">
      <h1 className="sr-only">{t("homeHeading")}</h1>
      <AIChat
        followedRoadmap={followedProgress}
        initialModels={AVAILABLE_MODELS}
        viewerName={viewer.displayName}
      />
    </div>
  );
}
