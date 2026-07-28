export type UserActor = {
  kind: "user";
  userId: string;
  authVersion: number;
};

export type BuiltinSuperadminActor = {
  kind: "builtin-superadmin";
  subject: "builtin:superadmin";
  credentialVersion: number;
};

export type Actor = UserActor | BuiltinSuperadminActor;

export function getActorSubject(actor: Actor) {
  return actor.kind === "user" ? actor.userId : actor.subject;
}
