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
      admin_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: unknown
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          icon_name: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
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
      category_attribute_definitions: {
        Row: {
          category_id: string
          created_at: string
          data_type: string
          help_text_ar: string | null
          id: string
          is_filterable: boolean
          is_required: boolean
          key: string
          label_ar: string
          label_en: string | null
          sort_order: number
          unit: string | null
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          category_id: string
          created_at?: string
          data_type: string
          help_text_ar?: string | null
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          key: string
          label_ar: string
          label_en?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          category_id?: string
          created_at?: string
          data_type?: string
          help_text_ar?: string | null
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          key?: string
          label_ar?: string
          label_en?: string | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "category_attribute_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      charities: {
        Row: {
          city: string | null
          cover_url: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          governorate: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name_ar: string
          name_en: string | null
          slug: string
          updated_at: string
          verification_status: string
          website_url: string | null
        }
        Insert: {
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          slug: string
          updated_at?: string
          verification_status?: string
          website_url?: string | null
        }
        Update: {
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          slug?: string
          updated_at?: string
          verification_status?: string
          website_url?: string | null
        }
        Relationships: []
      }
      charity_members: {
        Row: {
          charity_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          charity_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          charity_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charity_members_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string | null
          room_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          room_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          room_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          dispute_id: string
          id: string
          is_internal: boolean
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          dispute_id: string
          id?: string
          is_internal?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          dispute_id?: string
          id?: string
          is_internal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          order_id: string
          priority: string
          raised_by: string
          resolution_code: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          priority?: string
          raised_by: string
          resolution_code?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          priority?: string
          raised_by?: string
          resolution_code?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_confirmations: {
        Row: {
          confirmation_type: string
          confirmed_by: string | null
          created_at: string
          donation_id: string
          evidence_url: string | null
          id: string
          notes: string | null
        }
        Insert: {
          confirmation_type: string
          confirmed_by?: string | null
          created_at?: string
          donation_id: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          confirmation_type?: string
          confirmed_by?: string | null
          created_at?: string
          donation_id?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_confirmations_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_updates: {
        Row: {
          author_user_id: string | null
          body: string | null
          created_at: string
          donation_id: string
          id: string
          is_public: boolean
          media_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body?: string | null
          created_at?: string
          donation_id: string
          id?: string
          is_public?: boolean
          media_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string | null
          created_at?: string
          donation_id?: string
          id?: string
          is_public?: boolean
          media_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_updates_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          accepted_at: string | null
          charity_id: string | null
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          donor_id: string | null
          donor_note: string | null
          id: string
          picked_up_at: string | null
          product_id: string | null
          proof_required: boolean
          recipient_note: string | null
          recipient_type: string
          recipient_user_id: string | null
          requested_at: string
          status: string
          transparency_enabled: boolean
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          charity_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          donor_id?: string | null
          donor_note?: string | null
          id?: string
          picked_up_at?: string | null
          product_id?: string | null
          proof_required?: boolean
          recipient_note?: string | null
          recipient_type: string
          recipient_user_id?: string | null
          requested_at?: string
          status?: string
          transparency_enabled?: boolean
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          charity_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          donor_id?: string | null
          donor_note?: string | null
          id?: string
          picked_up_at?: string | null
          product_id?: string | null
          proof_required?: boolean
          recipient_note?: string | null
          recipient_type?: string
          recipient_user_id?: string | null
          requested_at?: string
          status?: string
          transparency_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          message_type: string
          metadata: Json
          room_id: string
          sender_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          room_id: string
          sender_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          room_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          marketing_updates: boolean
          order_updates: boolean
          payment_updates: boolean
          security_updates: boolean
          shipping_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          marketing_updates?: boolean
          order_updates?: boolean
          payment_updates?: boolean
          security_updates?: boolean
          shipping_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          marketing_updates?: boolean
          order_updates?: boolean
          payment_updates?: boolean
          security_updates?: boolean
          shipping_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: string
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          href?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          message: string | null
          parent_offer_id: string | null
          product_id: string
          status: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          parent_offer_id?: string | null
          product_id: string
          status?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          parent_offer_id?: string | null
          product_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          seller_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          quantity?: number
          seller_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          order_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          delivery_address_snapshot: Json
          delivery_method: string
          fulfillment_status: string
          id: string
          idempotency_key: string | null
          notes: string | null
          offer_id: string | null
          payment_status: string
          platform_fee: number
          product_id: string | null
          reference_code: string
          seller_id: string
          shipping_fee: number
          status: string
          status_reason: string | null
          subtotal: number
          total: number
          updated_at: string
          version: number
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          delivery_address_snapshot?: Json
          delivery_method?: string
          fulfillment_status?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          offer_id?: string | null
          payment_status?: string
          platform_fee?: number
          product_id?: string | null
          reference_code: string
          seller_id: string
          shipping_fee?: number
          status?: string
          status_reason?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          version?: number
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          delivery_address_snapshot?: Json
          delivery_method?: string
          fulfillment_status?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          offer_id?: string | null
          payment_status?: string
          platform_fee?: number
          product_id?: string | null
          reference_code?: string
          seller_id?: string
          shipping_fee?: number
          status?: string
          status_reason?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          created_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string | null
          payment_id: string
          provider: string
          provider_request_id: string | null
          provider_transaction_id: string | null
          request_payload: Json
          response_payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          payment_id: string
          provider: string
          provider_request_id?: string | null
          provider_transaction_id?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
        }
        Update: {
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          payment_id?: string
          provider?: string
          provider_request_id?: string | null
          provider_transaction_id?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          external_event_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider: string
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          cancelled_at: string | null
          checkout_url: string | null
          client_secret: string | null
          created_at: string
          currency: string
          failed_at: string | null
          id: string
          idempotency_key: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          provider_payload: Json
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          checkout_url?: string | null
          client_secret?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          paid_at?: string | null
          provider: string
          provider_order_id?: string | null
          provider_payload?: Json
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          checkout_url?: string | null
          client_secret?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payload?: Json
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_condition_confidence: number | null
          ai_condition_grade: string | null
          ai_condition_score: number | null
          ai_metadata: Json
          ai_price_confidence: number | null
          ai_price_max: number | null
          ai_price_min: number | null
          category_id: string | null
          city: string | null
          condition_details: string | null
          condition_grade: string | null
          created_at: string
          currency: string
          delivery_method: string
          description: string | null
          details_last_completed_at: string | null
          details_schema_version: number
          district: string | null
          donated_at: string | null
          governorate: string | null
          id: string
          is_negotiable: boolean
          listing_type: string
          metadata: Json
          minimum_offer_amount: number | null
          moderation_status: string
          owner_id: string | null
          price: number | null
          published_at: string | null
          quantity: number
          slug: string
          sold_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_condition_confidence?: number | null
          ai_condition_grade?: string | null
          ai_condition_score?: number | null
          ai_metadata?: Json
          ai_price_confidence?: number | null
          ai_price_max?: number | null
          ai_price_min?: number | null
          category_id?: string | null
          city?: string | null
          condition_details?: string | null
          condition_grade?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string
          description?: string | null
          details_last_completed_at?: string | null
          details_schema_version?: number
          district?: string | null
          donated_at?: string | null
          governorate?: string | null
          id?: string
          is_negotiable?: boolean
          listing_type: string
          metadata?: Json
          minimum_offer_amount?: number | null
          moderation_status?: string
          owner_id?: string | null
          price?: number | null
          published_at?: string | null
          quantity?: number
          slug: string
          sold_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_condition_confidence?: number | null
          ai_condition_grade?: string | null
          ai_condition_score?: number | null
          ai_metadata?: Json
          ai_price_confidence?: number | null
          ai_price_max?: number | null
          ai_price_min?: number | null
          category_id?: string | null
          city?: string | null
          condition_details?: string | null
          condition_grade?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string
          description?: string | null
          details_last_completed_at?: string | null
          details_schema_version?: number
          district?: string | null
          donated_at?: string | null
          governorate?: string | null
          id?: string
          is_negotiable?: boolean
          listing_type?: string
          metadata?: Json
          minimum_offer_amount?: number | null
          moderation_status?: string
          owner_id?: string | null
          price?: number | null
          published_at?: string | null
          quantity?: number
          slug?: string
          sold_at?: string | null
          status?: string
          title?: string
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
      profile_private: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          created_at: string
          district: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          created_at?: string
          district?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          created_at?: string
          district?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string
          governorate: string | null
          id: string
          is_public: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          governorate?: string | null
          id: string
          is_public?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          governorate?: string | null
          id?: string
          is_public?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          idempotency_key: string | null
          order_id: string
          payment_id: string
          provider_payload: Json
          provider_ref: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          payment_id: string
          provider_payload?: Json
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          payment_id?: string
          provider_payload?: Json
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string | null
          resolution_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          order_id: string
          order_item_id: string | null
          product_id: string | null
          rating: number
          reviewer_id: string
          seller_id: string | null
          status: string
          target_id: string
          target_type: string
          title: string | null
          updated_at: string
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          order_item_id?: string | null
          product_id?: string | null
          rating: number
          reviewer_id: string
          seller_id?: string | null
          status?: string
          target_id: string
          target_type: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          order_item_id?: string | null
          product_id?: string | null
          rating?: number
          reviewer_id?: string
          seller_id?: string | null
          status?: string
          target_id?: string
          target_type?: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          created_at: string
          description: string | null
          event_code: string
          id: string
          location: string | null
          occurred_at: string
          payload: Json
          provider_event_id: string | null
          shipment_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_code: string
          id?: string
          location?: string | null
          occurred_at?: string
          payload?: Json
          provider_event_id?: string | null
          shipment_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_code?: string
          id?: string
          location?: string | null
          occurred_at?: string
          payload?: Json
          provider_event_id?: string | null
          shipment_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_address_snapshot: Json
          estimated_delivery_at: string | null
          external_shipment_id: string | null
          id: string
          order_id: string
          provider: string | null
          provider_payload: Json
          service_level: string | null
          shipped_at: string | null
          shipping_fee: number
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_address_snapshot?: Json
          estimated_delivery_at?: string | null
          external_shipment_id?: string | null
          id?: string
          order_id: string
          provider?: string | null
          provider_payload?: Json
          service_level?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_address_snapshot?: Json
          estimated_delivery_at?: string | null
          external_shipment_id?: string | null
          id?: string
          order_id?: string
          provider?: string | null
          provider_payload?: Json
          service_level?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          last_response_at: string | null
          order_id: string | null
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          last_response_at?: string | null
          order_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          last_response_at?: string | null
          order_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          buyer_id: string | null
          created_at: string
          currency: string
          id: string
          offer_id: string | null
          payment_provider: string | null
          platform_fee: number
          product_id: string | null
          provider_payload: Json
          provider_transaction_id: string | null
          seller_amount: number | null
          seller_id: string | null
          status: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          offer_id?: string | null
          payment_provider?: string | null
          platform_fee?: number
          product_id?: string | null
          provider_payload?: Json
          provider_transaction_id?: string | null
          seller_amount?: number | null
          seller_id?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          offer_id?: string | null
          payment_provider?: string | null
          platform_fee?: number
          product_id?: string | null
          provider_payload?: Json
          provider_transaction_id?: string | null
          seller_amount?: number | null
          seller_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_state: {
        Args: {
          p_payment_id: string
          p_provider_order_id: string
          p_provider_payload: Json
          p_provider_payment_id: string
          p_status: string
        }
        Returns: Json
      }
      create_dispute: {
        Args: {
          p_category: string
          p_description: string
          p_order_id: string
          p_subject: string
        }
        Returns: Json
      }
      create_fixed_price_order: {
        Args: {
          p_delivery_address: Json
          p_delivery_method: string
          p_idempotency_key: string
          p_notes: string
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
      create_review: {
        Args: {
          p_body: string
          p_idempotency_key: string
          p_order_id: string
          p_rating: number
          p_target_id: string
          p_target_type: string
          p_title: string
        }
        Returns: Json
      }
      transition_order_status: {
        Args: {
          p_idempotency_key: string
          p_new_status: string
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      transition_shipment_status: {
        Args: {
          p_idempotency_key: string
          p_new_status: string
          p_reason: string
          p_shipment_id: string
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {},
  },
} as const
