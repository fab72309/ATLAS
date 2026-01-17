export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      intervention_events: {
        Row: {
          client_recorded_at: string | null
          created_at: string
          event_type: string
          id: string
          intervention_id: string
          is_validated: boolean
          logical_id: string | null
          payload: Json
          user_id: string
          validated_at: string
        }
        Insert: {
          client_recorded_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          intervention_id: string
          is_validated?: boolean
          logical_id?: string | null
          payload?: Json
          user_id: string
          validated_at?: string
        }
        Update: {
          client_recorded_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          intervention_id?: string
          is_validated?: boolean
          logical_id?: string | null
          payload?: Json
          user_id?: string
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_events_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          intervention_id: string
          max_uses: number | null
          token: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          intervention_id: string
          max_uses?: number | null
          token: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          intervention_id?: string
          max_uses?: number | null
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "intervention_invites_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_means_state: {
        Row: {
          data: Json
          intervention_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          data?: Json
          intervention_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          data?: Json
          intervention_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_means_state_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_members: {
        Row: {
          command_level: string | null
          intervention_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          command_level?: string | null
          intervention_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          command_level?: string | null
          intervention_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_members_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_telemetry: {
        Row: {
          client_batch_ended_at: string | null
          client_batch_started_at: string | null
          created_at: string
          id: string
          intervention_id: string
          payload: Json
          stream: string
          user_id: string
        }
        Insert: {
          client_batch_ended_at?: string | null
          client_batch_started_at?: string | null
          created_at?: string
          id?: string
          intervention_id: string
          payload?: Json
          stream: string
          user_id: string
        }
        Update: {
          client_batch_ended_at?: string | null
          client_batch_started_at?: string | null
          created_at?: string
          id?: string
          intervention_id?: string
          payload?: Json
          stream?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_telemetry_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          address_line1: string | null
          city: string | null
          conduite_logical_id: string | null
          created_at: string
          created_by: string
          id: string
          incident_number: string | null
          oi_logical_id: string | null
          postal_code: string | null
          status: string
          street_name: string | null
          street_number: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          conduite_logical_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          incident_number?: string | null
          oi_logical_id?: string | null
          postal_code?: string | null
          status?: string
          street_name?: string | null
          street_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          conduite_logical_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          incident_number?: string | null
          oi_logical_id?: string | null
          postal_code?: string | null
          status?: string
          street_name?: string | null
          street_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sitac_features: {
        Row: {
          created_at: string
          feature_id: string
          intervention_id: string
          lat: number
          lng: number
          props: Json
          symbol_type: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          intervention_id: string
          lat: number
          lng: number
          props?: Json
          symbol_type: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          intervention_id?: string
          lat?: number
          lng?: number
          props?: Json
          symbol_type?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitac_features_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          client_recorded_at: string | null
          created_at: string
          event_type: string
          id: string
          logical_id: string | null
          payload: Json
          user_id: string
        }
        Insert: {
          client_recorded_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          logical_id?: string | null
          payload?: Json
          user_id: string
        }
        Update: {
          client_recorded_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          logical_id?: string | null
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_invite: {
        Args: {
          p_expires_at?: string
          p_intervention_id: string
          p_max_uses?: number
        }
        Returns: {
          expires_at: string
          invite_id: string
          max_uses: number
          token: string
          uses_count: number
        }[]
      }
      is_intervention_member: { Args: { i: string }; Returns: boolean }
      is_intervention_owner_admin: { Args: { i: string }; Returns: boolean }
      join_by_token: {
        Args: { p_command_level: string; p_token: string }
        Returns: string
      }
      preview_invite: {
        Args: { p_token: string }
        Returns: {
          address_line1: string
          city: string
          incident_number: string
          intervention_id: string
          postal_code: string
          street_name: string
          street_number: string
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

