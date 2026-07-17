export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      backup_logs: {
        Row: {
          created_at: string
          date: string
          db_size_bytes: number | null
          db_status: string
          id: string
          log_message: string | null
          r2_files_count: number | null
          r2_size_bytes: number | null
          r2_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          db_size_bytes?: number | null
          db_status: string
          id?: string
          log_message?: string | null
          r2_files_count?: number | null
          r2_size_bytes?: number | null
          r2_status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          db_size_bytes?: number | null
          db_status?: string
          id?: string
          log_message?: string | null
          r2_files_count?: number | null
          r2_size_bytes?: number | null
          r2_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          asset: string
          created_at: string
          daily_bias: Database["public"]["Enums"]["bias_type"]
          daily_correct: boolean
          daily_img: string | null
          date: string
          h4: Json
          id: string
          monthly_bias: Database["public"]["Enums"]["bias_type"] | null
          monthly_correct: boolean | null
          monthly_img: string | null
          notes: string | null
          updated_at: string
          user_id: string
          weekly_bias: Database["public"]["Enums"]["bias_type"]
          weekly_correct: boolean
          weekly_img: string | null
          yearly_bias: string
          yearly_img: string | null
        }
        Insert: {
          asset: string
          created_at?: string
          daily_bias?: Database["public"]["Enums"]["bias_type"]
          daily_correct?: boolean
          daily_img?: string | null
          date: string
          h4?: Json
          id?: string
          monthly_bias?: Database["public"]["Enums"]["bias_type"] | null
          monthly_correct?: boolean | null
          monthly_img?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          weekly_bias?: Database["public"]["Enums"]["bias_type"]
          weekly_correct?: boolean
          weekly_img?: string | null
          yearly_bias?: string
          yearly_img?: string | null
        }
        Update: {
          asset?: string
          created_at?: string
          daily_bias?: Database["public"]["Enums"]["bias_type"]
          daily_correct?: boolean
          daily_img?: string | null
          date?: string
          h4?: Json
          id?: string
          monthly_bias?: Database["public"]["Enums"]["bias_type"] | null
          monthly_correct?: boolean | null
          monthly_img?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          weekly_bias?: Database["public"]["Enums"]["bias_type"]
          weekly_correct?: boolean
          weekly_img?: string | null
          yearly_bias?: string
          yearly_img?: string | null
        }
        Relationships: []
      }
      monthly_funding: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          month_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          month_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          month_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playbook_setups: {
        Row: {
          confluence_order: Json | null
          created_at: string | null
          definition: string | null
          execution_rules: Json | null
          id: string
          images: Json | null
          killzones: string | null
          lab_notes: Json | null
          market_condition: string | null
          moodle_resources: Json | null
          name: string
          setup_confluences: Json | null
          status: string | null
          timeframe: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confluence_order?: Json | null
          created_at?: string | null
          definition?: string | null
          execution_rules?: Json | null
          id?: string
          images?: Json | null
          killzones?: string | null
          lab_notes?: Json | null
          market_condition?: string | null
          moodle_resources?: Json | null
          name: string
          setup_confluences?: Json | null
          status?: string | null
          timeframe?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confluence_order?: Json | null
          created_at?: string | null
          definition?: string | null
          execution_rules?: Json | null
          id?: string
          images?: Json | null
          killzones?: string | null
          lab_notes?: Json | null
          market_condition?: string | null
          moodle_resources?: Json | null
          name?: string
          setup_confluences?: Json | null
          status?: string | null
          timeframe?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_title: string | null
          avatar_url: string | null
          current_streak: number | null
          display_name: string | null
          id: string
          last_streak_update: string | null
          longest_streak: number | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          active_title?: string | null
          avatar_url?: string | null
          current_streak?: number | null
          display_name?: string | null
          id: string
          last_streak_update?: string | null
          longest_streak?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          active_title?: string | null
          avatar_url?: string | null
          current_streak?: number | null
          display_name?: string | null
          id?: string
          last_streak_update?: string | null
          longest_streak?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      psychology_logs: {
        Row: {
          created_at: string
          date: string
          entry_rationale: string | null
          exit_assessment: string | null
          id: string
          morning_mood: string | null
          morning_notes: string | null
          post_trade_emotion: string | null
          pre_trade_emotion: string | null
          trade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          entry_rationale?: string | null
          exit_assessment?: string | null
          id?: string
          morning_mood?: string | null
          morning_notes?: string | null
          post_trade_emotion?: string | null
          pre_trade_emotion?: string | null
          trade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          entry_rationale?: string | null
          exit_assessment?: string | null
          id?: string
          morning_mood?: string | null
          morning_notes?: string | null
          post_trade_emotion?: string | null
          pre_trade_emotion?: string | null
          trade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psychology_logs_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_sync_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          path: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          path?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          path?: string | null
          status?: string | null
        }
        Relationships: []
      }
      symbols: {
        Row: {
          created_at: string
          id: string
          is_forex: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_forex?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_forex?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_temporal_history: {
        Row: {
          history_action: string
          history_id: string
          history_timestamp: string
          row_id: string
          snapshot_data: Json
          table_name: string
          user_id: string
        }
        Insert: {
          history_action: string
          history_id?: string
          history_timestamp?: string
          row_id: string
          snapshot_data: Json
          table_name: string
          user_id: string
        }
        Update: {
          history_action?: string
          history_id?: string
          history_timestamp?: string
          row_id?: string
          snapshot_data?: Json
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          created_at: string
          telegram_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          telegram_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          telegram_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          actual_rr: number
          after_img: string | null
          before_img: string | null
          bias_entry_id: string | null
          compliance_check: boolean | null
          created_at: string
          daily_img: string | null
          entry_time: string
          exit_time: string | null
          experimental_args: Json | null
          fees: number
          grade: string | null
          gross_pnl: number
          h1_img: string | null
          h4_img: string | null
          id: string
          m15_img: string | null
          m5_img: string | null
          max_rr: number
          missed_confluences: Json | null
          monthly_img: string | null
          net_pnl: number
          notes: string | null
          risk_percent: number | null
          setup_id: string | null
          side: Database["public"]["Enums"]["trade_side"]
          status: string | null
          symbol: string
          updated_at: string
          user_id: string
          weekly_img: string | null
        }
        Insert: {
          actual_rr?: number
          after_img?: string | null
          before_img?: string | null
          bias_entry_id?: string | null
          compliance_check?: boolean | null
          created_at?: string
          daily_img?: string | null
          entry_time?: string
          exit_time?: string | null
          experimental_args?: Json | null
          fees?: number
          grade?: string | null
          gross_pnl?: number
          h1_img?: string | null
          h4_img?: string | null
          id?: string
          m15_img?: string | null
          m5_img?: string | null
          max_rr?: number
          missed_confluences?: Json | null
          monthly_img?: string | null
          net_pnl?: number
          notes?: string | null
          risk_percent?: number | null
          setup_id?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          status?: string | null
          symbol: string
          updated_at?: string
          user_id: string
          weekly_img?: string | null
        }
        Update: {
          actual_rr?: number
          after_img?: string | null
          before_img?: string | null
          bias_entry_id?: string | null
          compliance_check?: boolean | null
          created_at?: string
          daily_img?: string | null
          entry_time?: string
          exit_time?: string | null
          experimental_args?: Json | null
          fees?: number
          grade?: string | null
          gross_pnl?: number
          h1_img?: string | null
          h4_img?: string | null
          id?: string
          m15_img?: string | null
          m5_img?: string | null
          max_rr?: number
          missed_confluences?: Json | null
          monthly_img?: string | null
          net_pnl?: number
          notes?: string | null
          risk_percent?: number | null
          setup_id?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          status?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
          weekly_img?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "playbook_setups"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_reviews: {
        Row: {
          action_plan: Json
          created_at: string
          environmental_reflection: string | null
          id: string
          period: string
          psychological_reflection: string | null
          technical_reflection: string | null
          top_mistakes: Json
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plan?: Json
          created_at?: string
          environmental_reflection?: string | null
          id?: string
          period: string
          psychological_reflection?: string | null
          technical_reflection?: string | null
          top_mistakes?: Json
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plan?: Json
          created_at?: string
          environmental_reflection?: string | null
          id?: string
          period?: string
          psychological_reflection?: string | null
          technical_reflection?: string | null
          top_mistakes?: Json
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          current_value: number | null
          highest_level: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achievement_key: string
          current_value?: number | null
          highest_level?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achievement_key?: string
          current_value?: number | null
          highest_level?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          asian_reminder: boolean | null
          asian_time: string | null
          created_at: string | null
          daily_reminder: boolean | null
          daily_reminder_time: string | null
          execution_schema: Json | null
          experimental_args_config: Json | null
          forex_news_currencies: string[] | null
          forex_news_impacts: string[] | null
          forex_news_reminder: boolean | null
          forex_news_time_daily: string | null
          forex_news_time_weekly: string | null
          london_reminder: boolean | null
          london_time: string | null
          ny_reminder: boolean | null
          ny_time: string | null
          primary_color: string | null
          reminder_time: string | null
          show_trade_grade: boolean | null
          telegram_chat_id: string | null
          trade_log_view: string | null
          updated_at: string | null
          user_id: string
          weekly_reminder: boolean | null
          weekly_reminder_time: string | null
        }
        Insert: {
          asian_reminder?: boolean | null
          asian_time?: string | null
          created_at?: string | null
          daily_reminder?: boolean | null
          daily_reminder_time?: string | null
          execution_schema?: Json | null
          experimental_args_config?: Json | null
          forex_news_currencies?: string[] | null
          forex_news_impacts?: string[] | null
          forex_news_reminder?: boolean | null
          forex_news_time_daily?: string | null
          forex_news_time_weekly?: string | null
          london_reminder?: boolean | null
          london_time?: string | null
          ny_reminder?: boolean | null
          ny_time?: string | null
          primary_color?: string | null
          reminder_time?: string | null
          show_trade_grade?: boolean | null
          telegram_chat_id?: string | null
          trade_log_view?: string | null
          updated_at?: string | null
          user_id: string
          weekly_reminder?: boolean | null
          weekly_reminder_time?: string | null
        }
        Update: {
          asian_reminder?: boolean | null
          asian_time?: string | null
          created_at?: string | null
          daily_reminder?: boolean | null
          daily_reminder_time?: string | null
          execution_schema?: Json | null
          experimental_args_config?: Json | null
          forex_news_currencies?: string[] | null
          forex_news_impacts?: string[] | null
          forex_news_reminder?: boolean | null
          forex_news_time_daily?: string | null
          forex_news_time_weekly?: string | null
          london_reminder?: boolean | null
          london_time?: string | null
          ny_reminder?: boolean | null
          ny_time?: string | null
          primary_color?: string | null
          reminder_time?: string | null
          show_trade_grade?: boolean | null
          telegram_chat_id?: string | null
          trade_log_view?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_reminder?: boolean | null
          weekly_reminder_time?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_streak: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      get_leaderboard_activity: { Args: { days_back?: number }; Returns: Json }
      restore_batch_system_versions: {
        Args: { batch_timestamp: string; target_table: string }
        Returns: boolean
      }
      restore_single_journal_version: {
        Args: { target_asset: string; target_date: string; version_id: string }
        Returns: boolean
      }
      restore_single_system_version: {
        Args: { version_id: string }
        Returns: boolean
      }
    }
    Enums: {
      bias_type: "bullish" | "bearish" | "consolidation"
      trade_side: "buy" | "sell"
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
    Enums: {
      bias_type: ["bullish", "bearish", "consolidation"],
      trade_side: ["buy", "sell"],
    },
  },
} as const
