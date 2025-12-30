import React, { useState } from "react";
import { supabase } from "../utils/supabaseClient"; // adapte si ton chemin diffère

export default function SupabaseDev() {
  const [log, setLog] = useState<string>("");

  const append = (msg: string) => setLog((prev) => prev + msg + "\n");

  async function signUpOrSignIn() {
    try {
      const email = "demo@atlas.local";
      const password = "ChangeMe_12345!";

      append("Trying signIn...");
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        append("signIn failed, trying signUp...");
        const signUp = await supabase.auth.signUp({ email, password });
        if (signUp.error) throw signUp.error;

        append("signUp OK, trying signIn again...");
        const signIn2 = await supabase.auth.signInWithPassword({ email, password });
        if (signIn2.error) throw signIn2.error;

        data = signIn2.data;
      }

      append(`AUTH OK user.id=${data?.user?.id}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
      console.error(e);
    }
  }

  async function createInterventionAndLogEvent() {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!authData.user) throw new Error("Not authenticated");

      const userId = authData.user.id;

      append("Creating intervention...");
      const { data: created, error: createErr } = await supabase
        .from("interventions")
        .insert({ title: "Intervention test ATLAS", created_by: userId })
        .select("id")
        .single();

      if (createErr) throw createErr;
      const interventionId = created.id as string;
      append(`Intervention created id=${interventionId}`);

      append("Bootstrapping membership owner...");
      const { error: memberErr } = await supabase.from("intervention_members").insert({
        intervention_id: interventionId,
        user_id: userId,
        role: "owner",
        command_level: "group",
      });
      if (memberErr) throw memberErr;

      append("Inserting validated event...");
      const { error: eventErr } = await supabase.from("intervention_events").insert({
        intervention_id: interventionId,
        user_id: userId,
        event_type: "NOTE_VALIDATED",
        payload: {
          schema_version: 1,
          data: { text: "Reconnaissance en cours, fumées denses." },
          metrics: { duration_ms: 42000, edit_count: 7, source: "keyboard" },
        },
        client_recorded_at: new Date().toISOString(),
        is_validated: true,
      });
      if (eventErr) throw eventErr;

      append("OK: event inserted");
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
      console.error(e);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Supabase Dev</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={signUpOrSignIn}>1) SignUp / SignIn</button>
        <button onClick={createInterventionAndLogEvent}>2) Create + Log event</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {log || "No logs yet"}
      </pre>
    </div>
  );
}
