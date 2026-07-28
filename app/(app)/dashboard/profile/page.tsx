import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

import { ProfileForm } from "./_components/profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("metadataTitle") };
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function ProfilePage() {
  const [viewer, t] = await Promise.all([
    requireViewer(),
    getTranslations("Profile"),
  ]);
  if (viewer.actor.kind !== "user") redirect("/dashboard");

  const [profile] = await getDb()
    .select({
      birthDate: users.birthDate,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.id, viewer.actor.userId))
    .limit(1);
  if (!profile) redirect("/login");

  const [birthYear, birthMonth, birthDay] = profile.birthDate
    .split("-")
    .map(Number);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <Avatar size="lg">
              <AvatarFallback>{initialsFor(profile.fullName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="pt-2">{profile.fullName}</CardTitle>
            <CardDescription className="break-all">{profile.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("summary")}
            </p>
          </CardContent>
        </Card>

        <ProfileForm
          currentYear={new Date().getUTCFullYear()}
          profile={{
            birthDay,
            birthMonth,
            birthYear,
            email: profile.email,
            fullName: profile.fullName,
          }}
        />
      </div>
    </section>
  );
}
