"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Payload = {
  name: string;
  sku: string | null;
  tag: string | null;
  kind: "website";
  remaining: number;
  images: Array<{ id: string; storage_path: string }>;
};

export default function PartImageUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/part-upload/${token}`);
    const json = (await res.json()) as { data?: Payload; error?: string };
    if (!res.ok || !json.data) {
      setError(json.error || "This upload link is not valid.");
      setData(null);
      return;
    }
    setError("");
    setData(json.data);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/part-upload/${token}`, { method: "POST", body });
    const json = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Upload failed");
      return;
    }
    setMessage("Product photo uploaded — it will appear on the website.");
    if (input) input.value = "";
    await load();
  };

  return (
    <main className="part-upload">
      <div className="part-upload-card">
        <p className="eyebrow">Vasritha · Product photos</p>
        <h1>Scan & upload</h1>
        <p className="muted">Take a photo of this product. It appears on the customer website.</p>
        {data ? (
          <>
            <p>
              <strong>{data.name}</strong>
              {data.sku ? ` · ${data.sku}` : ""}
              {data.tag ? ` · Tag ${data.tag}` : ""}
            </p>
            <p className="muted">
              {data.remaining} slot{data.remaining === 1 ? "" : "s"} left (max 5 photos).
            </p>
            <div className="part-upload-thumbs">
              {data.images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image.id} src={image.storage_path} alt="" />
              ))}
            </div>
            {data.remaining > 0 ? (
              <form onSubmit={onSubmit}>
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  required
                />
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Uploading…" : "Take / choose photo"}
                </button>
              </form>
            ) : (
              <p>All 5 product photos are uploaded.</p>
            )}
          </>
        ) : null}
        {error ? <p className="part-upload-error">{error}</p> : null}
        {message ? <p className="part-upload-ok">{message}</p> : null}
      </div>
    </main>
  );
}
