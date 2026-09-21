export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string | null; display_name: string; avatar_url: string | null; bio: string | null; city: string | null; governorate: string | null; is_public: boolean; created_at: string; updated_at: string };
        Insert: { id: string; display_name: string; username?: string | null; avatar_url?: string | null; bio?: string | null; city?: string | null; governorate?: string | null; is_public?: boolean };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      profile_private: {
        Row: { user_id: string; phone: string | null; address_line1: string | null; address_line2: string | null; district: string | null; postal_code: string | null; latitude: number | null; longitude: number | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["profile_private"]["Row"], "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["profile_private"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: { user_id: string; role: string; created_at: string; updated_at: string };
        Insert: { user_id: string; role: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: { id: string; parent_id: string | null; name_ar: string; name_en: string; slug: string; description_ar: string | null; description_en: string | null; icon_name: string | null; image_url: string | null; sort_order: number; is_active: boolean; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: { id: string; owner_id: string | null; category_id: string | null; title: string; slug: string; description: string | null; listing_type: string; status: string; moderation_status: string; condition_grade: string | null; condition_details: string | null; price: number | null; currency: string; is_negotiable: boolean; minimum_offer_amount: number | null; quantity: number; city: string | null; governorate: string | null; district: string | null; delivery_method: string; metadata: Json; ai_condition_grade: string | null; ai_condition_score: number | null; ai_condition_confidence: number | null; ai_price_min: number | null; ai_price_max: number | null; ai_price_confidence: number | null; ai_metadata: Json; published_at: string | null; sold_at: string | null; donated_at: string | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      product_images: {
        Row: { id: string; product_id: string; storage_path: string; alt_text: string | null; sort_order: number; is_primary: boolean; width: number | null; height: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["product_images"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
        Relationships: [];
      };
      offers: {
        Row: { id: string; product_id: string; buyer_id: string; parent_offer_id: string | null; amount: number; currency: string; status: string; expires_at: string | null; message: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["offers"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["offers"]["Insert"]>;
        Relationships: [];
      };
      favorites: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["favorites"]["Insert"]>;
        Relationships: [];
      };
      charities: {
        Row: { id: string; name_ar: string; name_en: string | null; slug: string; description_ar: string | null; description_en: string | null; logo_url: string | null; cover_url: string | null; website_url: string | null; city: string | null; governorate: string | null; verification_status: string; is_active: boolean; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["charities"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["charities"]["Insert"]>;
        Relationships: [];
      };
      charity_members: {
        Row: { charity_id: string; user_id: string; role: string; created_at: string };
        Insert: { charity_id: string; user_id: string; role?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["charity_members"]["Insert"]>;
        Relationships: [];
      };
      donations: {
        Row: { id: string; product_id: string | null; donor_id: string | null; recipient_type: string; recipient_user_id: string | null; charity_id: string | null; status: string; transparency_enabled: boolean; proof_required: boolean; donor_note: string | null; recipient_note: string | null; requested_at: string; accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null; confirmed_at: string | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["donations"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["donations"]["Insert"]>;
        Relationships: [];
      };
      donation_updates: {
        Row: { id: string; donation_id: string; author_user_id: string | null; title: string; body: string | null; media_url: string | null; is_public: boolean; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["donation_updates"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["donation_updates"]["Insert"]>;
        Relationships: [];
      };
      donation_confirmations: {
        Row: { id: string; donation_id: string; confirmed_by: string | null; confirmation_type: string; notes: string | null; evidence_url: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["donation_confirmations"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["donation_confirmations"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: { id: string; product_id: string | null; offer_id: string | null; buyer_id: string | null; seller_id: string | null; transaction_type: string; status: string; amount: number; platform_fee: number; seller_amount: number | null; currency: string; payment_provider: string | null; provider_transaction_id: string | null; provider_payload: Json; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: { id: string; reporter_id: string | null; product_id: string | null; reported_user_id: string | null; reason: string; description: string | null; status: string; resolution_note: string | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["reports"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      admin_logs: {
        Row: { id: number; actor_user_id: string | null; action: string; entity_type: string | null; entity_id: string | null; before_data: Json | null; after_data: Json | null; metadata: Json; ip_address: unknown; user_agent: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["admin_logs"]["Row"], "id"> & { id?: never };
        Update: Partial<Database["public"]["Tables"]["admin_logs"]["Insert"]>;
        Relationships: [];
      };
      chat_rooms: {
        Row: { id: string; product_id: string | null; created_by: string | null; room_type: string; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["chat_rooms"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["chat_rooms"]["Insert"]>;
        Relationships: [];
      };
      chat_participants: {
        Row: { room_id: string; user_id: string; joined_at: string; last_read_at: string | null; is_muted: boolean };
        Insert: Omit<Database["public"]["Tables"]["chat_participants"]["Row"], "joined_at"> & { joined_at?: string };
        Update: Partial<Database["public"]["Tables"]["chat_participants"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: { id: string; room_id: string; sender_id: string | null; message_type: string; body: string | null; metadata: Json; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      orders: {
        Row: { id: string; buyer_id: string; seller_id: string; product_id: string | null; offer_id: string | null; status: string; payment_status: string; fulfillment_status: string; subtotal: number; shipping_fee: number; platform_fee: number; total: number; currency: string; delivery_method: string; delivery_address_snapshot: Json; notes: string | null; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: { id: string; order_id: string; product_id: string; seller_id: string; quantity: number; unit_price: number; line_total: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["order_items"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
