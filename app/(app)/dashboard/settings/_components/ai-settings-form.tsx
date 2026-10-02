"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { validateAISettings } from "@/lib/ai/client";
import { readWorkspace, updateWorkspace, downloadFile } from "@/lib/browser-storage";

export function AISettingsForm() {
  const t = useTranslations("Settings.browser");
  const [settings, setSettings] = useState(readWorkspace().ai);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const ai = validateAISettings(settings);
      updateWorkspace(state => { state.ai = ai; state.preferences.preferredCareerModel = ai.model; });
      setError(false); setMessage(t("saved"));
    } catch (error) { setError(true); setMessage(error instanceof Error ? error.message : t("failed")); }
  }
  return <Card>
    <CardHeader><CardTitle>{t("title")}</CardTitle><CardDescription>{t("description")}</CardDescription></CardHeader>
    <CardContent><form onSubmit={save}><FieldGroup>
      <Field><FieldLabel htmlFor="ai-base-url">{t("url")}</FieldLabel><Input id="ai-base-url" type="url" required value={settings.baseUrl} onChange={event => setSettings({ ...settings, baseUrl: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor="ai-model">{t("model")}</FieldLabel><Input id="ai-model" required maxLength={120} value={settings.model} onChange={event => setSettings({ ...settings, model: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor="ai-key">{t("key")}</FieldLabel><Input id="ai-key" type="password" autoComplete="off" spellCheck={false} required value={settings.apiKey} onChange={event => setSettings({ ...settings, apiKey: event.target.value })} /></Field>
      <p className="text-sm leading-6 text-muted-foreground">{t("privacy")}</p>
      {message ? <p role={error ? "alert" : "status"} className={error ? "text-destructive" : "text-muted-foreground"}>{message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{t("save")}</Button>
        <Button type="button" variant="outline" onClick={() => {
          try { updateWorkspace(state => { state.ai.apiKey = ""; }); setSettings(current => ({ ...current, apiKey: "" })); setError(false); setMessage(t("removed")); }
          catch (error) { setError(true); setMessage(error instanceof Error ? error.message : t("failed")); }
        }}>{t("remove")}</Button>
        <Button type="button" variant="outline" onClick={() => {
          const backup = structuredClone(readWorkspace()); backup.ai.apiKey = "";
          downloadFile(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), "vinhvu-careerlen-backup.json");
        }}>{t("export")}</Button>
      </div>
    </FieldGroup></form></CardContent>
  </Card>;
}
