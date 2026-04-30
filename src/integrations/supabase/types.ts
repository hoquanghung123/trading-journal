export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      journal_entries: {
        Row: {
          asset: string;
          created_at: string;
          daily_bias: Database["public"]["Enums"]["bias_type"];
          daily_correct: boolean;
          daily_img: string | null;
          date: string;
          h4: Json;
          id: string;
          monthly_bias: Database["public"]["Enums"]["bias_type"] | null;
          monthly_correct: boolean | null;
          monthly_img: string | null;
          notes: string | null;
          updated_at: string;
          user_id: string;
          weekly_bias: Database["public"]["Enums"]["bias_type"];
          weekly_correct: boolean;
          weekly_img: string | null;
          yearly_bias: string;
          yearly_img: string | null;
        };
        Insert: {
          asset: string;
          created_at?: string;
          daily_bias?: Database["public"]["Enums"]["bias_type"];
          daily_correct?: boolean;
          daily_img?: string | null;
          date: string;
          h4?: Json;
          id?: string;
          monthly_bias?: Database["public"]["Enums"]["bias_type"] | null;
          monthly_correct?: boolean | null;
          monthly_img?: string | null;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
          weekly_bias?: Database["public"]["Enums"]["bias_type"];
          weekly_correct?: boolean;
          weekly_img?: string | null;
          yearly_bias?: string;
          yearly_img?: string | null;
        };
        Update: {
          asset?: string;
          created_at?: string;
          daily_bias?: Database["public"]["Enums"]["bias_type"];
          daily_correct?: boolean;
          daily_img?: string | null;
          date?: string;
          h4?: Json;
          id?: string;
          monthly_bias?: Database["public"]["Enums"]["bias_type"] | null;
          monthly_correct?: boolean | null;
          monthly_img?: string | null;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
          weekly_bias?: Database["public"]["Enums"]["bias_type"];
          weekly_correct?: boolean;
          weekly_img?: string | null;
          yearly_bias?: string;
          yearly_img?: string | null;
        };
        Relationships: [];
      };
      monthly_funding: {
        Row: {
          amount: number;
          created_at: string | null;
          id: string;
          month_key: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          month_key: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          month_key?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      playbook_setups: {
        Row: {
          created_at: string | null;
          definition: string | null;
          execution_rules: Json | null;
          id: string;
          images: Json | null;
          killzones: string | null;
          market_condition: string | null;
          name: string;
          setup_confluences: Json | null;
          status: string | null;
          timeframe: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          definition?: string | null;
          execution_rules?: Json | null;
          id?: string;
          images?: Json | null;
          killzones?: string | null;
          market_condition?: string | null;
          name: string;
          setup_confluences?: Json | null;
          status?: string | null;
          timeframe?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          definition?: string | null;
          execution_rules?: Json | null;
          id?: string;
          images?: Json | null;
          killzones?: string | null;
          market_condition?: string | null;
          name?: string;
          setup_confluences?: Json | null;
          status?: string | null;
          timeframe?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      psychology_logs: {
        Row: {
          created_at: string;
          date: string;
          entry_rationale: string | null;
          exit_assessment: string | null;
          id: string;
          morning_mood: string | null;
          morning_notes: string | null;
          post_trade_emotion: string | null;
          pre_trade_emotion: string | null;
          trade_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          entry_rationale?: string | null;
          exit_assessment?: string | null;
          id?: string;
          morning_mood?: string | null;
          morning_notes?: string | null;
          post_trade_emotion?: string | null;
          pre_trade_emotion?: string | null;
          trade_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          entry_rationale?: string | null;
          exit_assessment?: string | null;
          id?: string;
          morning_mood?: string | null;
          morning_notes?: string | null;
          post_trade_emotion?: string | null;
          pre_trade_emotion?: string | null;
          trade_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "psychology_logs_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      symbols: {
        Row: {
          created_at: string;
          id: string;
          is_forex: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_forex?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_forex?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          actual_rr: number;
          after_img: string | null;
          before_img: string | null;
          bias_entry_id: string | null;
          compliance_check: boolean | null;
          created_at: string;
          daily_img: string | null;
          entry_time: string;
          exit_time: string | null;
          fees: number;
          grade: string | null;
          gross_pnl: number;
          h1_img: string | null;
          h4_img: string | null;
          id: string;
          m15_img: string | null;
          m5_img: string | null;
          max_rr: number;
          missed_confluences: Json | null;
          monthly_img: string | null;
          net_pnl: number;
          notes: string | null;
          setup_id: string | null;
          side: Database["public"]["Enums"]["trade_side"];
          status: string | null;
          symbol: string;
          updated_at: string;
          user_id: string;
          weekly_img: string | null;
        };
        Insert: {
          actual_rr?: number;
          after_img?: string | null;
          before_img?: string | null;
          bias_entry_id?: string | null;
          compliance_check?: boolean | null;
          created_at?: string;
          daily_img?: string | null;
          entry_time?: string;
          exit_time?: string | null;
          fees?: number;
          grade?: string | null;
          gross_pnl?: number;
          h1_img?: string | null;
          h4_img?: string | null;
          id?: string;
          m15_img?: string | null;
          m5_img?: string | null;
          max_rr?: number;
          missed_confluences?: Json | null;
          monthly_img?: string | null;
          net_pnl?: number;
          notes?: string | null;
          setup_id?: string | null;
          side?: Database["public"]["Enums"]["trade_side"];
          status?: string | null;
          symbol: string;
          updated_at?: string;
          user_id: string;
          weekly_img?: string | null;
        };
        Update: {
          actual_rr?: number;
          after_img?: string | null;
          before_img?: string | null;
          bias_entry_id?: string | null;
          compliance_check?: boolean | null;
          created_at?: string;
          daily_img?: string | null;
          entry_time?: string;
          exit_time?: string | null;
          fees?: number;
          grade?: string | null;
          gross_pnl?: number;
          h1_img?: string | null;
          h4_img?: string | null;
          id?: string;
          m15_img?: string | null;
          m5_img?: string | null;
          max_rr?: number;
          missed_confluences?: Json | null;
          monthly_img?: string | null;
          net_pnl?: number;
          notes?: string | null;
          setup_id?: string | null;
          side?: Database["public"]["Enums"]["trade_side"];
          status?: string | null;
          symbol?: string;
          updated_at?: string;
          user_id?: string;
          weekly_img?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trades_setup_id_fkey";
            columns: ["setup_id"];
            isOneToOne: false;
            referencedRelation: "playbook_setups";
            referencedColumns: ["id"];
          },
        ];
      };
      trading_reviews: {
        Row: {
          action_plan: Json;
          created_at: string;
          environmental_reflection: string | null;
          id: string;
          period: string;
          psychological_reflection: string | null;
          technical_reflection: string | null;
          top_mistakes: Json;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action_plan?: Json;
          created_at?: string;
          environmental_reflection?: string | null;
          id?: string;
          period: string;
          psychological_reflection?: string | null;
          technical_reflection?: string | null;
          top_mistakes?: Json;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          action_plan?: Json;
          created_at?: string;
          environmental_reflection?: string | null;
          id?: string;
          period?: string;
          psychological_reflection?: string | null;
          technical_reflection?: string | null;
          top_mistakes?: Json;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string | null;
          primary_color: string | null;
          show_trade_grade: boolean | null;
          trade_log_view: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          primary_color?: string | null;
          show_trade_grade?: boolean | null;
          trade_log_view?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          primary_color?: string | null;
          show_trade_grade?: boolean | null;
          trade_log_view?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      bias_type: "bullish" | "bearish" | "consolidation";
      trade_side: "buy" | "sell";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bias_type: ["bullish", "bearish", "consolidation"],
      trade_side: ["buy", "sell"],
    },
  },
} as const;
