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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          category: string | null
          content: string
          created_at: string
          department_id: string | null
          expires_at: string | null
          id: string
          publish_at: string
          source: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          publish_at?: string
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          publish_at?: string
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_buildings: {
        Row: {
          building_number: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          building_number: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          building_number?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campus_locations: {
        Row: {
          aliases: string[]
          area: string | null
          building_id: string | null
          building_name: string | null
          building_number: number | null
          created_at: string
          description: string | null
          floor: string | null
          id: string
          image_path: string | null
          is_active: boolean
          location_type: string
          map_x: number | null
          map_y: number | null
          name: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          area?: string | null
          building_id?: string | null
          building_name?: string | null
          building_number?: number | null
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          location_type?: string
          map_x?: number | null
          map_y?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          area?: string | null
          building_id?: string | null
          building_name?: string | null
          building_number?: number | null
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          location_type?: string
          map_x?: number | null
          map_y?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_locations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "campus_buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_map_legend: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          page_number: number | null
          section_title: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          page_number?: number | null
          section_title?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          page_number?: number | null
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analyzed_at: string | null
          collection_id: string | null
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          effective_date: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          key_topics: string[]
          mime_type: string
          processing_error: string | null
          reference_label: string | null
          status: Database["public"]["Enums"]["document_status"]
          summary: string | null
          sort_order: number | null
          source_url: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          analyzed_at?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          effective_date?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          key_topics?: string[]
          mime_type: string
          processing_error?: string | null
          reference_label?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          sort_order?: number | null
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          analyzed_at?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          effective_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          key_topics?: string[]
          mime_type?: string
          processing_error?: string | null
          reference_label?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          sort_order?: number | null
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          department_id: string | null
          description: string | null
          ends_at: string | null
          id: string
          source: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue: string | null
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          department_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          source?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          all_day?: boolean
          created_at?: string
          department_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          source?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      guideline_steps: {
        Row: {
          created_at: string
          description: string | null
          guideline_id: string
          id: string
          step_number: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          guideline_id: string
          id?: string
          step_number: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          guideline_id?: string
          id?: string
          step_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_steps_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      guidelines: {
        Row: {
          category_id: string
          collection_id: string | null
          content: string | null
          created_at: string
          description: string | null
          effective_date: string | null
          id: string
          related_forms: string[]
          requirements: string[]
          responsible_office_id: string | null
          search_vector: unknown
          slug: string
          source_document_id: string | null
          source_order: number | null
          sort_order: number | null
          source_reference: string | null
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          category_id: string
          collection_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          related_forms?: string[]
          requirements?: string[]
          responsible_office_id?: string | null
          search_vector?: unknown
          slug: string
          source_document_id?: string | null
          source_order?: number | null
          sort_order?: number | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          category_id?: string
          collection_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          related_forms?: string[]
          requirements?: string[]
          responsible_office_id?: string | null
          search_vector?: unknown
          slug?: string
          source_document_id?: string | null
          source_order?: number | null
          sort_order?: number | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "guidelines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "guideline_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidelines_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidelines_responsible_office_id_fkey"
            columns: ["responsible_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidelines_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          heading: string | null
          id: string
          note_id: string
          note_title: string
          pages: number[]
          search_vector: unknown
          source_document_id: string | null
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          heading?: string | null
          id?: string
          note_id: string
          note_title: string
          pages?: number[]
          search_vector?: unknown
          source_document_id?: string | null
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          heading?: string | null
          id?: string
          note_id?: string
          note_title?: string
          pages?: number[]
          search_vector?: unknown
          source_document_id?: string | null
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_collections: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_notes: {
        Row: {
          ai_proposal: string | null
          ai_proposal_at: string | null
          created_at: string
          created_by: string | null
          draft_content: string
          draft_origin: Database["public"]["Enums"]["knowledge_note_origin"]
          draft_updated_at: string
          id: string
          published_at: string | null
          published_by: string | null
          published_content: string | null
          source_document_id: string | null
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          ai_proposal?: string | null
          ai_proposal_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_content?: string
          draft_origin?: Database["public"]["Enums"]["knowledge_note_origin"]
          draft_updated_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          published_content?: string | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          ai_proposal?: string | null
          ai_proposal_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_content?: string
          draft_origin?: Database["public"]["Enums"]["knowledge_note_origin"]
          draft_updated_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          published_content?: string | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_notes_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_notes_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          response_metadata: Json | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          response_metadata?: Json | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          response_metadata?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          campus_location_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          head_name: string | null
          head_title: string | null
          id: string
          name: string
          office_hours: string | null
          short_name: string | null
          updated_at: string
        }
        Insert: {
          campus_location_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          head_name?: string | null
          head_title?: string | null
          id?: string
          name: string
          office_hours?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          campus_location_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          head_name?: string | null
          head_title?: string | null
          id?: string
          name?: string
          office_hours?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offices_campus_location_id_fkey"
            columns: ["campus_location_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          intended_department_id: string | null
          intended_program_id: string | null
          must_change_password: boolean
          onboarded_at: string | null
          program_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          student_id: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"] | null
          year_level: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          intended_department_id?: string | null
          intended_program_id?: string | null
          must_change_password?: boolean
          onboarded_at?: string | null
          program_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          year_level?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          intended_department_id?: string | null
          intended_program_id?: string | null
          must_change_password?: boolean
          onboarded_at?: string | null
          program_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_intended_department_id_fkey"
            columns: ["intended_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_intended_program_id_fkey"
            columns: ["intended_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          code: string
          created_at: string
          department_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          assistant_name: string
          campus_map_mime_type: string | null
          campus_map_path: string | null
          campus_map_updated_at: string | null
          campus_map_updated_by: string | null
          id: boolean
          logo_path: string | null
          primary_brand_color: string | null
          timezone: string
          university_name: string | null
          university_short_name: string | null
          updated_at: string
        }
        Insert: {
          assistant_name?: string
          campus_map_mime_type?: string | null
          campus_map_path?: string | null
          campus_map_updated_at?: string | null
          campus_map_updated_by?: string | null
          id?: boolean
          logo_path?: string | null
          primary_brand_color?: string | null
          timezone?: string
          university_name?: string | null
          university_short_name?: string | null
          updated_at?: string
        }
        Update: {
          assistant_name?: string
          campus_map_mime_type?: string | null
          campus_map_path?: string | null
          campus_map_updated_at?: string | null
          campus_map_updated_by?: string | null
          id?: boolean
          logo_path?: string | null
          primary_brand_color?: string | null
          timezone?: string
          university_name?: string | null
          university_short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_campus_map_updated_by_fkey"
            columns: ["campus_map_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_knowledge: {
        Args: { match_count?: number; query_text: string }
        Returns: {
          content: string
          rank: number
          section_id: string
          source_id: string
          source_reference: string
          source_title: string
          title: string
        }[]
      }
      publish_knowledge_note: {
        Args: { p_chunks: Json; p_expected_draft_at: string; p_note_id: string }
        Returns: undefined
      }
      set_knowledge_note_status: {
        Args: {
          p_note_id: string
          p_status: Database["public"]["Enums"]["publish_status"]
        }
        Returns: undefined
      }
      search_document_chunks: {
        Args: { match_count?: number; query_text: string }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          document_type: Database["public"]["Enums"]["document_type"]
          page_number: number
          rank: number
          section_title: string
        }[]
      }
      match_document_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          document_type: Database["public"]["Enums"]["document_type"]
          effective_date: string
          page_number: number
          section_title: string
          similarity: number
        }[]
      }
    }
    Enums: {
      announcement_category:
        | "general"
        | "academic"
        | "registrar"
        | "enrollment"
        | "scholarship"
        | "department"
        | "campus"
        | "emergency"
      app_role: "student" | "admin"
      content_visibility: "public" | "authenticated"
      document_status:
        | "uploaded"
        | "processing"
        | "ready"
        | "failed"
        | "archived"
      document_type:
        | "handbook"
        | "memo"
        | "policy"
        | "guideline"
        | "calendar"
        | "form"
        | "other"
        | "announcement"
        | "campus_map"
      event_status: "draft" | "published" | "cancelled"
      knowledge_note_origin:
        | "manual"
        | "imported"
        | "ai_generated"
        | "ai_organized"
      message_role: "user" | "assistant"
      publish_status: "draft" | "published" | "archived"
      user_type: "freshman" | "visitor"
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
    Enums: {
      announcement_category: [
        "general",
        "academic",
        "registrar",
        "enrollment",
        "scholarship",
        "department",
        "campus",
        "emergency",
      ],
      app_role: ["student", "admin"],
      content_visibility: ["public", "authenticated"],
      document_status: [
        "uploaded",
        "processing",
        "ready",
        "failed",
        "archived",
      ],
      document_type: [
        "handbook",
        "memo",
        "policy",
        "guideline",
        "calendar",
        "form",
        "other",
        "announcement",
        "campus_map",
      ],
      event_status: ["draft", "published", "cancelled"],
      knowledge_note_origin: [
        "manual",
        "imported",
        "ai_generated",
        "ai_organized",
      ],
      message_role: ["user", "assistant"],
      publish_status: ["draft", "published", "archived"],
      user_type: ["freshman", "visitor"],
    },
  },
} as const
