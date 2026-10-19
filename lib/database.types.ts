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
      attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          hex: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          swatch: string
          updated_at: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          hex?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          swatch?: string
          updated_at?: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          hex?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          swatch?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          show_on_pdp: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          show_on_pdp?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          show_on_pdp?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          depth: number
          filter_dims: string[] | null
          id: string
          name: string
          parent_id: string | null
          path: string
          primary_dim: string | null
          slug: string
          sort_order: number
          tile_image_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth: number
          filter_dims?: string[] | null
          id?: string
          name: string
          parent_id?: string | null
          path: string
          primary_dim?: string | null
          slug: string
          sort_order?: number
          tile_image_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number
          filter_dims?: string[] | null
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          primary_dim?: string | null
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
      gallery_photo_products: {
        Row: {
          photo_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          photo_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          photo_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photo_products_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "gallery_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_photos: {
        Row: {
          alt: string | null
          caption: string | null
          created_at: string
          height: number | null
          id: string
          is_visible: boolean
          sort_order: number
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
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
      product_attribute_values: {
        Row: {
          product_id: string
          value_id: string
        }
        Insert: {
          product_id: string
          value_id: string
        }
        Update: {
          product_id?: string
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
        ]
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
          depth_cm: number | null
          description: string | null
          details_text: string | null
          diameter_cm: number | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          height_cm: number | null
          id: string
          item_code: string | null
          item_upc_code: string | null
          name: string
          note: string | null
          price: number | null
          search: unknown
          slug: string
          status: string
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          availability?: string
          care_text?: string | null
          category_id: string
          compare_at_price?: number | null
          created_at?: string
          delivery_text?: string | null
          depth_cm?: number | null
          description?: string | null
          details_text?: string | null
          diameter_cm?: number | null
          featured_rank?: number | null
          first_available_at?: string | null
          first_published_at?: string | null
          height_cm?: number | null
          id?: string
          item_code?: string | null
          item_upc_code?: string | null
          name: string
          note?: string | null
          price?: number | null
          search?: unknown
          slug: string
          status?: string
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          availability?: string
          care_text?: string | null
          category_id?: string
          compare_at_price?: number | null
          created_at?: string
          delivery_text?: string | null
          depth_cm?: number | null
          description?: string | null
          details_text?: string | null
          diameter_cm?: number | null
          featured_rank?: number | null
          first_available_at?: string | null
          first_published_at?: string | null
          height_cm?: number | null
          id?: string
          item_code?: string | null
          item_upc_code?: string | null
          name?: string
          note?: string | null
          price?: number | null
          search?: unknown
          slug?: string
          status?: string
          updated_at?: string
          width_cm?: number | null
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
          attribute_value_count: number | null
          availability: string | null
          availability_rank: number | null
          category_id: string | null
          category_name: string | null
          category_path: string | null
          color_swatches: Json | null
          compare_at_price: number | null
          created_at: string | null
          depth_cm: number | null
          diameter_cm: number | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          height_cm: number | null
          id: string | null
          image_alt: string | null
          image_height: number | null
          image_path: string | null
          image_width: number | null
          is_new: boolean | null
          is_on_sale: boolean | null
          item_code: string | null
          item_upc_code: string | null
          name: string | null
          note: string | null
          price: number | null
          slug: string | null
          status: string | null
          updated_at: string | null
          width_cm: number | null
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
      attribute_value_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          product_count: number
          value_id: string
        }[]
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
      merge_attribute_value: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      product_dim: {
        Args: {
          p: Database["public"]["Tables"]["products"]["Row"]
          p_dim: string
        }
        Returns: number
      }
      search_suggest: { Args: { p_limit?: number; p_q: string }; Returns: Json }
      shop_facets: {
        Args: {
          p_category_path?: string
          p_dims?: Json
          p_hide_sold_out?: boolean
          p_price_max?: number
          p_price_min?: number
          p_q?: string
          p_show?: string[]
          p_values?: Json
        }
        Returns: Json
      }
      shop_filtered_ids: {
        Args: {
          p_category_path?: string
          p_dims?: Json
          p_hide_sold_out?: boolean
          p_price_max?: number
          p_price_min?: number
          p_q?: string
          p_show?: string[]
          p_skip?: string
          p_values?: Json
        }
        Returns: string[]
      }
      shop_products: {
        Args: {
          p_category_path?: string
          p_dims?: Json
          p_hide_sold_out?: boolean
          p_limit?: number
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_q?: string
          p_show?: string[]
          p_size_dim?: string
          p_sort?: string
          p_values?: Json
        }
        Returns: {
          availability: string
          category_path: string
          color_swatches: Json
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
      shop_tsquery: { Args: { p_q: string }; Returns: unknown }
      similar_attribute_values: {
        Args: { p_attribute_id: string; p_name: string }
        Returns: {
          id: string
          name: string
          score: number
          slug: string
        }[]
      }
      style_it_with: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: {
          attribute_value_count: number | null
          availability: string | null
          availability_rank: number | null
          category_id: string | null
          category_name: string | null
          category_path: string | null
          color_swatches: Json | null
          compare_at_price: number | null
          created_at: string | null
          depth_cm: number | null
          diameter_cm: number | null
          featured_rank: number | null
          first_available_at: string | null
          first_published_at: string | null
          height_cm: number | null
          id: string | null
          image_alt: string | null
          image_height: number | null
          image_path: string | null
          image_width: number | null
          is_new: boolean | null
          is_on_sale: boolean | null
          item_code: string | null
          item_upc_code: string | null
          name: string | null
          note: string | null
          price: number | null
          slug: string | null
          status: string | null
          updated_at: string | null
          width_cm: number | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
