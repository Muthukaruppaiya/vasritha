"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminSession } from "@/lib/admin-api";

export function useAdminQuery<T>(path: string | null) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    const result = await adminFetch<T>(path);
    if (result.status === 401) {
      clearAdminSession();
      router.replace("/admin/login");
      return;
    }
    if (result.error) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data ?? null);
    }
    setLoading(false);
  }, [path, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
