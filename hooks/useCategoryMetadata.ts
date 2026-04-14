"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SourceCategoryMeta, EventCategoryMeta, ForumCategoryMeta } from "@/lib/types";

export function useSourceCategories() {
  const [categories, setCategories] = useState<SourceCategoryMeta[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("source_category")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        const mapped: SourceCategoryMeta[] = (data ?? []).map((c) => ({
          category: c.name,
          label: c.metadata?.name_ko ?? c.name,
          color: c.metadata?.color ?? "#666",
          sort_order: c.sort_order,
        }));
        setCategories(mapped);
      });
  }, []);

  return categories;
}

export function useEventCategories() {
  const [categories, setCategories] = useState<EventCategoryMeta[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("event_category")
      .select("*")
      .not("parent_id", "is", null) // leaf categories only
      .order("sort_order")
      .then(({ data }) => {
        const mapped: EventCategoryMeta[] = (data ?? []).map((c) => ({
          category: c.name,
          label: c.metadata?.name_ko ?? c.name,
          color: c.metadata?.color ?? "#666",
          sort_order: c.sort_order,
        }));
        setCategories(mapped);
      });
  }, []);

  return categories;
}

export function useForumCategories() {
  const [categories, setCategories] = useState<ForumCategoryMeta[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("forum_category_metadata")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setCategories((data ?? []) as ForumCategoryMeta[]));
  }, []);

  return categories;
}
