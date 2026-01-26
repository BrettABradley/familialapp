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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      album_photos: {
        Row: {
          album_id: string
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          uploaded_by: string
        }
        Insert: {
          album_id: string
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          uploaded_by: string
        }
        Update: {
          album_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "photo_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invites: {
        Row: {
          circle_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          token: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          token?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_invites_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_memberships: {
        Row: {
          circle_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_memberships_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_tree_members: {
        Row: {
          bio: string | null
          birth_date: string | null
          circle_id: string
          created_at: string
          created_by: string
          death_date: string | null
          gender: string | null
          id: string
          linked_user_id: string | null
          name: string
          parent1_id: string | null
          parent2_id: string | null
          photo_url: string | null
          spouse_id: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          circle_id: string
          created_at?: string
          created_by: string
          death_date?: string | null
          gender?: string | null
          id?: string
          linked_user_id?: string | null
          name: string
          parent1_id?: string | null
          parent2_id?: string | null
          photo_url?: string | null
          spouse_id?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          circle_id?: string
          created_at?: string
          created_by?: string
          death_date?: string | null
          gender?: string | null
          id?: string
          linked_user_id?: string | null
          name?: string
          parent1_id?: string | null
          parent2_id?: string | null
          photo_url?: string | null
          spouse_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_tree_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tree_members_parent1_id_fkey"
            columns: ["parent1_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tree_members_parent2_id_fkey"
            columns: ["parent2_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tree_members_spouse_id_fkey"
            columns: ["spouse_id"]
            isOneToOne: false
            referencedRelation: "family_tree_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_pins: {
        Row: {
          circle_id: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          pin_type: string
          pinned_by: string
          title: string
          updated_at: string
        }
        Insert: {
          circle_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          pin_type?: string
          pinned_by: string
          title: string
          updated_at?: string
        }
        Update: {
          circle_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          pin_type?: string
          pinned_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_pins_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          related_circle_id: string | null
          related_post_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          related_circle_id?: string | null
          related_post_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          related_circle_id?: string | null
          related_post_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_circle_id_fkey"
            columns: ["related_circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_albums: {
        Row: {
          circle_id: string
          cover_photo_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          circle_id: string
          cover_photo_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          circle_id?: string
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_albums_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_permissions: {
        Row: {
          can_download: boolean
          created_at: string
          granted_by: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          can_download?: boolean
          created_at?: string
          granted_by: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          can_download?: boolean
          created_at?: string
          granted_by?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_permissions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          circle_id: string
          content: string | null
          created_at: string
          id: string
          media_urls: string[] | null
          updated_at: string
        }
        Insert: {
          author_id: string
          circle_id: string
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          circle_id?: string
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          location: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_offers: {
        Row: {
          company_email: string
          company_name: string
          company_phone: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          offer_description: string | null
          offer_title: string
          price_per_impression: number | null
          submitted_by: string | null
          target_locations: string[] | null
          updated_at: string
        }
        Insert: {
          company_email: string
          company_name: string
          company_phone?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          offer_description?: string | null
          offer_title: string
          price_per_impression?: number | null
          submitted_by?: string | null
          target_locations?: string[] | null
          updated_at?: string
        }
        Update: {
          company_email?: string
          company_name?: string
          company_phone?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          offer_description?: string | null
          offer_title?: string
          price_per_impression?: number | null
          submitted_by?: string | null
          target_locations?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          max_circles: number
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          max_circles?: number
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          max_circles?: number
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      store_offers_public: {
        Row: {
          created_at: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          offer_description: string | null
          offer_title: string | null
          target_locations: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          offer_description?: string | null
          offer_title?: string | null
          target_locations?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          offer_description?: string | null
          offer_title?: string | null
          target_locations?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_circle: { Args: { _user_id: string }; Returns: boolean }
      get_circle_count: { Args: never; Returns: number }
      get_circle_limit: { Args: never; Returns: number }
      has_circle_role: {
        Args: {
          _circle_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_circle_admin: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "member"
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
      app_role: ["admin", "moderator", "member"],
    },
  },
} as const
