export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          depth: number
          id: string
          name: string
          parent_id: string | null
          path: string
          slug: string
          sort_order: number
          tile_image_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth: number
          id?: string
          name: string
          parent_id?: string | null
          path: string
          slug: string
          sort_order?: number
          tile_image_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          slug?: string
          sort_order?: number
          tile_image_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          address: string | null
          client_nonce: string | null
          created_at: string
          customer_name: string
          fulfilment: string
          id: string
          ip_hash: string | null
          item_count: number
          items: NonNullable<Json>
          message_text: string
          note: string | null
          phone_e164: string
          phone_raw: string
          ref: string
          styling_advice: boolean
          subtotal: number
        }
        Insert: {
          address?: string | null
          client_nonce?: string | null
          created_at?: string
          customer_name: string
          fulfilment: string
          id?: string
          ip_hash?: string | null
          item_count: number
          items: NonNullable<Json>
          message_text: string
          note?: string | null
          phone_e164: string
          phone_raw: string
          ref: string
          styling_advice: boolean
          subtotal: number
        }
        Update: {
          address?: string | null
          client_nonce?: string | null
          created_at?: string
          customer_name?: string
          fulfilment?: string
          id?: string
          ip_hash?: string | null
          item_count?: number
          items?: NonNullable<Json>
          message_text?: string
          note?: string | null
          phone_e164?: string
          phone_raw?: string
          ref?: string
          styling_advice?: boolean
          subtotal?: number
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          height: number | null
          id: string
          product_id: string
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          product_id: string
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          product_id?: string
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_related: {
        Row: {
          product_id: string
          related_id: string
          sort_order: number
        }
        Insert: {
          product_id: string
          related_id: string
          sort_order?: number
        }
        Update: {
          product_id?: string
          related_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_related_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_related_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_related_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_related_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: string
          care_text: string | null
          category_id: string
          compare_at_price: number | null
          created_at: string
          delivery_text: string | null
          description: string | null
          details_text: string | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          id: string
          name: string
          note: string | null
          price: number | null
          search: unknown
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          availability?: string
          care_text?: string | null
          category_id: string
          compare_at_price?: number | null
          created_at?: string
          delivery_text?: string | null
          description?: string | null
          details_text?: string | null
          featured_rank?: number | null
          first_available_at?: string | null
          first_published_at?: string | null
          id?: string
          name: string
          note?: string | null
          price?: number | null
          search?: never
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability?: string
          care_text?: string | null
          category_id?: string
          compare_at_price?: number | null
          created_at?: string
          delivery_text?: string | null
          description?: string | null
          details_text?: string | null
          featured_rank?: number | null
          first_available_at?: string | null
          first_published_at?: string | null
          id?: string
          name?: string
          note?: string | null
          price?: number | null
          search?: never
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          to_path: string
        }
        Insert: {
          created_at?: string
          from_path: string
          to_path: string
        }
        Update: {
          created_at?: string
          from_path?: string
          to_path?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          default_care_text: string
          default_delivery_text: string
          default_details_text: string
          display_phone: string
          hero_eyebrow: string
          hero_headline: string
          hero_headline_accent: string
          hero_image_path: string | null
          id: number
          new_window_days: number
          price_prefix: string
          styling_studio_message: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          default_care_text?: string
          default_delivery_text?: string
          default_details_text?: string
          display_phone?: string
          hero_eyebrow?: string
          hero_headline?: string
          hero_headline_accent?: string
          hero_image_path?: string | null
          id?: number
          new_window_days?: number
          price_prefix?: string
          styling_studio_message?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          default_care_text?: string
          default_delivery_text?: string
          default_details_text?: string
          display_phone?: string
          hero_eyebrow?: string
          hero_headline?: string
          hero_headline_accent?: string
          hero_image_path?: string | null
          id?: number
          new_window_days?: number
          price_prefix?: string
          styling_studio_message?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_cards: {
        Row: {
          availability: string | null
          availability_rank: number | null
          category_id: string | null
          category_name: string | null
          category_path: string | null
          compare_at_price: number | null
          created_at: string | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          id: string | null
          image_alt: string | null
          image_height: number | null
          image_path: string | null
          image_width: number | null
          is_new: boolean | null
          is_on_sale: boolean | null
          name: string | null
          note: string | null
          price: number | null
          slug: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_redirect: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      category_stats: {
        Args: { p_published_only?: boolean }
        Returns: {
          category_id: string
          newest_image_path: string
          product_count: number
        }[]
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      shop_products: {
        Args: {
          p_category_path?: string
          p_filter?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_sort?: string
        }
        Returns: {
          availability: string
          category_path: string
          compare_at_price: number
          first_published_at: string
          id: string
          image_alt: string
          image_height: number
          image_path: string
          image_width: number
          is_new: boolean
          is_on_sale: boolean
          name: string
          note: string
          price: number
          slug: string
          total_count: number
        }[]
      }
      style_it_with: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: {
          availability: string | null
          availability_rank: number | null
          category_id: string | null
          category_name: string | null
          category_path: string | null
          compare_at_price: number | null
          created_at: string | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          id: string | null
          image_alt: string | null
          image_height: number | null
          image_path: string | null
          image_width: number | null
          is_new: boolean | null
          is_on_sale: boolean | null
          name: string | null
          note: string | null
          price: number | null
          slug: string | null
          status: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_cards"
          isOneToOne: false
          isSetofReturn: true
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
